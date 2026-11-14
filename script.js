console.log('script.js підключено');

// масив об'єктів з даними подій (додано поле date для консистентності з формою)
const cityEvents = [
    { title: 'Симфонічний концерт просто неба', category: 'music', date: '2026-05-28' },
    { title: 'Виставка сучасного мистецтва', category: 'art', date: '2026-05-30' },
    { title: 'Театральна вистава "Тіні"', category: 'theater', date: '2026-06-01' },
    { title: 'Хор', category: 'music', date: '2026-06-15' }
];

// вибір контейнерів та елементів DOM
const listContainer = document.querySelector('#events-list');
const countElement = document.querySelector('#events-count');
const addEventForm = document.querySelector('#add-event-form');
const titleInput = document.querySelector('#event-title');
const categoryFiltersContainer = document.querySelector('#category-filters');

// вибір елементів для API
const loadApiBtn = document.querySelector('#load-api-btn');
const apiStatusElement = document.querySelector('#api-status');

// програмне видалення статичних карток-заглушок
listContainer.querySelectorAll('article').forEach(card => card.remove());

// стрілкова функція для обрізання тексту
const shorten = (text, n) => text.length > n ? text.slice(0, n).trimEnd() + '…' : text;

// рендер подій у DOM
function renderEvents(events) {
    listContainer.innerHTML = '';

    for (const event of events) {
        const card = document.createElement('article');
        card.setAttribute('data-category', event.category);

        card.classList.add('event-card', `event-card-${event.category}`);

        const categoryPara = document.createElement('p');
        categoryPara.classList.add('badge');
        if (event.category === 'music') {
            categoryPara.textContent = 'Музика';
            categoryPara.classList.add('badge-music');
        } else if (event.category === 'art') {
            categoryPara.textContent = 'Мистецтво';
            categoryPara.classList.add('badge-art');
        } else if (event.category === 'theater') {
            categoryPara.textContent = 'Театр';
            categoryPara.classList.add('badge-theater');
        } else {
            categoryPara.textContent = event.category;
        }

        const title = document.createElement('h3');
        title.textContent = event.title;
        title.title = shorten(event.title, 20);

        // виведення дати в картці
        const datePara = document.createElement('p');
        datePara.classList.add('event-date');
        datePara.textContent = event.date;

        card.append(categoryPara, title, datePara);
        listContainer.append(card);
    }

    countElement.textContent = `Знайдено подій: ${events.length}`;
}

// початковий рендер при завантаженні сторінки
renderEvents(cityEvents);

// додаткова кастомна валідація поля назви на льоту
titleInput.addEventListener('input', () => {
    if (titleInput.value.trim().length < 3) {
        titleInput.setCustomValidity('Назва події має містити щонайменше 3 символи');
    } else {
        titleInput.setCustomValidity('');
    }
});

// обробка відправки форми додавання нової події без перезавантаження
addEventForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const newTitle = titleInput.value.trim();
    const newCategory = document.querySelector('#event-category').value;
    const newDate = document.querySelector('#event-date').value;

    const newEvent = {
        title: newTitle,
        category: newCategory,
        date: newDate
    };

    cityEvents.push(newEvent);

    // беремо категорію з активної кнопки фільтра, щоб не зламати поточний вигляд
    const activeFilterBtn = categoryFiltersContainer.querySelector('.active');
    const currentFilter = activeFilterBtn ? activeFilterBtn.dataset.filter : 'all';

    if (currentFilter === 'all') {
        renderEvents(cityEvents);
    } else {
        const filteredEvents = cityEvents.filter(e => e.category === currentFilter);
        renderEvents(filteredEvents);
    }

    addEventForm.reset();
});

// делегування подій: фільтрація списку подій за кліком на кнопки категорій
categoryFiltersContainer.addEventListener('click', (event) => {
    const btn = event.target.closest('.filter-btn');
    if (!btn) return; // якщо клік був не по кнопці, ігноруємо

    // оновлюємо візуальний стан кнопок
    categoryFiltersContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const selectedCategory = btn.dataset.filter;

    if (selectedCategory === 'all') {
        renderEvents(cityEvents);
    } else {
        const filteredEvents = cityEvents.filter(e => e.category === selectedCategory);
        renderEvents(filteredEvents);
    }
});

// URL відкритого API (Nager.Date Public Holidays)
const API_URL = 'https://date.nager.at/api/v3/PublicHolidays/2026/UA';

// асинхронна функція для завантаження даних
async function loadData() {
    apiStatusElement.textContent = 'Завантаження...';
    apiStatusElement.style.color = '#023e8a';
    loadApiBtn.disabled = true;

    try {
        // виконати fetch запит
        const response = await fetch(API_URL);

        // перевірити HTTP-статус 
        if (!response.ok) {
            throw new Error(`Дані про події не знайдено`);
        }

        const data = await response.json();

        // адаптувати отримані дані під нашу структуру карток
        const apiEvents = data.map(holiday => ({
            title: holiday.localName,
            category: 'theater',
            date: holiday.date
        }));

        cityEvents.push(...apiEvents);

        const activeFilterBtn = categoryFiltersContainer.querySelector('.active');
        const currentFilter = activeFilterBtn ? activeFilterBtn.dataset.filter : 'all';

        if (currentFilter === 'all') {
            renderEvents(cityEvents);
        } else {
            const filteredEvents = cityEvents.filter(e => e.category === currentFilter);
            renderEvents(filteredEvents);
        }

    } catch (error) {
        console.error('Помилка API:', error);

        if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
            apiStatusElement.textContent = 'Помилка з\'єднання. Перевірте інтернет.';
        } else {
            apiStatusElement.textContent = error.message;
        }
        apiStatusElement.style.color = '#d00000';

        return;

    } finally {
        loadApiBtn.disabled = false;
        if (apiStatusElement.textContent === 'Завантаження...') {
            apiStatusElement.textContent = ''; // ччищаємо текст, якщо запит успішний
        }
    }
}

// прив'язуємо завантаження API до кнопки
loadApiBtn.addEventListener('click', loadData);