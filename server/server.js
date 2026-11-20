const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const EVENTS_FILE = path.join(__dirname, 'data', 'events.json');

// завантажуємо локальний набір подій із JSON-файлу
const events = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8'));

// роздача статичних файлів клієнта (index.html, css/style.css, script.js) з того самого origin
app.use(express.static(PUBLIC_DIR));

// GET /api/events — повертає повний локальний список культурних подій у форматі JSON
app.get('/api/events', (req, res) => {
    res.json(events);
});

// GET /api/events/:id — повертає деталі однієї події за id або 404 для невідомого id
app.get('/api/events/:id', (req, res) => {
    const event = events.find((item) => String(item.id) === req.params.id);
    if (!event) {
        return res.status(404).json({ error: 'Подію не знайдено' });
    }
    res.json(event);
});

// обробка неіснуючих маршрутів API (повертає 404 у форматі JSON замість HTML-сторінки)
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Маршрут API не знайдено' });
});

app.listen(PORT, () => {
    console.log(`Сервер запущено на http://localhost:${PORT}`);
});
