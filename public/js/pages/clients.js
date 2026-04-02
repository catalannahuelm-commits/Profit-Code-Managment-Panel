let _allClients = [];

const AVATAR_COLORS = ['#4A90D9', '#00B894', '#E84393', '#F39C12', '#6C5CE7', '#E74C3C', '#00CEC9', '#636E72'];

function getStageConfig() {
  return {
    lead:        { label: t('stage_lead'),        color: '#4A90D9' },
    proposal:    { label: t('stage_proposal'),     color: '#F5A623' },
    development: { label: t('stage_development'),  color: '#7B6CF6' },
    delivered:   { label: t('stage_delivered'),     color: '#1DB954' },
    paid:        { label: t('stage_paid'),          color: '#00CEC9' },
  };
}

window.Pages.clients = async function() {
  var grid = document.getElementById('clients-grid');
  if (grid && !grid.children.length) grid.innerHTML = '<div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div>';
  var kpis = document.getElementById('clients-kpis');
  if (kpis && !kpis.children.length) kpis.innerHTML = '<div class="sk sk-kpi"></div><div class="sk sk-kpi"></div><div class="sk sk-kpi"></div><div class="sk sk-kpi"></div>';
  try {
    _allClients = await API.getClients();
    renderClientsKPIs(_allClients);
    renderClientCards(_allClients);
    // Update static text
    const searchInput = document.getElementById('clients-search');
    if (searchInput) searchInput.placeholder = t('clients_search_ph');
    const newBtn = document.getElementById('btn-new-client');
    if (newBtn) newBtn.textContent = t('clients_new');
  } catch (err) {
    console.error('Error cargando clientes:', err);
  }
};

window.Pages.clients.filter = function(query) {
  const q = query.toLowerCase();
  const filtered = _allClients.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.company && c.company.toLowerCase().includes(q)) ||
    (c.email && c.email.toLowerCase().includes(q))
  );
  renderClientCards(filtered);
};

