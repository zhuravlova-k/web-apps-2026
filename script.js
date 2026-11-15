// --- КРОК 1: Обґрунтування вибору фреймворку ---
// Обрано Vue 3 (глобальна збірка через CDN): він дає реактивність і компоненти
// у наявному HTML без збірки й Babel (на відміну від React + JSX).

const API_YEAR = new Date().getFullYear();
const API_COUNTRY = 'UA';
const API_URL = `https://date.nager.at/api/v3/PublicHolidays/${API_YEAR}/${API_COUNTRY}`;

// довідники не змінюються, тому це звичайні константи, а не реактивний стан.
const FILTER_CATEGORIES = { all: 'Усі', music: 'Музика', art: 'Мистецтво', theater: 'Театр', holiday: 'Свята' };
const FORM_CATEGORIES = { music: 'Музика', art: 'Мистецтво', theater: 'Театр', holiday: 'Свято' };

class ApiError extends Error {
    constructor(message, { status, cause } = {}) {
        super(message, { cause });
        this.name = 'ApiError';
        this.status = status;
    }
}

// --- Демо-дані відносно поточної дати ---
// Рядок YYYY-MM-DD збираємо з ЛОКАЛЬНИХ частин дати (toISOString віддав би UTC-дату,
// яка вночі за Києвом відрізняється від локальної).
const toLocalISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const dateWithOffset = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return toLocalISO(d);
};

// --- Спільна логіка дати для EventCard і EventDetails ---
// Міксин залежить лише від власного prop `date`, а не від глобальних змінних.
// Рядок 'YYYY-MM-DD' розбираємо вручну (split), без new Date(string), щоб
// результат не залежав від часового поясу користувача.
const EventDateMixin = {
    props: {
        date: { type: String, required: true }
    },
    computed: {
        // Дата події як UTC-північ (рік/місяць/день беруться прямо з рядка)
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
        // кількість днів до події
        daysUntil() {
            const now = new Date();
            // Сьогодні: локальні геттери (це календарний день користувача), далі в UTC
            const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
            // Math.round, бо різниця — ціле число днів у UTC, без впливу переходу на зимовий час
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

// --- Компонент картки події (props → рендер, $emit → батьківський компонент) ---
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
    emits: ['select-event'],
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
            <p :class="['badge', 'badge-' + category]">{{ categoryLabel || category }}</p>

            <!-- Повний текст у підказці, скорочений (по межі слова) — візуально -->
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

// --- Компонент панелі «Деталі обраної події» ---
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
    // Константи-довідники віддаємо шаблону через setup(), без реактивності
    setup() {
        return {
            filterCategories: FILTER_CATEGORIES,
            formCategories: FORM_CATEGORIES
        };
    },
    // Реактивний стан
    data() {
        return {
            events: [
                { id: 1, title: 'Симфонічний концерт просто неба', category: 'music', date: dateWithOffset(5) },
                { id: 2, title: 'Виставка сучасного мистецтва', category: 'art', date: dateWithOffset(-3) },
                { id: 3, title: 'Театральна вистава "Тіні"', category: 'theater', date: dateWithOffset(0) },
                { id: 4, title: 'Хор', category: 'music', date: dateWithOffset(12) }
            ],
            currentFilter: 'all',
            newEvent: { title: '', category: '', date: '' },
            selectedId: null, // зберігаємо лише id, сама подія виводиться через computed
            apiStatusMessage: '',
            apiStatusClass: '',
            isApiLoading: false,
            nextId: 5
        };
    },
    computed: {
        // ручну функцію рендера updateRender() (практикум 7: createElement/innerHTML)
        // видалено. Її замінено шаблоном із v-for, компонентом EventCard і цим computed.
        filteredEvents() {
            let result = this.events;
            if (this.currentFilter !== 'all') {
                result = result.filter(e => e.category === this.currentFilter);
            }
            // копія масиву, щоб не мутувати реактивний стан під час сортування
            return [...result].sort((a, b) => a.date.localeCompare(b.date));
        },
        // Похідне значення: обрана подія завжди узгоджена з масивом events
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
        },

        // Обробник події $emit від EventCard
        handleSelectEvent(id) {
            this.selectedId = id;

            // На вузьких екранах панель деталей під списком: підкручуємо до неї,
            // щоб клік мав видимий результат (через ref, без querySelector).
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

                // дедуплікація: старі API-події замінюються новими
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