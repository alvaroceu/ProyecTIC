const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('boards', { title: 'Mis tableros' });
});

module.exports = router;
