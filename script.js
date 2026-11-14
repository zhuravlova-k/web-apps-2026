const API_YEAR = '2026';
const API_COUNTRY = 'UA';
const API_URL = `https://date.nager.at/api/v3/PublicHolidays/${API_YEAR}/${API_COUNTRY}`;

class ApiHttpError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'ApiHttpError';
        this.status = status;
    }
}

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
const categoryFiltersContainer = document.querySelector('#category-filters');
const loadApiBtn = document.querySelector('#load-api-btn');
const apiStatusElement = document.querySelector('#api-status');

listContainer.querySelectorAll('article').forEach(card => card.remove());

const shorten = (text, n) => text.length > n ? text.slice(0, n).trimEnd() + '…' : text;

const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
};

function updateRender() {
    cityEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

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

        const categoryBadge = document.createElement('span');
        categoryBadge.classList.add('badge');

        if (event.category === 'music') {
            categoryBadge.textContent = 'Музика';
            categoryBadge.classList.add('badge-music');
        } else if (event.category === 'art') {
            categoryBadge.textContent = 'Мистецтво';
            categoryBadge.classList.add('badge-art');
        } else if (event.category === 'theater') {
            categoryBadge.textContent = 'Театр';
            categoryBadge.classList.add('badge-theater');
        } else if (event.category === 'holiday') {
            categoryBadge.textContent = 'Свято';
            categoryBadge.classList.add('badge-holiday');
        } else {
            categoryBadge.textContent = event.category;
        }

        const title = document.createElement('h3');
        title.textContent = shorten(event.title, 25);
        title.title = event.title;

        card.append(categoryBadge, title);

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

async function loadData() {
    apiStatusElement.textContent = 'Завантаження...';
    apiStatusElement.className = 'status-msg status-loading';
    loadApiBtn.disabled = true;

    try {
        const response = await fetch(API_URL);

        if (!response.ok) {
            console.error(`API Error: HTTP Status ${response.status}`);

            if (response.status === 404) {
                throw new ApiHttpError('Дані про події не знайдено', 404);
            } else {
                throw new ApiHttpError('Не вдалося завантажити дані з сервера.', response.status);
            }
        }

        const data = await response.json();

        const apiEvents = data.map(holiday => ({
            title: holiday.localName,
            engName: holiday.name,
            category: 'holiday',
            date: holiday.date,
            isApi: true
        }));

        cityEvents = cityEvents.filter(e => !e.isApi);
        cityEvents.push(...apiEvents);

        updateRender();

    } catch (error) {
        console.error('Помилка завантаження API:', error);
        apiStatusElement.className = 'status-msg status-error';

        if (error instanceof TypeError) {
            apiStatusElement.textContent = 'Помилка з\'єднання. Перевірте інтернет.';
        } else if (error instanceof ApiHttpError) {
            apiStatusElement.textContent = error.message;
        } else {
            apiStatusElement.textContent = 'Сталася помилка при обробці даних.';
        }
    } finally {
        loadApiBtn.disabled = false;
        if (apiStatusElement.textContent === 'Завантаження...') {
            apiStatusElement.textContent = '';
        }
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

    const newEvent = {
        title: titleInput.value.trim(),
        category: document.querySelector('#event-category').value,
        date: document.querySelector('#event-date').value
    };

    cityEvents.push(newEvent);
    updateRender();
    addEventForm.reset();
});

categoryFiltersContainer.addEventListener('click', (event) => {
    const btn = event.target.closest('.filter-btn');
    if (!btn) return;

    categoryFiltersContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    updateRender();
});