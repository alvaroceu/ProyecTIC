// Tiempo real (RF8): si alguien cambia este tablero, se recarga solo
const socket = io();
const realtimeBoardId = document.querySelector('.kanban-container').dataset.boardId;

// Al conectarse (y si se reconecta), entra en la sala del tablero
socket.on('connect', () => {
  socket.emit('join-board', realtimeBoardId);
});

// Cuando el servidor avisa de un cambio, recargamos para ver la versión nueva
socket.on('board-changed', () => {
  window.location.reload();
});