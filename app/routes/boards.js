const express = require('express');
const { Op } = require('sequelize');
const { sequelize, Board, Membership, BoardColumn, Card, Comment, User } = require('../database');
const { notifyBoardChanged } = require('../sockets');
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

  notifyBoardChanged(board.id);
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

  notifyBoardChanged(board.id, req.get('X-Socket-Id'));
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
 
    const comments = await Comment.findAll({
    where: { cardId: card.id },
    include: { model: User, attributes: ['id', 'name'] },
    order: [['createdAt', 'ASC']],
  });

  res.render('card-detail', {
    title: card.title,
    board,
    card,
    comments,
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

  notifyBoardChanged(board.id);
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

  notifyBoardChanged(board.id);
  res.redirect(`/boards/${board.id}`);
});

// Añade un comentario a una tarjeta (RF7). Solo colaborador o admin
router.post('/:id/cards/:cardId/comments', async (req, res) => {
  const membership = await findMembership(req);
  if (!membership) {
    return res.status(404).send('Tablero no encontrado');
  }
  if (membership.role === 'guest') {
    return res.status(403).send('Los invitados no pueden comentar');
  }

  const board = await findBoardWithColumns(req.params.id);
  const card = await findCardInBoard(board, req.params.cardId);
  if (!card) {
    return res.status(404).send('Tarjeta no encontrada');
  }

  const text = (req.body.text || '').trim();
  if (text) {
    await Comment.create({ text, cardId: card.id, userId: req.session.user.id });
  }

  res.redirect(`/boards/${board.id}/cards/${card.id}#comentarios`);
});

// ---------- Miembros del tablero (RF9) ----------

const INVITE_ROLES = ['collaborator', 'guest'];

// Comprueba que la usuaria es admin del tablero. Si no, responde con el error y devuelve null
async function requireAdmin(req, res) {
  const membership = await findMembership(req);
  if (!membership) {
    res.status(404).send('Tablero no encontrado');
    return null;
  }
  if (membership.role !== 'admin') {
    res.status(403).send('Solo el administrador puede gestionar los miembros');
    return null;
  }
  return Board.findByPk(req.params.id);
}

// Carga los miembros del tablero (con su usuario) y pinta la página
async function renderMembers(res, board, status = 200, error = null, values = {}) {
  const memberships = await Membership.findAll({
    where: { boardId: board.id },
    include: { model: User, attributes: ['id', 'name', 'email'] },
    order: [['createdAt', 'ASC']],
  });
  res.status(status).render('members', { title: 'Miembros', board, memberships, error, values });
}

// Muestra la página de miembros (solo admin)
router.get('/:id/members', async (req, res) => {
  const board = await requireAdmin(req, res);
  if (!board) return;
  await renderMembers(res, board);
});

// Invita a un usuario registrado por su correo, como colaborador o invitado
router.post('/:id/members', async (req, res) => {
  const board = await requireAdmin(req, res);
  if (!board) return;

  const email = (req.body.email || '').trim().toLowerCase();
  const role = req.body.role;
  const values = { email, role };

  if (!INVITE_ROLES.includes(role)) {
    return renderMembers(res, board, 400, 'Elige un rol válido', values);
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    return renderMembers(res, board, 400, 'No hay ningún usuario registrado con ese correo', values);
  }

  const alreadyMember = await Membership.findOne({ where: { userId: user.id, boardId: board.id } });
  if (alreadyMember) {
    return renderMembers(res, board, 400, 'Ese usuario ya es miembro del tablero', values);
  }

  await Membership.create({ userId: user.id, boardId: board.id, role });
  res.redirect(`/boards/${board.id}/members`);
});

// Cambia el rol de un miembro (entre colaborador e invitado)
router.post('/:id/members/:memberId', async (req, res) => {
  const board = await requireAdmin(req, res);
  if (!board) return;

  const member = await Membership.findOne({ where: { userId: req.params.memberId, boardId: board.id } });
  if (!member || member.role === 'admin' || !INVITE_ROLES.includes(req.body.role)) {
    return res.status(400).send('Cambio de rol no válido');
  }

  member.role = req.body.role;
  await member.save();
  res.redirect(`/boards/${board.id}/members`);
});

// Quita a un miembro del tablero (al administrador no se le puede quitar)
router.post('/:id/members/:memberId/delete', async (req, res) => {
  const board = await requireAdmin(req, res);
  if (!board) return;

  const member = await Membership.findOne({ where: { userId: req.params.memberId, boardId: board.id } });
  if (!member || member.role === 'admin') {
    return res.status(400).send('No se puede quitar a este miembro');
  }

  await member.destroy();
  res.redirect(`/boards/${board.id}/members`);
});

// ---------- Ajustes del tablero (RF10) ----------

// Busca el tablero con sus columnas (ordenadas) y las tarjetas de cada columna
function findBoardWithColumnsAndCards(boardId) {
  return Board.findByPk(boardId, {
    include: { model: BoardColumn, include: Card },
    order: [[BoardColumn, 'position', 'ASC']],
  });
}

