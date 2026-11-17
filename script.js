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

const DAY_MS = 24 * 60 * 60 * 1000;
const NEAR_DAYS = 14;
const SOON_DAYS = 5;
const PROGRESS_WINDOW_DAYS = 30;
const PROGRESS_MIN_PERCENT = 5;
const STAGGER_MAX_STEPS = 8;

class ApiError extends Error {
    constructor(message, { status, cause } = {}) {
        super(message, { cause });
        this.name = 'ApiError';
        this.status = status;
    }
}

const toLocalISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

const clock = Vue.reactive({ today: toLocalISO(new Date()) });
setInterval(() => {
    const today = toLocalISO(new Date());
    if (today !== clock.today) clock.today = today;
}, 60 * 1000);

const daysUntilDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [ty, tm, td] = clock.today.split('-').map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / DAY_MS);
};

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
    try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch (e) { console.error(e); }
}

function loadFromLocalStorage() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.map(normalizeSavedEvent).filter(Boolean) : [];
    } catch (error) {
        return [];
    }
}

function openDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) return reject(new Error('Браузер не підтримує IndexedDB.'));
        let request;
        try { request = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { return reject(new Error('IndexedDB недоступна.')); }
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error('Не вдалося відкрити IndexedDB.'));
    });
}

async function addItem(item) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(item);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = (e) => reject(e.target.error);
        tx.onabort = () => { db.close(); reject(tx.error); };
    });
}

async function deleteItem(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = (e) => reject(e.target.error);
        tx.onabort = () => { db.close(); reject(tx.error); };
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
        for (const oldItem of oldItems) await addItem(oldItem);
    }
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
}

const EventDateMixin = {
    props: { date: { type: String, required: true } },
    data() { return { showProgress: false }; },
    mounted() { this._progressTimer = setTimeout(() => { this.showProgress = true; }, 50); },
    beforeUnmount() { clearTimeout(this._progressTimer); },
    computed: {
        eventDateUTC() {
            const [y, m, d] = this.date.split('-').map(Number);
            return Date.UTC(y, m - 1, d);
        },
        formattedDate() {
            return new Date(this.eventDateUTC).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
        },
        daysUntil() { return daysUntilDate(this.date); },
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
        isNear() { return this.daysUntil >= 0 && this.daysUntil <= NEAR_DAYS; },
        progressPercent() {
            if (this.daysUntil <= 0) return 100;
            if (this.daysUntil >= PROGRESS_WINDOW_DAYS) return PROGRESS_MIN_PERCENT;
            return Math.round(PROGRESS_MIN_PERCENT + (100 - PROGRESS_MIN_PERCENT) * (1 - this.daysUntil / PROGRESS_WINDOW_DAYS));
        },
        progressColor() {
            if (this.daysUntil < 0) return '#9e9e9e';
            if (this.daysUntil === 0) return '#2a9d8f';
            if (this.daysUntil <= SOON_DAYS) return '#e76f51';
            if (this.daysUntil <= NEAR_DAYS) return '#e9c46a';
            return '#023e8a';
        },
        progressStyle() {
            return { width: this.showProgress ? `${this.progressPercent}%` : '0%', backgroundColor: this.progressColor };
        }
    }
};

// клієнтська маршрутизація, перехоплення кліку через data-link
const EventCard = {
    mixins: [EventDateMixin],
    props: { eventId: { type: [Number, String], required: true }, name: { type: String, required: true }, category: { type: String, required: true }, categoryLabel: String, location: { type: String, default: '' }, engName: String, saved: { type: Boolean, default: false } },
    emits: ['toggle-favorite'],
    template: `
        <article
            :class="['event-card', 'event-card-' + category, { 'event-card-near': isNear }]"
            :data-category="category" tabindex="0" role="button" data-link
            @click.prevent="navigate" @keydown.enter.self.prevent="navigate" @keydown.space.self.prevent="navigate">
            
            <p :class="['badge', 'badge-' + category]">{{ categoryLabel || category }}</p>
            <p v-if="isNear" class="near-label">🔥 Найближча подія</p>
            <h3 :title="name">{{ shortenedName }}</h3>
            <p v-if="engName" class="event-eng-name">{{ engName }}</p>
            <p class="event-date">{{ formattedDate }}</p>
            <p v-if="location" class="event-location">📍 {{ location }}</p>
            <p class="days-until" :class="daysClass">{{ daysText }}</p>

            <div class="progress-container"><div class="progress-fill" :style="progressStyle"></div></div>

            <button type="button" class="favorite-btn" :class="{ 'favorite-btn-active': saved }" @click.stop="$emit('toggle-favorite', eventId)">
                {{ saved ? '★ Прибрати з обраного' : '☆ Додати в обране' }}
            </button>
        </article>
    `,
    computed: { shortenedName() { return shortenText(this.name); } },
    methods: { navigate() { window.location.hash = '/events/' + this.eventId; } }
};

