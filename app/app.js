const path = require('path');
const express = require('express');

const indexRouter = require('./routes/index');

const app = express();

// Vistas EJS
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Ficheros estáticos: /css/global.css → public/css/global.css
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);

module.exports = app;
