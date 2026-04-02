const NOTE_COLORS = ['#7B6CF6','#E84393','#4A90D9','#1DB954','#F5A623','#00CEC9','#d05a4f'];

const BADGE_ICONS = ['⭐','🏆','🔥','💎','👑','🎯','⚡','💪','🚀','🌟','❤️','🎖️'];
const BADGE_COLORS_PICK = ['#F5A623','#7B6CF6','#E74C3C','#1DB954','#4A90D9','#E84393','#00CEC9'];

window.Pages.profile = async function() {
  try {
    const [profile, notes, badgeData] = await Promise.all([
      API.getProfile(),
      API.getNotes(),
      API.checkBadges().then(() => API.getBadges())
    ]);
    renderProfileHeader(profile);
    fillForm(profile);
    renderNotes(notes);
    renderBadges(badgeData);
    renderBadgeIcons(badgeData);
    setupHandlers(profile);

    // Hide give badge button for non-owners
    const giveBtn = document.getElementById('btn-give-badge');
    if (giveBtn && window.currentUser.role !== 'owner') giveBtn.style.display = 'none';
  } catch (err) {
    console.error('Error cargando perfil:', err);
  }
};

function renderProfileHeader(p) {
  const avatar = document.getElementById('profile-avatar');
  if (p.avatar) {
    avatar.innerHTML = `<img src="${p.avatar}" alt="${esc(p.name)}">`;
    avatar.classList.add('has-img');
  } else {
    avatar.textContent = p.name.charAt(0).toUpperCase();
  }

  document.getElementById('profile-display-name').textContent = p.name;
  document.getElementById('profile-role').textContent = p.role === 'owner' ? t('owner') : t('employee');
  document.getElementById('profile-email-display').textContent = p.email;

  if (p.created_at) {
    const d = new Date(p.created_at);
    document.getElementById('profile-since').textContent = t('profile_member_since', { date: d.toLocaleDateString(getDateLocale(), { month: 'long', year: 'numeric' }) });
  }
}

function fillForm(p) {
  document.getElementById('profile-name').value = p.name || '';
  document.getElementById('profile-email').value = p.email || '';
  document.getElementById('profile-phone').value = p.phone || '';
  document.getElementById('profile-bio').value = p.bio || '';
}

function setupHandlers() {
  // Avatar upload
  const wrapper = document.getElementById('profile-avatar-wrapper');
  const fileInput = document.getElementById('avatar-input');
  let uploading = false;

  // Avatar upload disabled

  // Profile form
  document.getElementById('form-profile').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const updated = await API.updateProfile({
        name: document.getElementById('profile-name').value,
        email: document.getElementById('profile-email').value,
        phone: document.getElementById('profile-phone').value,
        bio: document.getElementById('profile-bio').value,
      });
      renderProfileHeader(updated);
      // Update global user
      window.currentUser.name = updated.name;
      window.currentUser.email = updated.email;
      const userNameEl = document.getElementById('user-name');
      if (userNameEl) userNameEl.textContent = updated.name;
      const headerAvatar = document.getElementById('header-avatar');
      if (headerAvatar && !updated.avatar) headerAvatar.textContent = updated.name.charAt(0).toUpperCase();
      showToast(t('profile_updated'));
    } catch (err) {
      showToast(err.message);
    }
  };

  // Password form
  document.getElementById('form-password').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await API.updatePassword({
        current: document.getElementById('pw-current').value,
        password: document.getElementById('pw-new').value,
      });
      document.getElementById('form-password').reset();
      showToast(t('profile_pass_updated'));
    } catch (err) {
      showToast(err.message);
    }
  };
}

// --- NOTES ---

function renderNotes(notes) {
  const container = document.getElementById('notes-list');
  if (notes.length === 0) {
    container.innerHTML = `<div class="notes-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted)"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg><p>${t('profile_no_notes')}</p></div>`;
    return;
  }

  container.innerHTML = notes.map((n, i) => `
    <div class="note-card" style="--note-color:${esc(n.color)}; animation-delay:${i * 50}ms">
      <div class="note-card-top">
        <input class="note-title-input" value="${esc(n.title)}" placeholder="Sin título" data-id="${n.id}" data-field="title">
        <div class="note-actions">
          <button class="note-color-btn" data-id="${n.id}" title="Color">
            <span style="background:${esc(n.color)}"></span>
          </button>
          <button class="note-delete-btn" data-id="${n.id}" title="Eliminar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
      <textarea class="note-content-input" placeholder="Escribí tu nota..." data-id="${n.id}" data-field="content">${esc(n.content)}</textarea>
      <div class="note-footer">
        <span>${new Date(n.updated_at).toLocaleDateString(getDateLocale(), { day: 'numeric', month: 'short' })}</span>
      </div>
    </div>
  `).join('');

  // Auto-save on blur
  container.querySelectorAll('.note-title-input, .note-content-input').forEach(input => {
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => saveNote(input), 800);
    });
  });

  // Delete
  container.querySelectorAll('.note-delete-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm(t('profile_confirm_delete_note'))) return;
      await API.deleteNote(btn.dataset.id);
      const notes = await API.getNotes();
      renderNotes(notes);
      showToast(t('profile_note_deleted'));
    };
  });

  // Color picker
  container.querySelectorAll('.note-color-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      showColorPicker(btn, btn.dataset.id);
    };
  });
}

async function saveNote(input) {
  const id = input.dataset.id;
  const field = input.dataset.field;
  const value = field === 'content' ? input.value : input.value;
  await API.updateNote(id, { [field]: value });
}

