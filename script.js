console.log('script.js підключено');

// масив об'єктів з даними подій (узгоджено з розміткою HTML + 1 коротка подія для тесту)
const cityEvents = [
    { title: 'Симфонічний концерт просто неба', category: 'music' },
    { title: 'Виставка сучасного мистецтва', category: 'art' },
    { title: 'Театральна вистава "Тіні"', category: 'theater' },
    { title: 'Хор', category: 'music' }
];

// стрілкова функція: обрізає текст до n символів і додає '…' (один символ) без зайвих пробілів
const shorten = (text, n) => text.length > n ? text.slice(0, n).trimEnd() + '…' : text;

// звичайна функція: перебирає події циклом for...of; якщо передано targetCategory —
// виводить лише події цієї категорії, інакше всі; класифікує через if/else і рахує події
function processEvents(events, targetCategory) {
    console.log(targetCategory ? `--- Події в категорії: ${targetCategory} ---` : '--- Усі події ---');
    let count = 0;

    for (const event of events) {
        if (!targetCategory || event.category === targetCategory) {
            let message;
            if (event.category === 'music') {
                message = 'Музична подія:';
            } else if (event.category === 'art') {
                message = 'Мистецька подія:';
            } else if (event.category === 'theater') {
                message = 'Театральна подія:';
            } else {
                message = 'Інша подія:';
            }
            console.log(`${message} ${shorten(event.title, 20)}`);
            count++;
        }
    }

    console.log(`Знайдено подій: ${count}`);
}

// виклики: окрема категорія та всі події
processEvents(cityEvents, 'music');
processEvents(cityEvents, 'theater');
processEvents(cityEvents);

// прямі виклики стрілкової функції (Крок 7)
console.log('--- Перевірка функції shorten ---');
console.log(shorten(cityEvents[0].title, 20));           // реальні дані, довший текст
console.log(shorten(cityEvents[3].title, 20));           // реальні дані, короткий текст
console.log(shorten('Ця назва занадто довга і має бути обрізана', 20));