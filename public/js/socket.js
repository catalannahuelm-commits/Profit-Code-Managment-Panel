// Notifications via polling (no Socket.io needed for Vercel)

let notifInterval = null;
let _chatPollGlobal = null;
let _lastChatCount = -1;
let _lastChatId = 0;

function connectSocket() {
  updateNotificationCount();
  notifInterval = setInterval(updateNotificationCount, 60000);
  // Global chat poll — notify when new messages arrive
  startChatNotifier();
}

function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function startChatNotifier() {
  requestNotifPermission();
  if (_chatPollGlobal) clearInterval(_chatPollGlobal);
  // Initial load to set baseline
  API.getChat().then(msgs => {
    _lastChatCount = msgs.length;
    _lastChatId = msgs.length ? msgs[msgs.length - 1].id : 0;
  }).catch(() => {});

  _chatPollGlobal = setInterval(async () => {
    // Skip if user is on chat page (it has its own poll)
    if (window._currentPage === 'chat') return;
    try {
      clearCache('/api/chat');
      const msgs = await API.getChat();
      if (_lastChatCount < 0) { _lastChatCount = msgs.length; _lastChatId = msgs.length ? msgs[msgs.length - 1].id : 0; return; }
      if (msgs.length > _lastChatCount) {
        const newMsgs = msgs.filter(m => m.id > _lastChatId && m.user_id !== window.currentUser?.id);
        if (newMsgs.length) {
          const last = newMsgs[newMsgs.length - 1];
          showToast(`💬 ${last.user_name}: ${last.message.substring(0, 60)}${last.message.length > 60 ? '...' : ''}`);
          updateChatBadge(newMsgs.length);
          // Browser notification if permitted
          if (Notification.permission === 'granted') {
            new Notification('Profit Code — Chat', { body: `${last.user_name}: ${last.message.substring(0, 100)}`, icon: '/img/icon-192.png' });
          }
        }
      }
      _lastChatCount = msgs.length;
      _lastChatId = msgs.length ? msgs[msgs.length - 1].id : 0;
    } catch {}
  }, 8000);
}

function updateChatBadge(count) {
  const chatLink = document.querySelector('a[data-page="chat"]');
  if (!chatLink) return;
  let badge = chatLink.querySelector('.chat-badge');
  if (count > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'chat-badge';
      chatLink.appendChild(badge);
    }
    badge.textContent = count > 9 ? '9+' : count;
  } else if (badge) {
    badge.remove();
  }
}

// Clear chat badge when entering chat page
function clearChatBadge() {
  const badge = document.querySelector('.chat-badge');
  if (badge) badge.remove();
  // Reset baseline
  API.getChat().then(msgs => {
    _lastChatCount = msgs.length;
    _lastChatId = msgs.length ? msgs[msgs.length - 1].id : 0;
  }).catch(() => {});
}

function disconnectSocket() {
  if (notifInterval) {
    clearInterval(notifInterval);
    notifInterval = null;
  }
}

// Fix modals inside transformed parents — move to body
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  if (modal.parentElement !== document.body) {
    modal._originalParent = modal.parentElement;
    modal._originalNext = modal.nextSibling;
    document.body.appendChild(modal);
  }
  modal.classList.add('active');
  modal.scrollTop = 0;
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('active');
  const form = modal.querySelector('form');
  if (form) form.reset();
  if (modal._originalParent) {
    modal._originalParent.insertBefore(modal, modal._originalNext);
    delete modal._originalParent;
    delete modal._originalNext;
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
