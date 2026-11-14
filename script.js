// обґрунтування вибору фреймворку 
// Обрано фреймворк Vue 3 (через глобальну збірку CDN), оскільки він дозволяє 
// легко інтегрувати реактивність та компонентний підхід у наявний HTML-проєкт 
// без складної конфігурації збірки (на відміну від React + Babel).

const API_YEAR = '2026';
const API_COUNTRY = 'UA';
const API_URL = `https://date.nager.at/api/v3/PublicHolidays/${API_YEAR}/${API_COUNTRY}`;

class ApiError extends Error {
    constructor(message, { status, cause } = {}) {
        super(message, { cause });
        this.name = 'ApiError';
        this.status = status;
    }
}

const CATEGORY_LABELS = {
    music: 'Музика',
    art: 'Мистецтво',
    theater: 'Театр',
    holiday: 'Свято'
};

const shorten = (text, n) => text.length > n ? text.slice(0, n).trimEnd() + '…' : text;

const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
    });
};

const EventCard = {
    props: ['title', 'category', 'date', 'engName'],
    template: `
        <article :class="['event-card', \`event-card-\${category}\`]" :data-category="category">
            <p :class="['badge', \`badge-\${category}\`]">{{ categoryLabel }}</p>
            <h3 :title="shortenedTitle">{{ title }}</h3>
            <p v-if="engName" class="event-eng-name">{{ engName }}</p>
            <p class="event-date">{{ formattedDate }}</p>
            
            <!-- Похідне значення (Варіант 5): кількість днів до події -->
            <p class="days-until" style="font-size: 14px; font-weight: 500; margin-top: 8px; color: #555;">
                <span v-if="daysUntil > 0">⏳ Залишилося днів: {{ daysUntil }}</span>
                <span v-else-if="daysUntil === 0" style="color: #2a9d8f;">🎉 Подія сьогодні!</span>
                <span v-else style="color: #999;">🕒 Подія вже минула</span>
            </p>
        </article>
    `,
    computed: {
        categoryLabel() {
            return CATEGORY_LABELS[this.category] || this.category;
        },
        formattedDate() {
            return formatDate(this.date);
        },
        shortenedTitle() {
            return shorten(this.title, 60);
        },
        daysUntil() {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const eventDate = new Date(this.date);
            eventDate.setHours(0, 0, 0, 0);

            const diffTime = eventDate - today;
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
    }
};

const app = Vue.createApp({
    components: {
        'event-card': EventCard
    },
    data() {
        return {
            events: [
                { id: 1, title: 'Симфонічний концерт просто неба', category: 'music', date: '2026-05-28' },
                { id: 2, title: 'Виставка сучасного мистецтва', category: 'art', date: '2026-05-30' },
                { id: 3, title: 'Театральна вистава "Тіні"', category: 'theater', date: '2026-06-01' },
                { id: 4, title: 'Хор', category: 'music', date: '2026-06-15' }
            ],
            currentFilter: 'all',
            newEvent: {
                title: '',
                category: '',
                date: ''
            },
            apiStatusMessage: '',
            apiStatusClass: '',
            isApiLoading: false,
            nextId: 5 // лічильник для генерації унікальних id новим подіям
        };
    },
    computed: {
        // реактивна фільтрація та сортування (замінює стару updateRender)
        filteredEvents() {
            let result = this.events;
            if (this.currentFilter !== 'all') {
                result = result.filter(e => e.category === this.currentFilter);
            }
            // створюємо копію масиву перед сортуванням, щоб не мутувати реактивний стан напряму
            return [...result].sort((a, b) => a.date.localeCompare(b.date));
        }
    },
    methods: {
        // обробник подання форми
        addEvent() {
            if (this.newEvent.title.length < 3) {
                alert('Назва події має містити щонайменше 3 символи');
                return;
            }

            // Vue сам перемалює список
            this.events.push({
                id: this.nextId++,
                title: this.newEvent.title,
                category: this.newEvent.category,
                date: this.newEvent.date
            });

            // Очищення полів форми
            this.newEvent.title = '';
            this.newEvent.category = '';
            this.newEvent.date = '';
        },

        // оновлена функція роботи з API (повністю реактивна)
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
                    id: 'api-' + index + '-' + holiday.date, // генеруємо унікальний ID для v-for
                    title: holiday.localName,
                    engName: holiday.name,
                    category: 'holiday',
                    date: holiday.date,
                    isApi: true
                }));

                // дедуплікація та оновлення стану
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

// запуск Vue-додатка
app.mount('#app');