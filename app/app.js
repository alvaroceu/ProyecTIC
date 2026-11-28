const path = require('path');
const express = require('express');

const session = require('./config/session');
const auth = require('./middlewares/auth');
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const boardsRouter = require('./routes/boards');
const profileRouter = require('./routes/profile');

const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(session);
app.use(auth);

app.use('/', indexRouter);
app.use('/', authRouter);
app.use('/boards', boardsRouter);
app.use('/profile', profileRouter);

app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Página no encontrada',
    status: 404,
    message: 'La página que buscas no existe.',
    user: res.locals.user || null,
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).render('error', {
    title: 'Error',
    status: 500,
    message: 'Ha ocurrido un error inesperado. Inténtalo de nuevo más tarde.',
    user: res.locals.user || null,
  });
});

module.exports = app;
