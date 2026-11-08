console.log('script.js підключено');

// масив об'єктів з даними подій
const cityEvents = [
    { title: 'Симфонічний концерт просто неба', category: 'music' },
    { title: 'Виставка сучасного мистецтва', category: 'art' },
    { title: 'Театральна вистава "Тіні"', category: 'theater' },
    { title: 'Хор', category: 'music' }
];

// стрілкова функція: обрізає текст до n символів і додає '…' 
const shorten = (text, n) => text.length > n ? text.slice(0, n).trimEnd() + '…' : text;

// вибір контейнерів на сторінці 
const listContainer = document.querySelector('#events-list');
const countElement = document.querySelector('#events-count');

// функція рендеру подій у dom 
function renderEvents(events) {
    // очищення наявного вмісту контейнера
    listContainer.innerHTML = '';
    let count = 0;

    // цикл для створення елементів кожної події
    for (const event of events) {
        // створення article (крок 5)
        const card = document.createElement('article');
        
        // встановлення атрибута та додавання умовного класу за категорією 
        card.setAttribute('data-category', event.category);
        card.classList.add(`event-card-${event.category}`);

        // створення параграфа для категорії 
        const categoryPara = document.createElement('p');
        
        let categoryName = '';
        if (event.category === 'music') {
            categoryName = 'Музика';
            categoryPara.classList.add('badge', 'badge-music');
        } else if (event.category === 'art') {
            categoryName = 'Мистецтво';
            categoryPara.classList.add('badge', 'badge-art');
        } else if (event.category === 'theater') {
            categoryName = 'Театр';
            categoryPara.classList.add('badge', 'badge-theater');
        }
        categoryPara.textContent = categoryName;

        // створення заголовка h3 із застосуванням нашої функції обрізання
        const title = document.createElement('h3');
        title.textContent = shorten(event.title, 25);

        // додавання дочірніх елементів у картку
        card.append(categoryPara, title);
        
        // додавання готової картки у контейнер 
        listContainer.append(card);
        count++;
    }

    // оновлення підсумкового елемента 
    if (countElement) {
        countElement.textContent = `Знайдено подій: ${count}`;
    }
}

// виклик рендеру при завантаженні сторінки 
renderEvents(cityEvents);