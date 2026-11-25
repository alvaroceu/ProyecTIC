const session = require('express-session');

if (!process.env.SESSION_SECRET) {
  throw new Error('Falta SESSION_SECRET en app/.env');
}

module.exports = session({
  name: 'proyectic.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
});
