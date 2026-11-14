// налаштування API: для перевірки помилки 404 змініть код країни на 'XX'
const API_YEAR = '2026';
const API_COUNTRY = 'UA';
const API_URL = `https://date.nager.at/api/v3/PublicHolidays/${API_YEAR}/${API_COUNTRY}`;

// помилка API: message завжди придатне для показу користувачу,
// технічні деталі (status, cause) йдуть лише в консоль
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

let cityEvents = [
    { title: 'Симфонічний концерт просто неба', category: 'music', date: '2026-05-28' },
    { title: 'Виставка сучасного мистецтва', category: 'art', date: '2026-05-30' },
    { title: 'Театральна вистава "Тіні"', category: 'theater', date: '2026-06-01' },
    { title: 'Хор', category: 'music', date: '2026-06-15' }
];

const listContainer = document.querySelector('#events-list');
const countElement = document.querySelector('#events-count');
const addEventForm = document.querySelector('#add-event-form');
const titleInput = document.querySelector('#event-title');
const categoryInput = document.querySelector('#event-category');
const dateInput = document.querySelector('#event-date');
const categoryFiltersContainer = document.querySelector('#category-filters');
const loadApiBtn = document.querySelector('#load-api-btn');
const apiStatusElement = document.querySelector('#api-status');

const shorten = (text, n) => text.length > n ? text.slice(0, n).trimEnd() + '…' : text;

// timeZone: 'UTC', бо рядок 'YYYY-MM-DD' парситься як UTC-північ
// (інакше в зонах західніше UTC дата зсунеться на день назад)
const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
    });
};

// сортує події за датою і рендерить їх з урахуванням активного фільтра
function updateRender() {
    cityEvents.sort((a, b) => a.date.localeCompare(b.date));

    const activeFilterBtn = categoryFiltersContainer.querySelector('.active');
    const currentFilter = activeFilterBtn ? activeFilterBtn.dataset.filter : 'all';

    if (currentFilter === 'all') {
        renderEvents(cityEvents);
    } else {
        renderEvents(cityEvents.filter(e => e.category === currentFilter));
    }
}

function renderEvents(events) {
    listContainer.innerHTML = '';

    for (const event of events) {
        const card = document.createElement('article');
        card.setAttribute('data-category', event.category);
        card.classList.add('event-card', `event-card-${event.category}`);

        const badge = document.createElement('p');
        badge.classList.add('badge', `badge-${event.category}`);
        badge.textContent = CATEGORY_LABELS[event.category] ?? event.category;

        // дуже довгі назви скорочуємо, повний текст лишається у підказці
        const title = document.createElement('h3');
        title.textContent = shorten(event.title, 60);
        title.title = event.title;

        card.append(badge, title);

        // англійська назва (поле name з API) є лише в подій з API
        if (event.engName) {
            const engNamePara = document.createElement('p');
            engNamePara.classList.add('event-eng-name');
            engNamePara.textContent = event.engName;
            card.append(engNamePara);
        }

        const datePara = document.createElement('p');
        datePara.classList.add('event-date');
        datePara.textContent = formatDate(event.date);

        card.append(datePara);
        listContainer.append(card);
    }

    countElement.textContent = `Знайдено подій: ${events.length}`;
}

updateRender();

// завантажує державні свята з Nager.Date Public Holidays API (https://date.nager.at)
async function loadData() {
    apiStatusElement.textContent = 'Завантаження...';
    apiStatusElement.className = 'status-msg status-loading';
    loadApiBtn.disabled = true;

    try {
        let response;
        try {
            response = await fetch(API_URL);
        } catch (networkError) {
            // fetch відхиляється лише тоді, коли запит не дійшов до сервера (offline, CORS)
            throw new ApiError('Помилка з\'єднання. Перевірте інтернет.', { cause: networkError });
        }

        // fetch не вважає 404/500 помилкою, тому статус перевіряємо вручну
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

        const apiEvents = data.map(holiday => ({
            title: holiday.localName,
            engName: holiday.name,
            category: 'holiday',
            date: holiday.date,
            isApi: true // маркер, щоб при повторному оновленні свята не дублювались
        }));

        cityEvents = cityEvents.filter(e => !e.isApi).concat(apiEvents);
        updateRender();

        apiStatusElement.textContent = `Успішно завантажено свят: ${apiEvents.length}`;
        apiStatusElement.className = 'status-msg status-success';

    } catch (error) {
        console.error(`Помилка завантаження API (статус: ${error.status ?? 'немає'}):`, error);

        apiStatusElement.className = 'status-msg status-error';
        // користувачу показуємо лише своє повідомлення, а не технічний текст винятку
        apiStatusElement.textContent = error instanceof ApiError
            ? error.message
            : 'Сталася помилка при обробці даних.';
    } finally {
        loadApiBtn.disabled = false;
    }
}

loadApiBtn.addEventListener('click', loadData);


titleInput.addEventListener('input', () => {
    if (titleInput.value.trim().length < 3) {
        titleInput.setCustomValidity('Назва події має містити щонайменше 3 символи');
    } else {
        titleInput.setCustomValidity('');
    }
});

addEventForm.addEventListener('submit', (event) => {
    event.preventDefault();

    cityEvents.push({
        title: titleInput.value.trim(),
        category: categoryInput.value,
        date: dateInput.value
    });

    updateRender();
    addEventForm.reset();
});

// делегування подій: один обробник на контейнер кнопок фільтра
categoryFiltersContainer.addEventListener('click', (event) => {
    const btn = event.target.closest('.filter-btn');
    if (!btn) return;

    categoryFiltersContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    updateRender();
});