const express = require('express');
const bcrypt = require('bcrypt');
const { User } = require('../database');
const { MIN_PASSWORD_LENGTH, BCRYPT_COST } = require('../config/passwords');

const router = express.Router();

function renderProfile(req, res, status, error = null, values = {}) {
  const success = req.session.flash || null;
  delete req.session.flash;
  res.status(status).render('profile', {
    title: 'Mi perfil',
    bodyClass: 'bg-alt',
    success,
    error,
    values: { name: req.session.user.name, ...values },
    minPasswordLength: MIN_PASSWORD_LENGTH,
  });
}

router.get('/', (req, res) => {
  renderProfile(req, res, 200);
});

router.post('/', async (req, res) => {
  const name = (req.body.name || '').trim();
  const currentPassword = req.body.currentPassword || '';
  const newPassword = req.body.newPassword || '';
  const newPasswordConfirm = req.body.newPasswordConfirm || '';

  if (!name) {
    return renderProfile(req, res, 400, 'El nombre no puede estar vacío', { name });
  }

  const user = await User.findByPk(req.session.user.id);
  const changes = { name };

  if (newPassword || newPasswordConfirm) {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return renderProfile(req, res, 400, `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`, { name });
    }
    if (newPassword !== newPasswordConfirm) {
      return renderProfile(req, res, 400, 'Las contraseñas nuevas no coinciden', { name });
    }
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return renderProfile(req, res, 400, 'La contraseña actual no es correcta', { name });
    }
    changes.passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  }

  await user.update(changes);
  req.session.user.name = user.name;
  req.session.flash = 'Cambios guardados';
  res.redirect('/profile');
});

module.exports = router;
