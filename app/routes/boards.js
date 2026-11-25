const express = require('express');
const { Op } = require('sequelize');
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

// Mueve una tarjeta a otra columna o a otra posición (RF5)
router.post('/:id/cards/:cardId/move', async (req, res) => {
  const membership = await findMembership(req);
  if (!membership) {
    return res.status(404).json({ error: 'Tablero no encontrado' });
  }
  if (membership.role === 'guest') {
    return res.status(403).json({ error: 'Los invitados no pueden mover tarjetas' });
  }

  const board = await findBoardWithColumns(req.params.id);
  const columnIds = board.BoardColumns.map((c) => c.id);
  const card = await Card.findByPk(req.params.cardId);
  const columnId = Number(req.body.columnId);

  // La tarjeta y la columna de destino tienen que ser de este tablero
  if (!card || !columnIds.includes(card.columnId) || !columnIds.includes(columnId)) {
    return res.status(400).json({ error: 'Movimiento no válido' });
  }

  await sequelize.transaction(async (t) => {
    // 1. Sacar la tarjeta de su columna: las que estaban detrás suben un puesto
    await Card.decrement('position', {
      by: 1,
      where: { columnId: card.columnId, position: { [Op.gt]: card.position } },
      transaction: t,
    });

    // 2. Calcular la posición nueva (si no es válida, al final de la columna)
    const total = await Card.count({
      where: { columnId, id: { [Op.ne]: card.id } },
      transaction: t,
    });
    let position = Number(req.body.position);
    if (!Number.isInteger(position) || position < 0 || position > total) {
      position = total;
    }

    // 3. Hacer hueco en la columna de destino: las de esa posición en adelante bajan un puesto
    await Card.increment('position', {
      by: 1,
      where: { columnId, position: { [Op.gte]: position }, id: { [Op.ne]: card.id } },
      transaction: t,
    });

    // 4. Colocar la tarjeta en su sitio nuevo
    await card.update({ columnId, position }, { transaction: t });
  });

  res.json({ ok: true });
});

// Devuelve la tarjeta solo si pertenece a una columna de este tablero (o null)
async function findCardInBoard(board, cardId) {
  const card = await Card.findByPk(cardId);
  if (!card || !board.BoardColumns.some((c) => c.id === card.columnId)) {
    return null;
  }
  return card;
}

// Muestra el detalle de una tarjeta (RF6). El invitado la ve en solo lectura
router.get('/:id/cards/:cardId', async (req, res) => {
  const membership = await findMembership(req);
  if (!membership) {
    return res.status(404).send('Tablero no encontrado');
  }

  const board = await findBoardWithColumns(req.params.id);
  const card = await findCardInBoard(board, req.params.cardId);
  if (!card) {
    return res.status(404).send('Tarjeta no encontrada');
  }

  res.render('card-detail', {
    title: card.title,
    board,
    card,
    role: membership.role,
    error: null,
    values: {
      title: card.title,
      description: card.description,
      dueDate: card.dueDate,
      columnId: card.columnId,
    },
  });
});

// Guarda los cambios de una tarjeta (RF6)
router.post('/:id/cards/:cardId', async (req, res) => {
  const membership = await findMembership(req);
  if (!membership) {
    return res.status(404).send('Tablero no encontrado');
  }
  if (membership.role === 'guest') {
    return res.status(403).send('Los invitados no pueden editar tarjetas');
  }

  const board = await findBoardWithColumns(req.params.id);
  const card = await findCardInBoard(board, req.params.cardId);
  if (!card) {
    return res.status(404).send('Tarjeta no encontrada');
  }

  const title = (req.body.title || '').trim();
  const description = (req.body.description || '').trim();
  const dueDate = req.body.dueDate || null;
  const columnId = Number(req.body.columnId);
  const values = { title, description, dueDate, columnId };
  const columnExists = board.BoardColumns.some((c) => c.id === columnId);

  if (!title || !columnExists) {
    return res.status(400).render('card-detail', {
      title: card.title,
      board,
      card,
      role: membership.role,
      error: !title ? 'El título es obligatorio' : 'Elige una columna válida',
      values,
    });
  }

  await sequelize.transaction(async (t) => {
    // Si cambia de columna: sale de la vieja (las de detrás suben) y va al final de la nueva
    if (columnId !== card.columnId) {
      await Card.decrement('position', {
        by: 1,
        where: { columnId: card.columnId, position: { [Op.gt]: card.position } },
        transaction: t,
      });
      card.position = await Card.count({ where: { columnId }, transaction: t });
      card.columnId = columnId;
    }

    card.title = title;
    card.description = description || null;
    card.dueDate = dueDate;
    await card.save({ transaction: t });
  });

  res.redirect(`/boards/${board.id}`);
});

// Elimina una tarjeta (RF6)
router.post('/:id/cards/:cardId/delete', async (req, res) => {
  const membership = await findMembership(req);
  if (!membership) {
    return res.status(404).send('Tablero no encontrado');
  }
  if (membership.role === 'guest') {
    return res.status(403).send('Los invitados no pueden eliminar tarjetas');
  }

  const board = await findBoardWithColumns(req.params.id);
  const card = await findCardInBoard(board, req.params.cardId);
  if (!card) {
    return res.status(404).send('Tarjeta no encontrada');
  }

  await sequelize.transaction(async (t) => {
    const { columnId, position } = card;
    await card.destroy({ transaction: t });
    // Las tarjetas que estaban detrás suben un puesto
    await Card.decrement('position', {
      by: 1,
      where: { columnId, position: { [Op.gt]: position } },
      transaction: t,
    });
  });

  res.redirect(`/boards/${board.id}`);
});

module.exports = router;

