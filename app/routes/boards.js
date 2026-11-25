const express = require('express');
const { sequelize, Board, Membership, BoardColumn, Card } = require('../database');

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

// Muestra un tablero con sus columnas y tarjetas, solo a sus miembros (RF2)
router.get('/:id', async (req, res) => {
  const membership = await Membership.findOne({
    where: { userId: req.session.user.id, boardId: req.params.id },
  });

  if (!membership) {
    return res.status(404).send('Tablero no encontrado');
  }

  const board = await Board.findByPk(req.params.id, {
    include: { model: BoardColumn, include: Card },
    order: [
      [BoardColumn, 'position', 'ASC'],
      [BoardColumn, Card, 'position', 'ASC'],
    ],
  });

  res.render('board', {
    title: board.name,
    bodyClass: 'bg-board',
    board,
    role: membership.role,
  });
});

module.exports = router;
// Busca la membership de la usuaria en un tablero (o null si no es miembro)
function findMembership(req) {
  return Membership.findOne({
    where: { userId: req.session.user.id, boardId: req.params.id },
  });
}

// Busca el tablero con sus columnas ordenadas
function findBoardWithColumns(boardId) {
  return Board.findByPk(boardId, {
    include: BoardColumn,
    order: [[BoardColumn, 'position', 'ASC']],
  });
}

// Muestra el formulario para crear una tarjeta (RF4)
router.get('/:id/cards/new', async (req, res) => {
  const membership = await findMembership(req);
  if (!membership) {
    return res.status(404).send('Tablero no encontrado');
  }
  if (membership.role === 'guest') {
    return res.status(403).send('Los invitados no pueden crear tarjetas');
  }

  const board = await findBoardWithColumns(req.params.id);
  res.render('card-new', {
    title: 'Nueva tarjeta',
    board,
    error: null,
    values: { columnId: req.query.column },
  });
});

// Recibe el formulario y crea la tarjeta (RF4)
router.post('/:id/cards', async (req, res) => {
  const membership = await findMembership(req);
  if (!membership) {
    return res.status(404).send('Tablero no encontrado');
  }
  if (membership.role === 'guest') {
    return res.status(403).send('Los invitados no pueden crear tarjetas');
  }

  const board = await findBoardWithColumns(req.params.id);
  const title = (req.body.title || '').trim();
  const description = (req.body.description || '').trim();
  const dueDate = req.body.dueDate || null;
  const columnId = Number(req.body.columnId);
  const values = { title, description, dueDate, columnId };

  const column = board.BoardColumns.find((c) => c.id === columnId);

  if (!title || !column) {
    return res.status(400).render('card-new', {
      title: 'Nueva tarjeta',
      board,
      error: !title ? 'El título es obligatorio' : 'Elige una columna válida',
      values,
    });
  }

  const position = await Card.count({ where: { columnId: column.id } });

  await Card.create({
    title,
    description: description || null,
    dueDate,
    position,
    columnId: column.id,
  });

  res.redirect(`/boards/${board.id}`);
});