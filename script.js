// --- обґрунтування вибору фреймворку ---
// обрано Vue 3 (глобальна збірка через CDN).

const API_YEAR = new Date().getFullYear();
const API_COUNTRY = 'UA';
const API_URL = `https://date.nager.at/api/v3/PublicHolidays/${API_YEAR}/${API_COUNTRY}`;

const FILTER_CATEGORIES = { all: 'Усі', music: 'Музика', art: 'Мистецтво', theater: 'Театр', holiday: 'Свята' };
const FORM_CATEGORIES = { music: 'Музика', art: 'Мистецтво', theater: 'Театр', holiday: 'Свято' };

const DB_NAME = 'EventsDB';
const DB_VERSION = 1;
const STORE_NAME = 'savedEvents';
const LS_KEY = 'appItems';
const MIGRATION_FLAG_KEY = 'migrated';
const DEFAULT_LOCATION = 'Місце не вказано';

// параметри індикатора «днів до події» та анімації стрічки
const DAY_MS = 24 * 60 * 60 * 1000;
const NEAR_DAYS = 14;              // подія вважається найближчою, якщо до неї від 0 до 14 днів
const SOON_DAYS = 5;               // до події залишилося зовсім мало днів (помаранчева смуга)
const PROGRESS_WINDOW_DAYS = 30;   // вікно індикатора: усе, що далі за 30 днів, показує мінімальну смугу
const PROGRESS_MIN_PERCENT = 5;    // мінімальна ширина смуги для майбутньої події
const STAGGER_MAX_STEPS = 8;       // обмеження черги появи, щоб довгий список не з'являвся занадто довго

class ApiError extends Error {
    constructor(message, { status, cause } = {}) {
        super(message, { cause });
        this.name = 'ApiError';
        this.status = status;
    }
}

const toLocalISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const dateWithOffset = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return toLocalISO(d);
};

const shortenText = (text, max = 60) => {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
};

// реактивна «сьогоднішня» дата: коли настає нова доба, усі computed, що від неї залежать
// (дні до події, ширина смуги, порядок карток), перераховуються й смуга плавно змінюється
const clock = Vue.reactive({ today: toLocalISO(new Date()) });
setInterval(() => {
    const today = toLocalISO(new Date());
    if (today !== clock.today) clock.today = today;
}, 60 * 1000);

// різниця в днях між датою події (YYYY-MM-DD) і сьогоднішнім днем; від'ємне значення - подія минула
const daysUntilDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [ty, tm, td] = clock.today.split('-').map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / DAY_MS);
};

// порядок у стрічці: спочатку майбутні події від найближчої, потім минулі (від щойно минулої)
const compareByNearest = (a, b) => {
    const daysA = daysUntilDate(a.date);
    const daysB = daysUntilDate(b.date);
    const pastA = daysA < 0;
    const pastB = daysB < 0;
    if (pastA !== pastB) return pastA ? 1 : -1;
    return pastA ? daysB - daysA : daysA - daysB;
};

const INITIAL_EVENTS = [
    { id: 1, name: 'Симфонічний концерт просто неба', category: 'music', date: dateWithOffset(5), location: 'Міський парк' },
    { id: 2, name: 'Виставка сучасного мистецтва', category: 'art', date: dateWithOffset(-3), location: 'Галерея сучасного мистецтва' },
    { id: 3, name: 'Театральна вистава "Тіні"', category: 'theater', date: dateWithOffset(0), location: 'Міський драматичний театр' },
    { id: 4, name: 'Хор', category: 'music', date: dateWithOffset(12), location: 'Концертний зал' }
];

function normalizeSavedEvent(raw) {
    if (!raw || !raw.date) return null;
    if (typeof raw.id !== 'number' && typeof raw.id !== 'string') return null;

    const name = raw.name ?? raw.title;
    if (!name) return null;

    return {
        id: raw.id,
        date: String(raw.date),
        name: String(name),
        location: raw.location ? String(raw.location) : DEFAULT_LOCATION
    };
}

function saveToLocalStorage(items) {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(items));
    } catch (error) {
        console.error('Не вдалося записати дані в localStorage:', error);
    }
}

function loadFromLocalStorage() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.map(normalizeSavedEvent).filter(Boolean) : [];
    } catch (error) {
        console.error('Пошкоджені дані в localStorage:', error);
        return [];
    }
}

function openDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('Браузер не підтримує IndexedDB.'));
            return;
        }

        let request;
        try {
            request = indexedDB.open(DB_NAME, DB_VERSION);
        } catch (error) {
            reject(new Error('IndexedDB недоступна (можливо, приватний режим браузера).'));
            return;
        }

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error('Не вдалося відкрити IndexedDB (можливо, приватний режим браузера).'));
    });
}

