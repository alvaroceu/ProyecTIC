const { Server } = require('socket.io');
const sessionMiddleware = require('../config/session');
const { Membership } = require('../database');

let io;

// Arranca Socket.IO sobre el servidor HTTP y comparte la sesión de Express
function init(httpServer) {
  io = new Server(httpServer);
  io.engine.use(sessionMiddleware);

  io.on('connection', (socket) => {
    const user = socket.request.session.user;
    if (!user) {
      return socket.disconnect();
    }

    // El navegador pide entrar en la "sala" de un tablero. Solo le dejamos si es miembro
    socket.on('join-board', async (boardId) => {
      const membership = await Membership.findOne({ where: { userId: user.id, boardId } });
      if (membership) {
        socket.join(`board-${boardId}`);
      }
    });
  });
}

// Avisa a todos los que están viendo el tablero de que ha cambiado (menos a quien lo ha cambiado)
function notifyBoardChanged(boardId, exceptSocketId) {
  if (!io) return;
  let room = io.to(`board-${boardId}`);
  if (exceptSocketId) {
    room = room.except(exceptSocketId);
  }
  room.emit('board-changed');
}

module.exports = { init, notifyBoardChanged };
