console.log('script.js підключено');

// масив об'єктів з даними подій
const cityEvents = [
    { title: 'Симфонічний концерт просто неба', category: 'music' },
    { title: 'Виставка сучасного мистецтва', category: 'art' },
    { title: 'Театральна вистава "Тіні"', category: 'theater' },
    { title: 'Хор', category: 'music' }
];

// вибір контейнерів та елементів DOM
const listContainer = document.querySelector('#events-list');
const countElement = document.querySelector('#events-count');
const addEventForm = document.querySelector('#add-event-form');
const titleInput = document.querySelector('#event-title');
const categoryFilter = document.querySelector('#category-filter');

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

        card.append(categoryPara, title);
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

    const currentFilter = categoryFilter.value;
    if (currentFilter === 'all') {
        renderEvents(cityEvents);
    } else {
        const filteredEvents = cityEvents.filter(e => e.category === currentFilter);
        renderEvents(filteredEvents);
    }

    addEventForm.reset();
});

// миттєва фільтрація списку подій при зміні селекту категорії
categoryFilter.addEventListener('change', (event) => {
    const selectedCategory = event.target.value;

    if (selectedCategory === 'all') {
        renderEvents(cityEvents);
    } else {
        const filteredEvents = cityEvents.filter(e => e.category === selectedCategory);
        renderEvents(filteredEvents);
    }
});