// Pinta la página de ajustes, con un mensaje de error si hace falta
async function renderSettings(res, boardId, status = 200, error = null) {
  const board = await findBoardWithColumnsAndCards(boardId);
  res.status(status).render('settings', { title: 'Ajustes', board, error });
}

// Muestra la página de ajustes (solo admin)
router.get('/:id/settings', async (req, res) => {
  const board = await requireAdmin(req, res);
  if (!board) return;
  await renderSettings(res, board.id);
});

// Cambia el nombre y la descripción del tablero
router.post('/:id/settings', async (req, res) => {
  const board = await requireAdmin(req, res);
  if (!board) return;

  const name = (req.body.name || '').trim();
  const description = (req.body.description || '').trim();
  if (!name) {
    return renderSettings(res, board.id, 400, 'El nombre del tablero es obligatorio');
  }

  board.name = name;
  board.description = description || null;
  await board.save();
  notifyBoardChanged(board.id);
  res.redirect(`/boards/${board.id}/settings`);
});

// Añade una columna al final
router.post('/:id/columns', async (req, res) => {
  const board = await requireAdmin(req, res);
  if (!board) return;

  const name = (req.body.name || '').trim();
  if (!name) {
    return renderSettings(res, board.id, 400, 'La columna necesita un nombre');
  }

  const position = await BoardColumn.count({ where: { boardId: board.id } });
  await BoardColumn.create({ name, position, boardId: board.id });
  notifyBoardChanged(board.id);
  res.redirect(`/boards/${board.id}/settings`);
});

// Renombra una columna
router.post('/:id/columns/:columnId', async (req, res) => {
  const board = await requireAdmin(req, res);
  if (!board) return;

  const column = await BoardColumn.findOne({ where: { id: req.params.columnId, boardId: board.id } });
  const name = (req.body.name || '').trim();
  if (!column || !name) {
    return renderSettings(res, board.id, 400, 'La columna necesita un nombre');
  }

  column.name = name;
  await column.save();
  notifyBoardChanged(board.id);
  res.redirect(`/boards/${board.id}/settings`);
});

// Sube o baja una columna un puesto (intercambia su posición con la de al lado)
router.post('/:id/columns/:columnId/move', async (req, res) => {
  const board = await requireAdmin(req, res);
  if (!board) return;

  const columns = await BoardColumn.findAll({
    where: { boardId: board.id },
    order: [['position', 'ASC']],
  });
  const index = columns.findIndex((c) => c.id === Number(req.params.columnId));
  const otherIndex = req.body.direction === 'up' ? index - 1 : index + 1;

  if (index !== -1 && otherIndex >= 0 && otherIndex < columns.length) {
    const column = columns[index];
    const other = columns[otherIndex];
    await sequelize.transaction(async (t) => {
      const position = column.position;
      await column.update({ position: other.position }, { transaction: t });
      await other.update({ position }, { transaction: t });
    });
    notifyBoardChanged(board.id);
  }

  res.redirect(`/boards/${board.id}/settings`);
});

// Elimina una columna: solo si está vacía y no es la última del tablero
router.post('/:id/columns/:columnId/delete', async (req, res) => {
  const board = await requireAdmin(req, res);
  if (!board) return;

  const column = await BoardColumn.findOne({ where: { id: req.params.columnId, boardId: board.id } });
  if (!column) {
    return renderSettings(res, board.id, 404, 'La columna no existe');
  }

  const totalColumns = await BoardColumn.count({ where: { boardId: board.id } });
  if (totalColumns === 1) {
    return renderSettings(res, board.id, 400, 'Un tablero tiene que tener al menos una columna');
  }

  const cardsInColumn = await Card.count({ where: { columnId: column.id } });
  if (cardsInColumn > 0) {
    return renderSettings(res, board.id, 400, `No se puede eliminar "${column.name}" porque tiene tarjetas`);
  }

  await sequelize.transaction(async (t) => {
    const position = column.position;
    await column.destroy({ transaction: t });
    // Las columnas que estaban a su derecha se mueven un puesto a la izquierda
    await BoardColumn.decrement('position', {
      by: 1,
      where: { boardId: board.id, position: { [Op.gt]: position } },
      transaction: t,
    });
  });

  notifyBoardChanged(board.id);
  res.redirect(`/boards/${board.id}/settings`);
});

// Elimina el tablero entero, con sus columnas, tarjetas, comentarios y miembros
router.post('/:id/delete', async (req, res) => {
  const board = await requireAdmin(req, res);
  if (!board) return;

  const columns = await BoardColumn.findAll({ where: { boardId: board.id } });
  const columnIds = columns.map((c) => c.id);
  const cards = await Card.findAll({ where: { columnId: columnIds } });
  const cardIds = cards.map((c) => c.id);

  await sequelize.transaction(async (t) => {
    await Comment.destroy({ where: { cardId: cardIds }, transaction: t });
    await Card.destroy({ where: { id: cardIds }, transaction: t });
    await BoardColumn.destroy({ where: { boardId: board.id }, transaction: t });
    await Membership.destroy({ where: { boardId: board.id }, transaction: t });
    await board.destroy({ transaction: t });
  });

  notifyBoardChanged(board.id);
  res.redirect('/boards');
});

module.exports = router;

