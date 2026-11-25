const express = require('express');
const bcrypt = require('bcrypt');
const { UniqueConstraintError, ValidationError } = require('sequelize');
const { User } = require('../database');

const router = express.Router();
const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_COST = 10;

function renderAuth(res, status, mode, error, values) {
  res.status(status).render('auth', {
    title: mode === 'login' ? 'Iniciar sesión' : 'Registrarse',
    mode,
    error,
    values,
    bodyClass: 'bg-alt',
    minPasswordLength: MIN_PASSWORD_LENGTH,
  });
}

function startSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.user = { id: user.id, name: user.name, email: user.email, avatar: user.avatar };
      req.session.save((err) => (err ? reject(err) : resolve()));
    });
  });
}

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/boards');
  renderAuth(res, 200, 'login', null, {});
});

router.post('/login', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  const user = await User.findOne({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return renderAuth(res, 401, 'login', 'Email o contraseña incorrectos', { email });
  }

  await startSession(req, user);
  res.redirect('/boards');
});

router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/boards');
  renderAuth(res, 200, 'register', null, {});
});

router.post('/register', async (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const passwordConfirm = req.body.passwordConfirm || '';
  const values = { name, email };

  if (!name || !email || !password) {
    return renderAuth(res, 400, 'register', 'Rellena todos los campos', values);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return renderAuth(res, 400, 'register', `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`, values);
  }
  if (password !== passwordConfirm) {
    return renderAuth(res, 400, 'register', 'Las contraseñas no coinciden', values);
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const user = await User.create({ name, email, passwordHash });
    await startSession(req, user);
    res.redirect('/boards');
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      return renderAuth(res, 409, 'register', 'Ese email ya está registrado', values);
    }
    if (err instanceof ValidationError) {
      return renderAuth(res, 400, 'register', 'El email no es válido', values);
    }
    throw err;
  }
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('proyectic.sid');
    res.redirect('/');
  });
});

module.exports = router;
