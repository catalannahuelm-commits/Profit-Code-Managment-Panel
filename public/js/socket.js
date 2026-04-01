// Notifications via polling (no Socket.io needed for Vercel)

let notifInterval = null;

function connectSocket() {
  // Poll notifications every 30 seconds
  updateNotificationCount();
  notifInterval = setInterval(updateNotificationCount, 30000);
}

function disconnectSocket() {
  if (notifInterval) {
    clearInterval(notifInterval);
    notifInterval = null;
  }
}

// === TOASTS ===
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div class="toast-title">Notificacion</div>
    <div class="toast-message">${esc(message)}</div>
  `;
  container.appendChild(toast);
  while (container.children.length > 3) container.removeChild(container.firstChild);
  setTimeout(() => toast.remove(), 4000);
}

// === PANEL ===
function toggleNotificationPanel() {
  const panel = document.getElementById('notification-panel');
  const isOpen = panel.classList.toggle('active');
  if (isOpen) loadNotifications();
}

document.addEventListener('click', (e) => {
  const panel = document.getElementById('notification-panel');
  const wrapper = e.target.closest('.notification-wrapper');
  if (!wrapper && panel && panel.classList.contains('active')) {
    panel.classList.remove('active');
  }
});

async function loadNotifications() {
  try {
    const notifications = await API.getNotifications();
    const list = document.getElementById('notification-list');

    if (notifications.length === 0) {
      list.innerHTML = '<div class="empty-state" style="padding:20px"><p>Sin notificaciones</p></div>';
      return;
    }

    list.innerHTML = notifications.map(n => `
      <div class="notification-item ${n.read ? '' : 'unread'}">
        <div class="notif-message">${esc(n.message)}</div>
        <div class="notif-time">${timeAgo(n.created_at)}</div>
      </div>
    `).join('');
  } catch {}
}

function markAllRead() {
  // Would need an API endpoint for this - skip for now
  document.querySelectorAll('.notification-item.unread').forEach(el => el.classList.remove('unread'));
  const badge = document.getElementById('notification-count');
  if (badge) badge.style.display = 'none';
}

function updateNotificationCount() {
  const badge = document.getElementById('notification-count');
  if (!badge) return;

  API.getNotifications().then(notifications => {
    const unread = notifications.filter(n => !n.read).length;
    if (unread > 0) {
      badge.textContent = unread > 9 ? '9+' : unread;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }).catch(() => {});
}

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'Ahora';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)}d`;
  return date.toLocaleDateString('es-AR');
}