const SavedCard = {
    mixins: [EventDateMixin],
    props: { eventId: { type: [Number, String], required: true }, name: { type: String, required: true }, location: { type: String, default: '' } },
    emits: ['remove-favorite'],
    template: `
        <article
            class="event-card event-card-saved" tabindex="0" role="button" data-link
            @click.prevent="navigate" @keydown.enter.self.prevent="navigate" @keydown.space.self.prevent="navigate">
            
            <p class="badge badge-saved">★ Обране</p>
            <h3 :title="name">{{ shortenedName }}</h3>
            <p class="event-date">{{ formattedDate }}</p>
            <p v-if="location" class="event-location">📍 {{ location }}</p>
            <p class="days-until" :class="daysClass">{{ daysText }}</p>

            <div class="progress-container"><div class="progress-fill" :style="progressStyle"></div></div>

            <button type="button" class="favorite-btn favorite-btn-remove" @click.stop="$emit('remove-favorite', eventId)">Видалити з обраних</button>
        </article>
    `,
    computed: { shortenedName() { return shortenText(this.name); } },
    methods: { navigate() { window.location.hash = '/events/' + this.eventId; } }
};

const EventDetails = {
    mixins: [EventDateMixin],
    props: { name: { type: String, required: true }, categoryLabel: String, location: { type: String, default: '' }, engName: String },
    template: `
        <div class="details-body">
            <h3 class="details-title">{{ name }}</h3>
            <p v-if="engName" class="event-eng-name">{{ engName }}</p>
            <p v-if="categoryLabel"><strong>Категорія:</strong> {{ categoryLabel }}</p>
            <p><strong>Дата:</strong> {{ formattedDate }}</p>
            <p v-if="location"><strong>Місце:</strong> {{ location }}</p>
            <p class="days-until" :class="daysClass">{{ daysText }}</p>
            <div class="progress-container details-progress"><div class="progress-fill" :style="progressStyle"></div></div>
        </div>
    `
};