async function addItem(item) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(item);
        tx.oncomplete = () => {
            db.close();
            resolve();
        };
        tx.onerror = (event) => reject(event.target.error);
        tx.onabort = () => {
            db.close();
            reject(tx.error);
        };
    });
}

async function deleteItem(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => {
            db.close();
            resolve();
        };
        tx.onerror = (event) => reject(event.target.error);
        tx.onabort = () => {
            db.close();
            reject(tx.error);
        };
    });
}

async function getAllItems() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
        tx.onabort = () => db.close();
    });
}

async function migrateFromLocalStorage() {
    if (localStorage.getItem(MIGRATION_FLAG_KEY) === 'true') return;

    const existingItems = await getAllItems();
    const oldItems = loadFromLocalStorage();

    if (existingItems.length === 0 && oldItems.length > 0) {
        for (const oldItem of oldItems) {
            await addItem(oldItem);
        }
    }

    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
}

const EventDateMixin = {
    props: {
        date: { type: String, required: true }
    },
    data() {
        return {
            showProgress: false
        };
    },
    mounted() {
        // смуга спершу рендериться з шириною 0%, а за мить отримує реальну ширину - так спрацьовує CSS transition
        this._progressTimer = setTimeout(() => {
            this.showProgress = true;
        }, 50);
    },
    beforeUnmount() {
        clearTimeout(this._progressTimer);
    },
    computed: {
        eventDateUTC() {
            const [y, m, d] = this.date.split('-').map(Number);
            return Date.UTC(y, m - 1, d);
        },
        formattedDate() {
            return new Date(this.eventDateUTC).toLocaleDateString('uk-UA', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC'
            });
        },
        daysUntil() {
            return daysUntilDate(this.date);
        },
        daysClass() {
            if (this.daysUntil > 0) return 'days-future';
            if (this.daysUntil === 0) return 'days-today';
            return 'days-past';
        },
        daysText() {
            if (this.daysUntil > 0) return `⏳ Залишилося днів: ${this.daysUntil}`;
            if (this.daysUntil === 0) return '🎉 Подія сьогодні!';
            return '🕒 Подія вже минула';
        },
        isNear() {
            return this.daysUntil >= 0 && this.daysUntil <= NEAR_DAYS;
        },

        // чим ближча подія, тим ширша смуга: від PROGRESS_MIN_PERCENT (30 днів і більше) до 100% (сьогодні)
        progressPercent() {
            if (this.daysUntil <= 0) return 100;
            if (this.daysUntil >= PROGRESS_WINDOW_DAYS) return PROGRESS_MIN_PERCENT;
            return Math.round(
                PROGRESS_MIN_PERCENT + (100 - PROGRESS_MIN_PERCENT) * (1 - this.daysUntil / PROGRESS_WINDOW_DAYS)
            );
        },
        progressColor() {
            if (this.daysUntil < 0) return '#9e9e9e';
            if (this.daysUntil === 0) return '#2a9d8f';
            if (this.daysUntil <= SOON_DAYS) return '#e76f51';
            if (this.daysUntil <= NEAR_DAYS) return '#e9c46a';
            return '#023e8a';
        },
        progressStyle() {
            return {
                width: this.showProgress ? `${this.progressPercent}%` : '0%',
                backgroundColor: this.progressColor
            };
        }
    }
};

const EventCard = {
    mixins: [EventDateMixin],
    props: {
        eventId: { type: [Number, String], required: true },
        name: { type: String, required: true },
        category: { type: String, required: true },
        categoryLabel: String,
        location: { type: String, default: '' },
        engName: String,
        selected: { type: Boolean, default: false },
        saved: { type: Boolean, default: false }
    },
    emits: ['select-event', 'toggle-favorite'],
    template: `
        <article
            :class="['event-card', 'event-card-' + category, { 'event-card-selected': selected, 'event-card-near': isNear }]"
            :data-category="category"
            tabindex="0"
            role="button"
            :aria-pressed="selected"
            @click="select"
            @keydown.enter.self.prevent="select"
            @keydown.space.self.prevent="select">

            <p :class="['badge', 'badge-' + category]">{{ categoryLabel || category }}</p>
            <p v-if="isNear" class="near-label">🔥 Найближча подія</p>
            <h3 :title="name">{{ shortenedName }}</h3>
            <p v-if="engName" class="event-eng-name">{{ engName }}</p>
            <p class="event-date">{{ formattedDate }}</p>
            <p v-if="location" class="event-location">📍 {{ location }}</p>
            <p class="days-until" :class="daysClass">{{ daysText }}</p>

            <div class="progress-container" title="Індикатор наближення події"
                role="progressbar" aria-label="Наближення події"
                aria-valuemin="0" aria-valuemax="100"
                :aria-valuenow="progressPercent" :aria-valuetext="daysText">
                <div class="progress-fill" :style="progressStyle"></div>
            </div>

            <button
                type="button"
                class="favorite-btn"
                :class="{ 'favorite-btn-active': saved }"
                @click.stop="$emit('toggle-favorite', eventId)">
                {{ saved ? '★ Прибрати з обраного' : '☆ Додати в обране' }}
            </button>
        </article>
    `,
    computed: {
        shortenedName() { return shortenText(this.name); }
    },
    methods: {
        select() { this.$emit('select-event', this.eventId); }
    }
};

