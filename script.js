// --- КРОК 1: Обґрунтування вибору фреймворку ---
// Обрано фреймворк Vue 3 (CDN), оскільки він дозволяє інтегрувати реактивність 
// і компоненти у наявний HTML без складної конфігурації збірки.

const API_YEAR = new Date().getFullYear(); // Динамічний рік
const API_COUNTRY = 'UA';
const API_URL = `https://date.nager.at/api/v3/PublicHolidays/${API_YEAR}/${API_COUNTRY}`;

class ApiError extends Error {
    constructor(message, { status, cause } = {}) {
        super(message, { cause });
        this.name = 'ApiError';
        this.status = status;
    }
}

const today = new Date();
const formatDateToISO = (dateObj) => dateObj.toISOString().split('T')[0];

const dateFuture = new Date(today); dateFuture.setDate(today.getDate() + 5);
const dateToday = new Date(today);
const datePast = new Date(today); datePast.setDate(today.getDate() - 3);

const EventCard = {
    props: {
        id: [Number, String],
        title: String,
        category: String,
        categoryLabel: String,
        date: String,
        engName: String
    },
    emits: ['select-event'],
    template: `
        <article :class="['event-card', 'event-card-' + category]" :data-category="category" @click="$emit('select-event', id)">
            <p :class="['badge', 'badge-' + category]">{{ categoryLabel || category }}</p>
            
            <!-- Повний текст у підказці, обрізаний - візуально -->
            <h3 :title="title">{{ shortenedTitle }}</h3>
            
            <p v-if="engName" class="event-eng-name">{{ engName }}</p>
            <p class="event-date">{{ formattedDate }}</p>
            
            <!-- Похідне значення: обчислені дні до події -->
            <p class="days-until">
                <span v-if="daysUntil > 0" class="days-future">⏳ Залишилося днів: {{ daysUntil }}</span>
                <span v-else-if="daysUntil === 0" class="days-today">🎉 Подія сьогодні!</span>
                <span v-else class="days-past">🕒 Подія вже минула</span>
            </p>
        </article>
    `,
    computed: {
        shortenedTitle() {
            return this.title.length > 25 ? this.title.slice(0, 25).trimEnd() + '…' : this.title;
        },
        formattedDate() {
            return new Date(this.date).toLocaleDateString('uk-UA', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC'
            });
        },
        daysUntil() {
            const eventD = new Date(this.date);
            const currentD = new Date();

            // використовуємо UTC для уникнення багів із часовими поясами та переходом на зимовий час
            const utcEvent = Date.UTC(eventD.getFullYear(), eventD.getMonth(), eventD.getDate());
            const utcCurrent = Date.UTC(currentD.getFullYear(), currentD.getMonth(), currentD.getDate());

            // використовуємо Math.round для безпеки
            return Math.round((utcEvent - utcCurrent) / (1000 * 60 * 60 * 24));
        }
    }
};

const app = Vue.createApp({
    components: {
        'event-card': EventCard
    },
    // реактивний стан
    data() {
        return {
            filterCategories: { all: 'Усі', music: 'Музика', art: 'Мистецтво', theater: 'Театр', holiday: 'Свята' },
            formCategories: { music: 'Музика', art: 'Мистецтво', theater: 'Театр', holiday: 'Свято' },
            events: [
                { id: 1, title: 'Симфонічний концерт просто неба', category: 'music', date: formatDateToISO(dateFuture) },
                { id: 2, title: 'Виставка сучасного мистецтва', category: 'art', date: formatDateToISO(datePast) },
                { id: 3, title: 'Театральна вистава "Тіні"', category: 'theater', date: formatDateToISO(dateToday) },
                { id: 4, title: 'Хор', category: 'music', date: formatDateToISO(dateFuture) }
            ],
            currentFilter: 'all',
            newEvent: { title: '', category: '', date: '' },
            selectedEvent: null, // Стан для панелі "Обрана подія"
            apiStatusMessage: '',
            apiStatusClass: '',
            isApiLoading: false,
            nextId: 5
        };
    },
    computed: {
        filteredEvents() {
            let result = this.events;
            if (this.currentFilter !== 'all') {
                result = result.filter(e => e.category === this.currentFilter);
            }
            return [...result].sort((a, b) => a.date.localeCompare(b.date));
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

        // обробка події $emit від дочірнього компонента
        handleSelectEvent(id) {
            this.selectedEvent = this.events.find(e => e.id === id);
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
                    throw new ApiError('Сервер повернув некоректну відповідь.', { cause: parseError });
                }

                if (!Array.isArray(data) || data.length === 0) {
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

                this.events = this.events.filter(e => !e.isApi).concat(apiEvents);

                this.apiStatusMessage = `Успішно завантажено свят: ${apiEvents.length}`;
                this.apiStatusClass = 'status-success';

            } catch (error) {
                console.error('Помилка API:', error);
                this.apiStatusClass = 'status-error';
                this.apiStatusMessage = error instanceof ApiError ? error.message : 'Сталася помилка при обробці даних.';
            } finally {
                this.isApiLoading = false;
            }
        }
    }
});

app.mount('#app');