const HomeView = {
    components: { 'event-card': EventCard },
    props: ['events', 'savedEvents', 'formCategories', 'filterCategories', 'apiStatusMessage', 'apiStatusClass', 'isApiLoading'],
    emits: ['add-event', 'toggle-favorite', 'load-api-data'],
    data() {
        return {
            currentFilter: 'all',
            newEvent: { name: '', location: '', category: '', date: '' }
        };
    },
    computed: {
        filteredEvents() {
            let result = this.events;
            if (this.currentFilter !== 'all') result = result.filter(e => e.category === this.currentFilter);
            return [...result].sort(compareByNearest);
        }
    },
    methods: {
        isSaved(id) { return this.savedEvents.some(e => e.id === id); },
        submitForm() {
            if (this.newEvent.name.length < 3 || this.newEvent.location.length < 2) return;
            this.$emit('add-event', { ...this.newEvent });
            this.newEvent.name = ''; this.newEvent.location = ''; this.newEvent.category = ''; this.newEvent.date = '';
        },
        staggerIndex(index) { return Math.min(index, STAGGER_MAX_STEPS); },
        lockLeavingCard(el) {
            el.style.top = el.offsetTop + 'px';
            el.style.left = el.offsetLeft + 'px';
            el.style.width = el.offsetWidth + 'px';
        }
    },
    template: `
        <div>
            <section id="filters" class="filters-section">
                <h2>Фільтр за категорією</h2>
                <div class="filter-controls">
                    <span class="filter-label">Категорія:</span>
                    <button v-for="(label, key) in filterCategories" :key="key" type="button" class="filter-btn"
                        :class="{ active: currentFilter === key }" @click="currentFilter = key">
                        {{ label }}
                    </button>
                </div>
            </section>

            <section id="add-event-section" class="add-event-section">
                <h2>Додати нову подію</h2>
                <form id="add-event-form" class="add-event-form" @submit.prevent="submitForm">
                    <div class="form-group"><label>Назва події:</label><input type="text" v-model.trim="newEvent.name" required pattern=".{3,}"></div>
                    <div class="form-group"><label>Місце проведення:</label><input type="text" v-model.trim="newEvent.location" required pattern=".{2,}"></div>
                    <div class="form-group">
                        <label>Категорія:</label>
                        <select v-model="newEvent.category" required>
                            <option value="" disabled>Оберіть категорію</option>
                            <option v-for="(label, key) in formCategories" :key="key" :value="key">{{ label }}</option>
                        </select>
                    </div>
                    <div class="form-group"><label>Дата:</label><input type="date" v-model="newEvent.date" required></div>
                    <button type="submit" class="submit-btn">Додати подію</button>
                </form>
            </section>

            <section id="events">
                <h2>Події</h2>
                <div class="api-controls">
                    <button type="button" class="submit-btn api-btn" @click="$emit('load-api-data')" :disabled="isApiLoading">Оновити події (API)</button>
                    <span class="status-msg" :class="apiStatusClass">{{ apiStatusMessage }}</span>
                </div>
                <transition-group name="list" tag="div" class="cards" appear @before-leave="lockLeavingCard">
                    <event-card v-for="(event, index) in filteredEvents" :key="event.id" :event-id="event.id"
                        :name="event.name" :category="event.category" :category-label="formCategories[event.category]"
                        :date="event.date" :location="event.location" :eng-name="event.engName" :saved="isSaved(event.id)"
                        :style="{ '--i': staggerIndex(index) }" @toggle-favorite="$emit('toggle-favorite', event.id)">
                    </event-card>
                </transition-group>
                <p v-if="filteredEvents.length === 0" class="empty-msg">Подій за обраною категорією немає.</p>
            </section>
        </div>
    `
};

const SavedView = {
    components: { 'saved-card': SavedCard },
    props: ['savedEvents'],
    emits: ['remove-favorite'],
    computed: {
        sortedSavedEvents() { return [...this.savedEvents].sort(compareByNearest); }
    },
    methods: {
        staggerIndex(index) { return Math.min(index, STAGGER_MAX_STEPS); },
        lockLeavingCard(el) { el.style.top = el.offsetTop + 'px'; el.style.left = el.offsetLeft + 'px'; el.style.width = el.offsetWidth + 'px'; }
    },
    template: `
        <section class="saved-section">
            <h2>Обрані події</h2>
            <p class="status-msg">Збережено: {{ savedEvents.length }}</p>
            <transition-group name="list" tag="div" class="cards" appear @before-leave="lockLeavingCard">
                <saved-card v-for="(item, index) in sortedSavedEvents" :key="item.id" :event-id="item.id"
                    :name="item.name" :date="item.date" :location="item.location"
                    :style="{ '--i': staggerIndex(index) }" @remove-favorite="$emit('remove-favorite', item.id)">
                </saved-card>
            </transition-group>
            <p v-if="savedEvents.length === 0" class="empty-msg">Обраних подій поки немає. Натисніть «Додати в обране» на картці події.</p>
        </section>
    `
};

const DetailView = {
    components: { 'event-details': EventDetails },
    props: ['events', 'savedEvents', 'routeParams', 'formCategories'],
    computed: {
        // знаходимо запис за id без мережевого запиту
        event() {
            const id = this.routeParams.id;
            return this.events.find(e => String(e.id) === String(id)) || this.savedEvents.find(e => String(e.id) === String(id)) || null;
        }
    },
    methods: {
        goBack() { window.history.length > 1 ? window.history.back() : window.location.hash = '/'; }
    },
    template: `
        <section class="details-panel">
            <button class="submit-btn" style="margin-bottom: 20px; display: inline-block;" @click="goBack">← Повернутися</button>
            <event-details v-if="event" :name="event.name" :category-label="formCategories[event.category]" 
                :date="event.date" :location="event.location" :eng-name="event.engName">
            </event-details>
            <div v-else class="empty-msg status-error" style="margin-top: 15px;">Подію не знайдено. Можливо, вона була видалена.</div>
        </section>
    `
};