const SavedCard = {
    mixins: [EventDateMixin],
    props: {
        eventId: { type: [Number, String], required: true },
        name: { type: String, required: true },
        location: { type: String, default: '' },
        selected: { type: Boolean, default: false }
    },
    emits: ['select-event', 'remove-favorite'],
    template: `
        <article
            :class="['event-card', 'event-card-saved', { 'event-card-selected': selected }]"
            tabindex="0"
            role="button"
            :aria-pressed="selected"
            @click="select"
            @keydown.enter.self.prevent="select"
            @keydown.space.self.prevent="select">

            <p class="badge badge-saved">★ Обране</p>
            <h3 :title="name">{{ shortenedName }}</h3>
            <p class="event-date">{{ formattedDate }}</p>
            <p v-if="location" class="event-location">📍 {{ location }}</p>
            <p class="days-until" :class="daysClass">{{ daysText }}</p>

            <div class="progress-container" title="Індикатор наближення події"
                role="progressbar" aria-label="Наближення події"
                aria-valuemin="0" aria-valuemax="100"
                :aria-valuenow="progressPercent" :aria-valuetext="daysText">
                <div class="progress-fill" :style="progressStyle"></div>
            </div>

            <button
                type="button"
                class="favorite-btn favorite-btn-remove"
                @click.stop="$emit('remove-favorite', eventId)">
                Видалити з обраних
            </button>
        </article>
    `,
    computed: {
        shortenedName() { return shortenText(this.name); }
    },
    methods: {
        select() { this.$emit('select-event', this.eventId); }
    }
};

const EventDetails = {
    mixins: [EventDateMixin],
    props: {
        name: { type: String, required: true },
        categoryLabel: String,
        location: { type: String, default: '' },
        engName: String
    },
    template: `
        <div class="details-body">
            <h3 class="details-title">{{ name }}</h3>
            <p v-if="engName" class="event-eng-name">{{ engName }}</p>
            <p v-if="categoryLabel"><strong>Категорія:</strong> {{ categoryLabel }}</p>
            <p><strong>Дата:</strong> {{ formattedDate }}</p>
            <p v-if="location"><strong>Місце:</strong> {{ location }}</p>
            <p class="days-until" :class="daysClass">{{ daysText }}</p>
            
            <div class="progress-container details-progress"
                role="progressbar" aria-label="Наближення події"
                aria-valuemin="0" aria-valuemax="100"
                :aria-valuenow="progressPercent" :aria-valuetext="daysText">
                <div class="progress-fill" :style="progressStyle"></div>
            </div>
        </div>
    `
};

