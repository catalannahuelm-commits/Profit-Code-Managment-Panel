const CHAT_COLORS = ['#7B6CF6','#E84393','#4A90D9','#1DB954','#F5A623','#00CEC9','#E74C3C'];
let _chatPollInterval = null;
let _chatRenderedIds = new Set();

window.Pages.chat = async function() {
  clearChatBadge();
  _chatRenderedIds = new Set();
  try {
    const messages = await API.getChat();
    renderChatFull(messages);
    setupChatInput();
    if (_chatPollInterval) clearInterval(_chatPollInterval);
    _chatPollInterval = setInterval(pollNewMessages, 4000);
  } catch (err) {
    console.error('Error cargando chat:', err);
  }
};

async function pollNewMessages() {
  try {
    clearCache('/api/chat');
    const msgs = await API.getChat();
    const container = document.getElementById('chat-messages');
    if (!container) return;
    let added = false;
    msgs.forEach(m => {
      if (!_chatRenderedIds.has(m.id)) {
        _chatRenderedIds.add(m.id);
        container.appendChild(buildMsgEl(m));
        added = true;
      }
    });
    if (added) container.scrollTop = container.scrollHeight;
  } catch {}
}

function getChatColor(userId) {
  return CHAT_COLORS[(userId || 0) % CHAT_COLORS.length];
}

function buildMsgEl(m) {
  const myId = window.currentUser?.id;
  const isMine = m.user_id === myId;
  const color = getChatColor(m.user_id);
  const time = new Date(m.created_at).toLocaleTimeString(getDateLocale(), { hour: '2-digit', minute: '2-digit' });

  const div = document.createElement('div');
  div.className = `chat-msg ${isMine ? 'mine' : 'other'}`;
  div.dataset.msgId = m.id;
  div.innerHTML = `
    ${!isMine ? `<div class="chat-avatar" style="background:${color}">${(m.user_name || '?').charAt(0)}</div>` : ''}
    <div class="chat-bubble ${isMine ? 'mine' : ''}">
      ${!isMine ? `<div class="chat-name" style="color:${color}">${esc(m.user_name || '?')}</div>` : ''}
      <div class="chat-text">${esc(m.message)}</div>
      <div class="chat-time">${time}</div>
    </div>
  `;
  return div;
}

function renderChatFull(messages) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  if (messages.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:40px"><div class="icon">💬</div><p>${t('chat_empty')}</p></div>`;
    return;
  }

  container.innerHTML = '';
  messages.forEach(m => {
    _chatRenderedIds.add(m.id);
    container.appendChild(buildMsgEl(m));
  });
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
  input.focus();
  try {
    const result = await API.sendChat(msg);
    // Append immediately without re-rendering
    const container = document.getElementById('chat-messages');
    // Remove empty state if present
    const empty = container.querySelector('.empty-state');
    if (empty) empty.remove();
    if (result && result.id) {
      _chatRenderedIds.add(result.id);
      container.appendChild(buildMsgEl(result));
      container.scrollTop = container.scrollHeight;
    }
  } catch (err) {
    showToast(err.message);
  }
};
