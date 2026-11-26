// Arrastrar y soltar tarjetas entre columnas (RF5)
const container = document.querySelector('.kanban-container');
const boardId = container.dataset.boardId;
let dragged = null;

// Cuando empiezas a arrastrar una tarjeta, la recordamos
document.querySelectorAll('.kanban-card[draggable="true"]').forEach((card) => {
  card.addEventListener('dragstart', (e) => {
    dragged = card;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.dataset.cardId); // Safari y Firefox lo necesitan
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
  });
});

// Devuelve la tarjeta que queda justo debajo del ratón (o undefined si es al final)
function getCardBelow(list, mouseY) {
  const cards = [...list.querySelectorAll('.kanban-card:not(.dragging)')];
  return cards.find((card) => {
    const box = card.getBoundingClientRect();
    return mouseY < box.top + box.height / 2;
  });
}

// Escuchamos en toda la columna (no solo en la lista), así se puede soltar en cualquier sitio de ella
document.querySelectorAll('.kanban-column').forEach((column) => {
  const list = column.querySelector('.kanban-cards-list');

  // Mientras arrastras por encima de la columna, la tarjeta se coloca donde iría
  column.addEventListener('dragover', (e) => {
    if (!dragged) return;
    e.preventDefault();
    const below = getCardBelow(list, e.clientY);
    if (below) {
      list.insertBefore(dragged, below);
    } else {
      list.appendChild(dragged);
    }
  });

  // Al soltar, se lo contamos al servidor
  column.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (!dragged) return;

    const position = [...list.querySelectorAll('.kanban-card')].indexOf(dragged);
    const body = new URLSearchParams({ columnId: list.dataset.columnId, position });

    await fetch(`/boards/${boardId}/cards/${dragged.dataset.cardId}/move`, {
      method: 'POST',
      headers: { 'X-Socket-Id': socket.id },
      body,
    });

    dragged = null;
    window.location.reload();
  });
});