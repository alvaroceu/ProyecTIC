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

module.exports = app;
