// --- обґрунтування вибору фреймворку ---
// Обрано Vue 3 (глобальна збірка через CDN): він дає реактивність і компоненти
// у наявному HTML без збірки й Babel (на відміну від React + JSX).

const API_YEAR = new Date().getFullYear();
const API_COUNTRY = 'UA';
const API_URL = `https://date.nager.at/api/v3/PublicHolidays/${API_YEAR}/${API_COUNTRY}`;

const FILTER_CATEGORIES = { all: 'Усі', music: 'Музика', art: 'Мистецтво', theater: 'Театр', holiday: 'Свята' };
const FORM_CATEGORIES = { music: 'Музика', art: 'Мистецтво', theater: 'Театр', holiday: 'Свято' };

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

const INITIAL_EVENTS = [
    { id: 1, title: 'Симфонічний концерт просто неба', category: 'music', date: dateWithOffset(5) },
    { id: 2, title: 'Виставка сучасного мистецтва', category: 'art', date: dateWithOffset(-3) },
    { id: 3, title: 'Театральна вистава "Тіні"', category: 'theater', date: dateWithOffset(0) },
    { id: 4, title: 'Хор', category: 'music', date: dateWithOffset(12) }
];

const DB_NAME = 'EventsDB';
const STORE_NAME = 'savedEvents';
const DB_VERSION = 1;

// функція залишена виключно для кроку 8 (одноразової міграції)
function loadFromLocalStorageForMigration() {
    try {
        const raw = localStorage.getItem('appItems');
        return raw ? JSON.parse(raw) : [];
    } catch (error) {
        console.error('пошкоджені дані в localstorage:', error);
        return [];
    }
}

// реалізація opendb з обробкою onupgradeneeded
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            // створюємо об'єктне сховище (аналог таблиці) з первинним ключем 'id'
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = () => resolve(request.result);

        // обробка помилки доступу до бази
        request.onerror = () => {
            reject(new Error('помилка доступу до indexeddb (можливо, приватний режим браузера).'));
        };
    });
}

// crud - додавання або оновлення (через put в readwrite транзакції)
async function addItem(item) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// crud - видалення 
async function deleteItem(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// crud - читання всіх записів (readonly)
async function getAllItems() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(tx.error);
    });
}


const EventDateMixin = {
    props: {
        date: { type: String, required: true }
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
            const now = new Date();
            const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
            return Math.round((this.eventDateUTC - todayUTC) / (24 * 60 * 60 * 1000));
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
        }
    }
};

const EventCard = {
    mixins: [EventDateMixin],
    props: {
        eventId: { type: [Number, String], required: true },
        title: { type: String, required: true },
        category: { type: String, required: true },
        categoryLabel: String,
        engName: String,
        selected: { type: Boolean, default: false }
    },
    emits: ['select-event', 'delete-event'],
    template: `
        <article
            :class="['event-card', 'event-card-' + category, { 'event-card-selected': selected }]"
            :data-category="category"
            tabindex="0"
            role="button"
            :aria-pressed="selected"
            @click="select"
            @keydown.enter.prevent="select"
            @keydown.space.prevent="select">
            
            <button class="delete-btn" @click.stop="$emit('delete-event', eventId)" title="Видалити зі збережених">×</button>
            <p :class="['badge', 'badge-' + category]">{{ categoryLabel || category }}</p>
            <h3 :title="title">{{ shortenedTitle }}</h3>
            <p v-if="engName" class="event-eng-name">{{ engName }}</p>
            <p class="event-date">{{ formattedDate }}</p>
            <p class="days-until" :class="daysClass">{{ daysText }}</p>
        </article>
    `,
    computed: {
        shortenedTitle() {
            const max = 60;
            if (this.title.length <= max) return this.title;
            const cut = this.title.slice(0, max);
            const lastSpace = cut.lastIndexOf(' ');
            return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
        }
    },
    methods: {
        select() {
            this.$emit('select-event', this.eventId);
        }
    }
};

const EventDetails = {
    mixins: [EventDateMixin],
    props: {
        title: { type: String, required: true },
        categoryLabel: String,
        engName: String
    },
    template: `
        <div class="details-body">
            <h3 class="details-title">{{ title }}</h3>
            <p v-if="engName" class="event-eng-name">{{ engName }}</p>
            <p><strong>Категорія:</strong> {{ categoryLabel }}</p>
            <p><strong>Дата:</strong> {{ formattedDate }}</p>
            <p class="days-until" :class="daysClass">{{ daysText }}</p>
        </div>
    `
};

