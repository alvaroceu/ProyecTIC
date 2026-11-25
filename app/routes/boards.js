const express = require('express');
const { sequelize, Board, Membership, BoardColumn } = require('../database');

const router = express.Router();

const DEFAULT_COLUMNS = ['Pendiente', 'En Proceso', 'Terminado'];

// Lista los tableros de los que la usuaria es miembro (RF2)
router.get('/', async (req, res) => {
  const memberships = await Membership.findAll({
    where: { userId: req.session.user.id },
    include: Board,
    order: [[Board, 'createdAt', 'DESC']],
  });
  res.render('boards', { title: 'Mis tableros', memberships });
});

// Muestra el formulario para crear un tablero
router.get('/new', (req, res) => {
  res.render('board-new', { title: 'Crear tablero', error: null, values: {} });
});

// Recibe el formulario y crea el tablero (RF3)
router.post('/', async (req, res) => {
  const name = (req.body.name || '').trim();
  const description = (req.body.description || '').trim();
  const values = { name, description };

  if (!name) {
    return res.status(400).render('board-new', {
      title: 'Crear tablero',
      error: 'El nombre del tablero es obligatorio',
      values,
    });
  }

  await sequelize.transaction(async (t) => {
    const board = await Board.create(
      { name, description: description || null },
      { transaction: t }
    );

    await Membership.create(
      { userId: req.session.user.id, boardId: board.id, role: 'admin' },
      { transaction: t }
    );

    await BoardColumn.bulkCreate(
      DEFAULT_COLUMNS.map((columnName, index) => ({
        name: columnName,
        position: index,
        boardId: board.id,
      })),
      { transaction: t }
    );
  });

  res.redirect('/boards');
});

module.exports = router;