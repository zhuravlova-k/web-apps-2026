console.log('script.js підключено');

const cityEvents = [
    { title: 'Симфонічний концерт просто неба', category: 'music' },
    { title: 'Виставка сучасного мистецтва', category: 'art' },
    { title: 'Театральна вистава "Тіні"', category: 'theater' },
    { title: 'Джазовий вечір у старому парку', category: 'music' },
    { title: 'Інтерактивна виставка робототехніки', category: 'art' }
];

const shorten = (text, n) => text.length > n ? text.slice(0, n) + '...' : text;

function processEvents(events, targetCategory) {
    console.log(`--- Події в категорії: ${targetCategory} ---`);
    
    for (const event of events) {
        if (event.category === targetCategory) {
            const shortTitle = shorten(event.title, 20);
            
            let message = '';
            if (event.category === 'music') {
                message = 'Музична подія:';
            } else if (event.category === 'theater') {
                message = 'Театральна подія:';
            } else {
                message = 'Культурна подія:';
            }
            
            console.log(`${message} ${shortTitle}`);
        }
    }
}

processEvents(cityEvents, 'music');
processEvents(cityEvents, 'art');