const app = Vue.createApp({
    components: { 'event-card': EventCard, 'saved-card': SavedCard, 'event-details': EventDetails },
    setup() { return { filterCategories: FILTER_CATEGORIES, formCategories: FORM_CATEGORIES }; },
    data() {
        return {
            events: [...INITIAL_EVENTS],
            savedEvents: [],
            useLocalFallback: false,
            storageNotice: '',
            storageError: '',
            currentFilter: 'all',
            newEvent: { name: '', location: '', category: '', date: '' },
            selectedId: null,
            apiStatusMessage: '',
            apiStatusClass: '',
            isApiLoading: false,
            nextId: Date.now()
        };
    },
    async mounted() {
        try {
            await migrateFromLocalStorage();
            this.savedEvents = await getAllItems();
            saveToLocalStorage(this.savedEvents);
        } catch (error) {
            console.error('Помилка роботи з IndexedDB:', error);
            this.useLocalFallback = true;
            this.savedEvents = loadFromLocalStorage();
            this.storageNotice = 'Не вдалося отримати доступ до IndexedDB. Обрані події зберігаються в localStorage.';
        }
    },
    computed: {
        filteredEvents() {
            let result = this.events;
            if (this.currentFilter !== 'all') {
                result = result.filter(e => e.category === this.currentFilter);
            }
            // майбутні події від найближчої, минулі - в кінці
            return [...result].sort(compareByNearest);
        },
        sortedSavedEvents() {
            return [...this.savedEvents].sort(compareByNearest);
        },
        selectedEvent() {
            return this.events.find(e => e.id === this.selectedId) || this.savedEvents.find(e => e.id === this.selectedId) || null;
        },
        storageName() { return this.useLocalFallback ? 'localStorage' : 'IndexedDB'; }
    },
    methods: {
        isSaved(id) { return this.savedEvents.some(e => e.id === id); },

        // номер у черзі появи картки (значення --i для transition-delay у CSS)
        staggerIndex(index) { return Math.min(index, STAGGER_MAX_STEPS); },

        // перед зникненням фіксуємо координати картки, інакше position: absolute
        // у CSS Grid перекидає її в лівий верхній кут контейнера
        lockLeavingCard(el) {
            el.style.top = el.offsetTop + 'px';
            el.style.left = el.offsetLeft + 'px';
            el.style.width = el.offsetWidth + 'px';
        },

        addEvent() {
            if (this.newEvent.name.length < 3 || this.newEvent.location.length < 2) return;

            this.events.push({
                id: this.nextId++,
                name: this.newEvent.name,
                location: this.newEvent.location,
                category: this.newEvent.category,
                date: this.newEvent.date
            });

            this.newEvent.name = ''; this.newEvent.location = ''; this.newEvent.category = ''; this.newEvent.date = '';
        },

        toggleFavorite(id) { return this.isSaved(id) ? this.removeFavorite(id) : this.addFavorite(id); },

        async addFavorite(id) {
            const source = this.events.find(e => e.id === id);
            if (!source || this.isSaved(id)) return;

            const record = { id: source.id, date: source.date, name: source.name, location: source.location };

            try {
                if (this.useLocalFallback) { this.savedEvents = [...this.savedEvents, record]; } 
                else { await addItem(record); this.savedEvents = await getAllItems(); }
                saveToLocalStorage(this.savedEvents);
                this.storageError = '';
            } catch (error) {
                console.error('Помилка збереження події:', error);
                this.storageError = 'Не вдалося додати подію в обране. Спробуйте ще раз.';
            }
        },

        async removeFavorite(id) {
            try {
                if (this.useLocalFallback) { this.savedEvents = this.savedEvents.filter(e => e.id !== id); } 
                else { await deleteItem(id); this.savedEvents = await getAllItems(); }
                saveToLocalStorage(this.savedEvents);
                this.storageError = '';

                if (this.selectedId === id && !this.events.some(e => e.id === id)) this.selectedId = null;
            } catch (error) {
                console.error('Помилка видалення події:', error);
                this.storageError = 'Не вдалося видалити подію з обраного. Спробуйте ще раз.';
            }
        },

        handleSelectEvent(id) {
            this.selectedId = id;
            if (window.matchMedia('(max-width: 1023px)').matches) {
                this.$nextTick(() => { this.$refs.details.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
            }
        },

        async loadApiData() {
            this.apiStatusMessage = 'Завантаження...'; this.apiStatusClass = 'status-loading'; this.isApiLoading = true;
            try {
                let response;
                try { response = await fetch(API_URL); } catch (networkError) { throw new ApiError('Помилка з\'єднання. Перевірте інтернет.', { cause: networkError }); }
                if (!response.ok) {
                    const message = response.status === 404 ? 'Дані про події не знайдено' : 'Не вдалося завантажити дані з сервера.';
                    throw new ApiError(message, { status: response.status });
                }

                let data;
                try { data = await response.json(); } catch (parseError) { throw new ApiError('Сервер повернув некоректну відповідь.', { status: response.status, cause: parseError }); }

                if (!Array.isArray(data)) throw new ApiError('Сервер повернув некоректну відповідь.', { status: response.status });
                if (data.length === 0) throw new ApiError('Дані про події не знайдено', { status: response.status });

                const apiEvents = data.map((holiday, index) => ({
                    id: 'api-' + index + '-' + holiday.date,
                    name: holiday.localName,
                    engName: holiday.name,
                    category: 'holiday',
                    location: 'Україна',
                    date: holiday.date,
                    isApi: true
                }));

                this.events = [...this.events.filter(e => !e.isApi), ...apiEvents];
                this.apiStatusMessage = `Успішно завантажено свят: ${apiEvents.length}`;
                this.apiStatusClass = 'status-success';
            } catch (error) {
                console.error(`Помилка завантаження API (статус: ${error.status ?? 'немає'}):`, error);
                this.apiStatusClass = 'status-error';
                this.apiStatusMessage = error instanceof ApiError ? error.message : 'Сталася помилка при обробці даних.';
            } finally { this.isApiLoading = false; }
        }
    }
});

app.mount('#app');