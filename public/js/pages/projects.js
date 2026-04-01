let _allProjects = [];

function getProjectStatus() {
  return {
    active:    { label: t('projects_status_active'),    color: '#4A90D9', icon: '▶' },
    completed: { label: t('projects_status_completed'), color: '#1DB954', icon: '✓' },
    paused:    { label: t('projects_status_paused'),    color: '#F5A623', icon: '⏸' },
    cancelled: { label: t('projects_status_cancelled'), color: '#E74C3C', icon: '✕' },
  };
}

window.Pages.projects = async function() {
  try {
    _allProjects = await API.getProjects();
    renderProjectsKPIs(_allProjects);
    renderProjectCards(_allProjects);
    const searchInput = document.getElementById('projects-search');
    if (searchInput) searchInput.placeholder = t('projects_search_ph');
    const newBtn = document.getElementById('btn-new-project');
    if (newBtn) newBtn.textContent = t('projects_new');
  } catch (err) {
    console.error('Error cargando proyectos:', err);
  }
};

window.Pages.projects.filter = function(query) {
  const q = query.toLowerCase();
  const filtered = _allProjects.filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.client_name && p.client_name.toLowerCase().includes(q))
  );
  renderProjectCards(filtered);
};

function renderProjectsKPIs(projects) {
  const container = document.getElementById('projects-kpis');
  const active = projects.filter(p => p.status === 'active').length;
  const completed = projects.filter(p => p.status === 'completed').length;
  const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0);

  const kpis = [
    { label: t('projects_total'), value: projects.length, color: '#7B6CF6' },
    { label: t('projects_active'), value: active, color: '#4A90D9' },
    { label: t('projects_completed'), value: completed, color: '#1DB954' },
    { label: t('projects_total_budget'), value: `$${totalBudget.toLocaleString()}`, color: '#F5A623' },
  ];

  container.innerHTML = kpis.map((k, i) => `
    <div class="project-kpi" style="--kpi-accent:${k.color}; animation-delay:${i * 60}ms">
      <div class="pkpi-label">${k.label}</div>
      <div class="pkpi-value">${k.value}</div>
    </div>
  `).join('');
}

function getDeadlineTag(deadline, status) {
  if (!deadline || status === 'completed') return '';
  const now = new Date();
  const dl = new Date(deadline);
  const diff = Math.ceil((dl - now) / (1000 * 60 * 60 * 24));

  if (diff < 0) return `<span class="project-deadline-tag overdue">${t('projects_overdue', { n: Math.abs(diff) })}</span>`;
  if (diff <= 7) return `<span class="project-deadline-tag" style="background:rgba(245,166,35,0.1);color:#F5A623">${t('projects_days_left', { n: diff })}</span>`;
  return `<span class="project-deadline-tag">${dl.toLocaleDateString(getDateLocale(), { day: 'numeric', month: 'short' })}</span>`;
}

function renderProjectCards(projects) {
  const grid = document.getElementById('projects-grid');
  const statuses = getProjectStatus();

  if (projects.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">📁</div><p>${t('projects_empty')}</p></div>`;
    return;
  }

  grid.innerHTML = projects.map((p, i) => {
    const st = statuses[p.status] || { label: p.status, color: '#7B6CF6', icon: '?' };
    const progress = p.status === 'completed' ? 100 : Math.min(Math.round((p.cost / (p.budget || 1)) * 100), 100);
    const profit = (p.budget || 0) - (p.cost || 0);

    return `
      <div class="project-card" style="--project-accent:${st.color}; animation-delay:${i * 40}ms">
        <div class="project-header-row">
          <div class="project-card-header">
            <h4>${esc(p.name)}</h4>
          </div>
          ${getDeadlineTag(p.deadline, p.status)}
        </div>
        <div class="project-client">${esc(p.client_name) || t('no_client')}</div>
        ${p.description ? `<div class="project-desc">${esc(p.description)}</div>` : ''}

        <div class="project-badges">
          <span class="badge" style="background:${st.color}15;color:${st.color}">${st.icon} ${st.label}</span>
        </div>

        <div class="progress-section">
          <div class="progress-header">
            <span>${t('projects_progress')}</span>
            <span>${progress}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-bar-fill" style="width:${progress}%;background:${st.color}"></div>
          </div>
        </div>

        <div class="project-meta">
          <div class="project-meta-item">
            <div>
              <div class="meta-label">${t('projects_budget_label')}</div>
              <div class="meta-value">$${(p.budget || 0).toLocaleString()}</div>
            </div>
          </div>
          <div class="project-meta-item">
            <div>
              <div class="meta-label">${t('projects_profitability')}</div>
              <div class="meta-value" style="color:${profit >= 0 ? '#1DB954' : '#E74C3C'}">$${profit.toLocaleString()}</div>
            </div>
          </div>
          <div class="project-meta-item">
            <div>
              <div class="meta-label">${t('projects_invested')}</div>
              <div class="meta-value">$${(p.cost || 0).toLocaleString()}</div>
            </div>
          </div>
          <div class="project-meta-item">
            <div>
              <div class="meta-label">${t('projects_delivery')}</div>
              <div class="meta-value">${p.deadline ? new Date(p.deadline).toLocaleDateString(getDateLocale(), { day: 'numeric', month: 'short' }) : '-'}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.Pages.projects.openNew = async function() {
  const clients = await API.getClients();
  const select = document.getElementById('project-client');
  select.innerHTML = `<option value="">${t('projects_select_client')}</option>` +
    clients.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');

  document.getElementById('modal-project').classList.add('active');
  upgradeSelects(document.getElementById('modal-project'));
  initDatePickers(document.getElementById('modal-project'));

  document.getElementById('form-project').onsubmit = async (e) => {
    e.preventDefault();
    await API.createProject({
      client_id: document.getElementById('project-client').value,
      name: document.getElementById('project-name').value,
      description: document.getElementById('project-description').value,
      budget: parseFloat(document.getElementById('project-budget').value) || 0,
      deadline: document.getElementById('project-deadline').value || null,
    });
    document.getElementById('modal-project').classList.remove('active');
    document.getElementById('form-project').reset();
    window.Pages.projects();
  };
};