const NotFoundView = {
    template: `
        <section class="not-found-section" style="text-align: center;">
            <h2>404 - Сторінку не знайдено</h2>
            <p class="empty-msg">На жаль, за цією адресою нічого немає.</p>
            <br>
            <a href="#/" class="submit-btn">Повернутися на головну</a>
        </section>
    `
};

// масив маршрутів
const routes = [
    { path: '/', view: 'HomeView' },
    { path: '/saved', view: 'SavedView' },
    { path: '/events/:id', view: 'DetailView' }
];

// зіставлення поточного шляху з патерном та вилучення параметрів
function matchRoute(path) {
    const pathParts = path.split('/').filter(Boolean);
    for (const route of routes) {
        const routeParts = route.path.split('/').filter(Boolean);
        if (routeParts.length !== pathParts.length) continue;

        const params = {};
        const isMatch = routeParts.every((part, i) => {
            if (part.startsWith(':')) {
                params[part.slice(1)] = pathParts[i];
                return true;
            }
            return part === pathParts[i];
        });
        if (isMatch) return { view: route.view, params };
    }
    return null; // маршрут не знайдено
}


const app = Vue.createApp({
    components: { HomeView, SavedView, DetailView, NotFoundView },
    setup() { return { filterCategories: FILTER_CATEGORIES, formCategories: FORM_CATEGORIES }; },
    data() {
        return {
            events: [...INITIAL_EVENTS],
            savedEvents: [],
            useLocalFallback: false,
            apiStatusMessage: '',
            apiStatusClass: '',
            isApiLoading: false,
            nextId: Date.now(),
            
            // стан роутера
            currentRoute: '/',
            routeParams: {},
            currentViewComponent: 'HomeView'
        };
    },
    async mounted() {
        try {
            await migrateFromLocalStorage();
            this.savedEvents = await getAllItems();
            saveToLocalStorage(this.savedEvents);
        } catch (error) {
            this.useLocalFallback = true;
            this.savedEvents = loadFromLocalStorage();
            console.error(error);
        }
        
        // підписуємось на подію зміни хеша для навігації
        window.addEventListener('hashchange', this.handleRouting);
        this.handleRouting();
    },
    methods: {
        handleRouting() {
            const path = window.location.hash.slice(1) || '/';
            this.currentRoute = path;
            const match = matchRoute(path);
            
            if (match) {
                this.currentViewComponent = match.view;
                this.routeParams = match.params;
            } else {
                this.currentViewComponent = 'NotFoundView';
                this.routeParams = {};
            }
        },
        
        addEvent(newEventData) {
            this.events.push({ id: this.nextId++, ...newEventData });
        },

        toggleFavorite(id) {
            const isSaved = this.savedEvents.some(e => e.id === id);
            return isSaved ? this.removeFavorite(id) : this.addFavorite(id);
        },

        async addFavorite(id) {
            const source = this.events.find(e => e.id === id);
            if (!source) return;
            const record = { id: source.id, date: source.date, name: source.name, location: source.location };

            try {
                if (this.useLocalFallback) { this.savedEvents = [...this.savedEvents, record]; } 
                else { await addItem(record); this.savedEvents = await getAllItems(); }
                saveToLocalStorage(this.savedEvents);
            } catch (error) { console.error('Помилка збереження події:', error); }
        },

        async removeFavorite(id) {
            try {
                if (this.useLocalFallback) { this.savedEvents = this.savedEvents.filter(e => e.id !== id); } 
                else { await deleteItem(id); this.savedEvents = await getAllItems(); }
                saveToLocalStorage(this.savedEvents);
            } catch (error) { console.error('Помилка видалення події:', error); }
        },

        async loadApiData() {
            this.apiStatusMessage = 'Завантаження...'; this.apiStatusClass = 'status-loading'; this.isApiLoading = true;
            try {
                let response = await fetch(API_URL);
                if (!response.ok) throw new ApiError('Не вдалося завантажити дані з сервера.', { status: response.status });
                let data = await response.json();
                
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
                this.apiStatusClass = 'status-error';
                this.apiStatusMessage = 'Помилка при завантаженні API.';
            } finally { this.isApiLoading = false; }
        }
    }
});

app.mount('#app');