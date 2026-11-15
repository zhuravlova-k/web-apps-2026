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

// базові стартові дані 
const INITIAL_EVENTS = [
    { id: 1, title: 'Симфонічний концерт просто неба', category: 'music', date: dateWithOffset(5) },
    { id: 2, title: 'Виставка сучасного мистецтва', category: 'art', date: dateWithOffset(-3) },
    { id: 3, title: 'Театральна вистава "Тіні"', category: 'theater', date: dateWithOffset(0) },
    { id: 4, title: 'Хор', category: 'music', date: dateWithOffset(12) }
];

const STORAGE_KEY = 'appItems';

// крок 2: функція збереження в localstorage (з серіалізацією json)
function saveToLocalStorage(items) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
        console.error('помилка при збереженні в localstorage:', error);
    }
}

// функція завантаження з localstorage (з обробкою пошкоджених даних)
function loadFromLocalStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        // якщо даних немає, повертаємо початковий стартовий масив
        return raw ? JSON.parse(raw) : [...INITIAL_EVENTS];
    } catch (error) {
        // захист від падіння додатку при пошкодженому json
        console.error('пошкоджені дані в localstorage:', error);
        return [...INITIAL_EVENTS];
    }
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
    // додано подію видалення для повноцінного crud
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
            
            <!-- кнопка видалення картки (stoppropagation, щоб не викликати select) -->
            <button class="delete-btn" @click.stop="$emit('delete-event', eventId)" title="Видалити подію">×</button>

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
            nextId: Date.now() // унікальні id через timestamp
        };
    },
    mounted() {
        // при старті додатку завантажуємо дані з localstorage
        this.events = loadFromLocalStorage();
    },
    watch: {
        // реактивно прив'язуємо збереження до будь-якої зміни масиву events
        events: {
            handler(newEvents) {
                saveToLocalStorage(newEvents);
            },
            deep: true // відстежує глибокі зміни об'єктів всередині масиву
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
        addEvent() {
            if (this.newEvent.title.length < 3) return;

            this.events.push({
                id: this.nextId++,
                title: this.newEvent.title,
                category: this.newEvent.category,
                date: this.newEvent.date
            });

            this.newEvent.title = '';
            this.newEvent.category = '';
            this.newEvent.date = '';
            // завдяки watch, saveToLocalStorage викликається автоматично
        },

        // видалення події зі стану (і автоматично з localstorage)
        removeEvent(id) {
            this.events = this.events.filter(e => e.id !== id);
            if (this.selectedId === id) this.selectedId = null;
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

                // оновлюємо стан, watch збереже нові дані в localstorage
                this.events = this.events.filter(e => !e.isApi).concat(apiEvents);

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