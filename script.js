console.log('script.js підключено');

// масив об'єктів з даними подій (з практикуму 6)
const cityEvents = [
    { title: 'Симфонічний концерт просто неба', category: 'music' },
    { title: 'Виставка сучасного мистецтва', category: 'art' },
    { title: 'Театральна вистава "Тіні"', category: 'theater' },
    { title: 'Хор', category: 'music' }
];

// вибір контейнера списку та елемента-підсумку
const listContainer = document.querySelector('#events-list');
const countElement = document.querySelector('#events-count');

// програмне видалення статичних карток-заглушок з практикуму 2
listContainer.querySelectorAll('article').forEach(card => card.remove());

// стрілкова функція з практикуму 6: обрізає текст до n символів і додає '…'
const shorten = (text, n) => text.length > n ? text.slice(0, n).trimEnd() + '…' : text;

// рендер подій у DOM: очищає контейнер, для кожної події створює article
// з p (категорія) і h3 (назва), ставить data-category та класи за категорією,
// після циклу оновлює лічильник подій
function renderEvents(events) {
    listContainer.innerHTML = '';

    for (const event of events) {
        const card = document.createElement('article');
        card.setAttribute('data-category', event.category);
        card.classList.add(`event-card-${event.category}`);

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

        // назва виводиться повністю; shorten лише додає підказку при наведенні
        const title = document.createElement('h3');
        title.textContent = event.title;
        title.title = shorten(event.title, 20);

        card.append(categoryPara, title);
        listContainer.append(card);
    }

    countElement.textContent = `Знайдено подій: ${events.length}`;
}

// виклик рендеру при завантаженні сторінки
renderEvents(cityEvents);