function renderClientsKPIs(clients) {
  const container = document.getElementById('clients-kpis');
  const active = clients.filter(c => c.pipeline_stage !== 'paid').length;
  const leads = clients.filter(c => c.pipeline_stage === 'lead').length;
  const dev = clients.filter(c => c.pipeline_stage === 'development').length;

  const kpis = [
    { label: t('clients_total'), value: clients.length, color: '#7B6CF6' },
    { label: t('clients_active'), value: active, color: '#1DB954' },
    { label: t('clients_leads'), value: leads, color: '#4A90D9' },
    { label: t('clients_in_dev'), value: dev, color: '#F5A623' },
  ];

  container.innerHTML = kpis.map((k, i) => `
    <div class="client-kpi" style="--kpi-accent:${k.color}; animation-delay:${i * 60}ms">
      <div class="ckpi-label">${k.label}</div>
      <div class="ckpi-value">${k.value}</div>
    </div>
  `).join('');
}

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function renderClientCards(clients) {
  const grid = document.getElementById('clients-grid');
  const stages = getStageConfig();

  if (clients.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">👥</div><p>${t('clients_empty')}</p></div>`;
    return;
  }

  grid.innerHTML = clients.map((c, i) => {
    const initial = c.name.charAt(0).toUpperCase();
    const color = getAvatarColor(c.name);
    const stage = stages[c.pipeline_stage] || { label: c.pipeline_stage, color: '#7B6CF6' };

    return `
      <div class="client-card" style="animation-delay:${i * 40}ms">
        <div class="client-card-header">
          <div class="client-avatar" style="background:${color}">${initial}</div>
          <div>
            <h4>${esc(c.name)}</h4>
            ${c.company ? `<div class="client-contact">${esc(c.company)}</div>` : ''}
          </div>
        </div>

        ${c.email ? `
          <div class="client-detail">
            <span class="detail-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></span>
            ${esc(c.email)}
          </div>
        ` : ''}

        ${c.phone ? `
          <div class="client-detail">
            <span class="detail-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></span>
            ${esc(c.phone)}
          </div>
        ` : ''}

        <div class="client-stage-footer">
          <button class="task-status-btn client-stage-btn" data-client-id="${c.id}" data-current="${c.pipeline_stage || 'lead'}" style="--status-color:${stage.color}" onclick="event.stopPropagation();Pages.clients.openStageMenu(this)">
            <span class="task-status-dot" style="background:${stage.color}"></span>
            ${esc(stage.label)}
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="client-actions">
            <button class="card-action-btn" title="${t('edit')}" onclick="Pages.clients.openEdit(${c.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="card-action-btn" title="${t('delete')}" onclick="event.stopPropagation();Pages.clients.delete(${c.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.Pages.clients.delete = async function(id) {
  if (!(await confirmDialog(t('confirm_delete')))) return;
  await API.deleteClient(id);
  clearCache('/api/clients');
  window.Pages.clients();
};

window.Pages.clients.openNew = function() {
  setupClientModal();
  document.getElementById('form-new-client').reset();
  openModal('modal-new-client');

  document.getElementById('form-new-client').onsubmit = async (e) => {
    e.preventDefault();
    await API.createClient(getClientFormData());
    closeModal('modal-new-client');
    document.getElementById('form-new-client').reset();
    window.Pages.clients();
  };
};

window.Pages.clients.openEdit = function(id) {
  const c = _allClients.find(cl => cl.id === id);
  if (!c) return;
  setupClientModal();
  document.getElementById('new-client-name').value = c.name || '';
  document.getElementById('new-client-company').value = c.company || '';
  document.getElementById('new-client-email').value = c.email || '';
  document.getElementById('new-client-phone').value = c.phone || '';
  document.getElementById('new-client-notes').value = c.notes || '';
  openModal('modal-new-client');

  document.getElementById('form-new-client').onsubmit = async (e) => {
    e.preventDefault();
    await API.updateClient(id, getClientFormData());
    closeModal('modal-new-client');
    document.getElementById('form-new-client').reset();
    window.Pages.clients();
  };
};

window.Pages.clients.openStageMenu = function(btn) {
  const existing = document.getElementById('floating-stage-menu');
  if (existing) { existing.remove(); return; }

  const clientId = parseInt(btn.dataset.clientId);
  const currentStage = btn.dataset.current;
  const stages = getStageConfig();
  const rect = btn.getBoundingClientRect();

  const menu = document.createElement('div');
  menu.id = 'floating-stage-menu';
  menu.className = 'task-status-menu';
  menu.style.cssText = `display:block;position:fixed;top:${rect.bottom + 6}px;left:${rect.left}px;z-index:99999;width:180px;`;
  menu.innerHTML = Object.entries(stages).map(([key, s]) => `
    <div class="task-status-option ${key === currentStage ? 'active' : ''}" data-value="${key}" style="--opt-color:${s.color}">
      <span class="task-status-opt-dot" style="background:${s.color}"></span>
      ${esc(s.label)}
    </div>
  `).join('');
  document.body.appendChild(menu);

  menu.querySelectorAll('.task-status-option').forEach(opt => {
    opt.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      menu.remove();
      await API.updateClient(clientId, { pipeline_stage: opt.dataset.value });
      clearCache('/api/clients');
      window.Pages.clients();
      showToast(t('clients_stage_updated') || 'Etapa actualizada');
    });
  });

  setTimeout(() => {
    document.addEventListener('click', function close() {
      const m = document.getElementById('floating-stage-menu');
      if (m) m.remove();
      document.removeEventListener('click', close);
    }, { once: true });
  }, 10);
};

function setupClientModal() {
  const modal = document.getElementById('modal-new-client');
  modal.querySelector('h2').textContent = t('clients_modal_title');
  modal.querySelectorAll('label').forEach(label => {
    const map = { 'Nombre': 'name', 'Empresa': 'clients_company', 'Email': 'email', 'Teléfono': 'phone', 'Notas': 'notes' };
    for (const [es, key] of Object.entries(map)) {
      if (label.textContent.trim() === es) label.textContent = t(key);
    }
  });
  const submitBtn = modal.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = t('clients_create');
  const cancelBtn = modal.querySelector('.btn-ghost');
  if (cancelBtn) cancelBtn.textContent = t('cancel');
}

function getClientFormData() {
  return {
    name: document.getElementById('new-client-name').value,
    company: document.getElementById('new-client-company').value,
    email: document.getElementById('new-client-email').value,
    phone: document.getElementById('new-client-phone').value,
    notes: document.getElementById('new-client-notes').value,
  };
}
