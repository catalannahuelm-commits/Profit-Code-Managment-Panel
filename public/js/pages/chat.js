const CHAT_COLORS = ['#7B6CF6','#E84393','#4A90D9','#1DB954','#F5A623','#00CEC9','#E74C3C'];
let _chatPollInterval = null;

window.Pages.chat = async function() {
  try {
    const messages = await API.getChat();
    renderChat(messages);
    setupChatInput();
    // Poll every 5s
    if (_chatPollInterval) clearInterval(_chatPollInterval);
    _chatPollInterval = setInterval(async () => {
      try {
        clearCache('/api/chat');
        const msgs = await API.getChat();
        renderChat(msgs);
      } catch {}
    }, 5000);
  } catch (err) {
    console.error('Error cargando chat:', err);
  }
};

function getChatColor(userId) {
  return CHAT_COLORS[(userId || 0) % CHAT_COLORS.length];
}

function renderChat(messages) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  if (messages.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:40px"><div class="icon">💬</div><p>${t('chat_empty')}</p></div>`;
    return;
  }

  const myId = window.currentUser?.id;
  container.innerHTML = messages.map(m => {
    const isMine = m.user_id === myId;
    const color = getChatColor(m.user_id);
    const time = new Date(m.created_at).toLocaleTimeString(getDateLocale(), { hour: '2-digit', minute: '2-digit' });

    return `
      <div class="chat-msg ${isMine ? 'mine' : 'other'}">
        ${!isMine ? `<div class="chat-avatar" style="background:${color}">${(m.user_name || '?').charAt(0)}</div>` : ''}
        <div class="chat-bubble ${isMine ? 'mine' : ''}">
          ${!isMine ? `<div class="chat-name" style="color:${color}">${esc(m.user_name || '?')}</div>` : ''}
          <div class="chat-text">${esc(m.message)}</div>
          <div class="chat-time">${time}</div>
        </div>
      </div>
    `;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

function setupChatInput() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  input.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      Pages.chat.send();
    }
  };
  input.focus();
}

window.Pages.chat.send = async function() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  try {
    clearCache('/api/chat');
    await API.sendChat(msg);
    const messages = await API.getChat();
    renderChat(messages);
  } catch (err) {
    showToast(err.message);
  }
};

// Cleanup on page change
const _origNavigateTo = window._origNavigateTo || null;