const app = Vue.createApp({
    components: {
        'event-card': EventCard,
        'event-details': EventDetails
    },
    setup() {
        return {
            filterCategories: FILTER_CATEGORIES,
            formCategories: FORM_CATEGORIES
        };
    },
    data() {
        return {
            events: [],
            currentFilter: 'all',
            newEvent: { title: '', category: '', date: '' },
            selectedId: null,
            apiStatusMessage: '',
            apiStatusClass: '',
            isApiLoading: false,
            nextId: Date.now()
        };
    },
    // переведення рендеру на дані з indexeddb
    async mounted() {
        try {
            // крок 8: одноразова міграція старих даних з localstorage
            const isMigrated = localStorage.getItem('migrated');

            if (!isMigrated) {
                const oldItems = loadFromLocalStorageForMigration();
                const itemsToMigrate = oldItems.length > 0 ? oldItems : INITIAL_EVENTS;

                for (const item of itemsToMigrate) {
                    await addItem(item);
                }
                // ставимо прапорець, щоб більше не переносити дані
                localStorage.setItem('migrated', 'true');
            }

            // отримуємо всі дані з асинхронної бази для відображення
            this.events = await getAllItems();

        } catch (error) {
            console.error(error);
            this.apiStatusClass = 'status-error';
            this.apiStatusMessage = error.message;
            // фолбек, якщо indexeddb недоступна
            this.events = loadFromLocalStorageForMigration();
        }
    },
    computed: {
        filteredEvents() {
            let result = this.events;
            if (this.currentFilter !== 'all') {
                result = result.filter(e => e.category === this.currentFilter);
            }
            return [...result].sort((a, b) => a.date.localeCompare(b.date));
        },
        selectedEvent() {
            return this.events.find(e => e.id === this.selectedId) || null;
        }
    },
    methods: {
        async addEvent() {
            if (this.newEvent.title.length < 3) return;

            const newEv = {
                id: this.nextId++,
                title: this.newEvent.title,
                category: this.newEvent.category,
                date: this.newEvent.date
            };

            try {
                // зберігаємо в базу і відразу оновлюємо стан для відображення
                await addItem(newEv);
                this.events.push(newEv);
            } catch (e) {
                console.error('помилка збереження в базу:', e);
            }

            this.newEvent.title = '';
            this.newEvent.category = '';
            this.newEvent.date = '';
        },

        async removeEvent(id) {
            try {
                // видаляємо запис з бази і фільтруємо локальний стан
                await deleteItem(id);
                this.events = this.events.filter(e => e.id !== id);
                if (this.selectedId === id) this.selectedId = null;
            } catch (e) {
                console.error('помилка видалення з бази:', e);
            }
        },

        handleSelectEvent(id) {
            this.selectedId = id;

            if (window.matchMedia('(max-width: 1023px)').matches) {
                this.$nextTick(() => {
                    this.$refs.details.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                });
            }
        },

        async loadApiData() {
            this.apiStatusMessage = 'Завантаження...';
            this.apiStatusClass = 'status-loading';
            this.isApiLoading = true;

            try {
                let response;
                try {
                    response = await fetch(API_URL);
                } catch (networkError) {
                    throw new ApiError('Помилка з\'єднання. Перевірте інтернет.', { cause: networkError });
                }

                if (!response.ok) {
                    const message = response.status === 404
                        ? 'Дані про події не знайдено'
                        : 'Не вдалося завантажити дані з сервера.';
                    throw new ApiError(message, { status: response.status });
                }

                let data;
                try {
                    data = await response.json();
                } catch (parseError) {
                    throw new ApiError('Сервер повернув некоректну відповідь.', {
                        status: response.status,
                        cause: parseError
                    });
                }

                if (!Array.isArray(data)) {
                    throw new ApiError('Сервер повернув некоректну відповідь.', { status: response.status });
                }
                if (data.length === 0) {
                    throw new ApiError('Дані про події не знайдено', { status: response.status });
                }

                const apiEvents = data.map((holiday, index) => ({
                    id: 'api-' + index + '-' + holiday.date,
                    title: holiday.localName,
                    engName: holiday.name,
                    category: 'holiday',
                    date: holiday.date,
                    isApi: true
                }));

                // зберігаємо отримані з api події безпосередньо в indexeddb
                for (const ev of apiEvents) {
                    await addItem(ev);
                }

                // оновлюємо список після crud-операції, витягуючи свіжі дані
                this.events = await getAllItems();

                this.apiStatusMessage = `Успішно завантажено свят: ${apiEvents.length}`;
                this.apiStatusClass = 'status-success';

            } catch (error) {
                console.error(`Помилка завантаження API (статус: ${error.status ?? 'немає'}):`, error);
                this.apiStatusClass = 'status-error';
                this.apiStatusMessage = error instanceof ApiError
                    ? error.message
                    : 'Сталася помилка при обробці даних.';
            } finally {
                this.isApiLoading = false;
            }
        }
    }
});

app.mount('#app');