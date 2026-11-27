const express = require('express');
const { ValidationError } = require('sequelize');
const { ContactMessage } = require('../database');

const router = express.Router();

const TEAM = ['Álvaro Sánchez Mateos', 'Íñigo González Gámez', 'Adriana Ramírez Medina', 'Vega Yebra Hernández'];

function renderContact(req, res, status, error = null, values = {}) {
  const success = req.session.flash || null;
  delete req.session.flash;
  res.status(status).render('contact', { title: 'Contacto', success, error, values });
}

router.get('/', (req, res) => {
  res.render('index', { title: 'Inicio' });
});

router.get('/sobre-nosotros', (req, res) => {
  res.render('about', { title: 'Sobre nosotros', team: TEAM });
});

router.get('/contacto', (req, res) => {
  renderContact(req, res, 200);
});

router.post('/contacto', async (req, res) => {
  const values = {
    name: (req.body.name || '').trim(),
    email: (req.body.email || '').trim(),
    subject: (req.body.subject || '').trim(),
    message: (req.body.message || '').trim(),
  };

  if (!values.name || !values.email || !values.subject || !values.message) {
    return renderContact(req, res, 400, 'Rellena todos los campos', values);
  }

  try {
    await ContactMessage.create(values);
  } catch (err) {
    if (err instanceof ValidationError) {
      return renderContact(req, res, 400, 'El correo electrónico no es válido', values);
    }
    throw err;
  }

  req.session.flash = 'Mensaje enviado. Te responderemos lo antes posible.';
  res.redirect('/contacto');
});

module.exports = router;
