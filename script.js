console.log('script.js підключено');

// масив об'єктів з даними подій (повністю узгоджено з розміткою HTML + 1 коротка подія для тесту)
const cityEvents = [
    { title: 'Симфонічний концерт просто неба', category: 'music' },
    { title: 'Виставка сучасного мистецтва', category: 'art' },
    { title: 'Театральна вистава "Тіні"', category: 'theater' },
    { title: 'Хор', category: 'music' }
];

// стрілкова функція: обрізає текст до n символів і додає '…' (один символ) без зайвих пробілів
const shorten = (text, n) => text.length > n ? text.slice(0, n).trimEnd() + '…' : text;

// звичайна функція: перебирає масив подій циклом for...of та класифікує їх через if/else
function processEvents(events) {
    console.log('--- Аналіз усіх подій ---');
    
    for (const event of events) {
        const shortTitle = shorten(event.title, 20);
        let message = '';
        
        if (event.category === 'music') {
            message = 'Музична подія:';
        } else if (event.category === 'art') {
            message = 'Мистецька подія:';
        } else if (event.category === 'theater') {
            message = 'Театральна подія:';
        } else {
            message = 'Інша подія:';
        }
        
        console.log(`${message} ${shortTitle}`);
    }
}

// виклик основної функції для масиву
processEvents(cityEvents);

// окремі прямі виклики стрілкової функції для перевірки її логіки (Крок 7)
console.log('--- Перевірка функції shorten ---');
console.log(shorten('Коротка назва', 20)); // текст коротший за 20 символів (гілка else)
console.log(shorten('Ця назва занадто довга і має бути обрізана', 20)); // Текст довший за 20 символів