function showColorPicker(anchor, noteId) {
  document.querySelectorAll('.note-color-picker').forEach(p => p.remove());

  const picker = document.createElement('div');
  picker.className = 'note-color-picker';
  picker.innerHTML = NOTE_COLORS.map(c =>
    `<button class="note-color-opt" style="background:${c}" data-color="${c}"></button>`
  ).join('');

  anchor.parentElement.appendChild(picker);

  picker.querySelectorAll('.note-color-opt').forEach(opt => {
    opt.onclick = async (e) => {
      e.stopPropagation();
      const color = opt.dataset.color;
      await API.updateNote(noteId, { color });
      const card = anchor.closest('.note-card');
      card.style.setProperty('--note-color', color);
      anchor.querySelector('span').style.background = color;
      picker.remove();
    };
  });

  document.addEventListener('click', () => picker.remove(), { once: true });
}

function renderBadgeIcons(data) {
  const container = document.getElementById('profile-badge-icons');
  if (!container) return;
  const all = [...data.unlocked, ...data.manual];
  container.innerHTML = all.map(b =>
    `<span class="profile-badge-icon" title="${esc(b.title)}" style="--badge-color:${esc(b.color)}">${esc(b.icon)}</span>`
  ).join('');
}

// --- BADGES ---

function renderBadges(data) {
  const unlockedEl = document.getElementById('badges-unlocked');
  const lockedEl = document.getElementById('badges-locked');

  const unlockedKeys = new Set(data.unlocked.map(b => b.key));
  const locked = data.catalog.filter(b => !unlockedKeys.has(b.key));

  // Unlocked auto + manual
  const allUnlocked = [...data.unlocked, ...data.manual];

  if (allUnlocked.length === 0) {
    unlockedEl.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem;">${t('profile_no_badges')}</p>`;
  } else {
    unlockedEl.innerHTML = allUnlocked.map((b, i) => `
      <div class="badge-card unlocked" style="--badge-color:${esc(b.color)}; animation-delay:${i * 60}ms">
        <div class="badge-icon-display">${esc(b.icon)}</div>
        <div class="badge-info">
          <div class="badge-title">${esc(b.title)}</div>
          <div class="badge-desc">${esc(b.desc || b.reason || '')}</div>
        </div>
        ${b.type === 'manual' ? `<div class="badge-given">${t('profile_given_by', { name: esc(b.given_by_name) })}</div>` : ''}
        ${b.tier ? `<div class="badge-tier badge-tier-${b.tier}"></div>` : ''}
      </div>
    `).join('');
  }

  // Locked
  if (locked.length === 0) {
    document.getElementById('badges-locked-header').style.display = 'none';
    lockedEl.innerHTML = '';
  } else {
    lockedEl.innerHTML = locked.map(b => `
      <div class="badge-card locked">
        <div class="badge-icon-display locked-icon">${esc(b.icon)}</div>
        <div class="badge-info">
          <div class="badge-title">${esc(b.title)}</div>
          <div class="badge-desc">${esc(b.desc)}</div>
        </div>
        ${b.tier ? `<div class="badge-tier badge-tier-${b.tier}"></div>` : ''}
      </div>
    `).join('');
  }
}

window.Pages.profile.openGiveBadge = async function() {
  const users = await API.request('GET', '/api/team/workload');
  document.getElementById('badge-user').innerHTML = users.map(u =>
    `<option value="${u.id}">${esc(u.name)}</option>`
  ).join('');

  // Icon picker
  const iconPicker = document.getElementById('badge-icon-picker');
  iconPicker.innerHTML = BADGE_ICONS.map(ic =>
    `<button type="button" class="badge-pick-opt ${ic === '⭐' ? 'active' : ''}" data-val="${ic}">${ic}</button>`
  ).join('');
  iconPicker.querySelectorAll('.badge-pick-opt').forEach(btn => {
    btn.onclick = () => {
      iconPicker.querySelectorAll('.badge-pick-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('badge-icon').value = btn.dataset.val;
    };
  });

  // Color picker
  const colorPicker = document.getElementById('badge-color-picker');
  colorPicker.innerHTML = BADGE_COLORS_PICK.map(c =>
    `<button type="button" class="badge-color-opt ${c === '#F5A623' ? 'active' : ''}" style="background:${c}" data-val="${c}"></button>`
  ).join('');
  colorPicker.querySelectorAll('.badge-color-opt').forEach(btn => {
    btn.onclick = () => {
      colorPicker.querySelectorAll('.badge-color-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('badge-color').value = btn.dataset.val;
    };
  });

  document.getElementById('modal-give-badge').classList.add('active');
  upgradeSelects(document.getElementById('modal-give-badge'));

  document.getElementById('form-give-badge').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await API.giveBadge({
        user_id: parseInt(document.getElementById('badge-user').value),
        title: document.getElementById('badge-title').value,
        icon: document.getElementById('badge-icon').value,
        color: document.getElementById('badge-color').value,
        reason: document.getElementById('badge-reason').value,
      });
      document.getElementById('modal-give-badge').classList.remove('active');
      document.getElementById('form-give-badge').reset();
      showToast(t('profile_badge_given'));
      const badgeData = await API.getBadges();
      renderBadges(badgeData);
    } catch (err) {
      showToast(err.message);
    }
  };
};

window.Pages.profile.addNote = async function() {
  await API.createNote({ title: '', content: '', color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)] });
  const notes = await API.getNotes();
  renderNotes(notes);
  // Focus the new note
  const first = document.querySelector('.note-title-input');
  if (first) first.focus();
};
