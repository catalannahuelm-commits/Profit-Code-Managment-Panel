let _allTimeEntries = [];

window.Pages.timetrack = async function() {
  const kpis = document.getElementById('time-kpis');
  if (kpis && !kpis.children.length) kpis.innerHTML = '<div class="sk sk-kpi"></div><div class="sk sk-kpi"></div><div class="sk sk-kpi"></div><div class="sk sk-kpi"></div>';
  try {
    _allTimeEntries = await API.getTimeEntries();
    renderTimeKPIs();
    renderTodayTime();
    renderTimeHistory();
  } catch (err) {
    console.error('Error cargando time entries:', err);
  }
};

function renderTimeKPIs() {
  const el = document.getElementById('time-kpis');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  const thisWeekStart = new Date(); thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
  const weekStr = thisWeekStart.toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().slice(0, 7);

  const todayMin = _allTimeEntries.filter(e => e.date === today).reduce((s, e) => s + e.minutes, 0);
  const weekMin = _allTimeEntries.filter(e => e.date >= weekStr).reduce((s, e) => s + e.minutes, 0);
  const monthMin = _allTimeEntries.filter(e => e.date.startsWith(thisMonth)).reduce((s, e) => s + e.minutes, 0);
  const totalMin = _allTimeEntries.reduce((s, e) => s + e.minutes, 0);

  const fmt = (min) => `${Math.floor(min / 60)}h ${min % 60}m`;

  const kpis = [
    { label: t('time_today'), value: fmt(todayMin), color: '#1DB954' },
    { label: t('time_week'), value: fmt(weekMin), color: '#4A90D9' },
    { label: t('time_month'), value: fmt(monthMin), color: '#7B6CF6' },
    { label: t('time_total'), value: fmt(totalMin), color: '#F5A623' },
  ];

  el.innerHTML = kpis.map((k, i) => `
    <div class="dashboard-kpi" style="--kpi-accent:${k.color}; animation-delay:${i * 60}ms">
      <div class="kpi-top"><div>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}</div>
      </div></div>
    </div>
  `).join('');
}

function renderTodayTime() {
  const el = document.getElementById('time-today-list');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  const entries = _allTimeEntries.filter(e => e.date === today);

  if (entries.length === 0) {
    el.innerHTML = `<div class="empty-state" style="padding:20px"><p>${t('time_no_entries')}</p></div>`;
    return;
  }

  el.innerHTML = entries.map((e, i) => `
    <div class="meeting-item" style="--meeting-color:#7B6CF6; animation-delay:${i * 40}ms">
      <div class="meeting-accent" style="background:#7B6CF6"></div>
      <div class="meeting-body">
        <div class="meeting-header">
          <strong>${esc(e.description || e.task_title || t('time_no_desc'))}</strong>
          <button class="meeting-delete-btn" onclick="Pages.timetrack.delete(${e.id})" title="${t('delete')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
        <div class="meeting-meta">
          <span class="meeting-time-tag">🕐 ${Math.floor(e.minutes/60)}h ${e.minutes%60}m</span>
          ${e.project_name ? `<span class="meeting-date-tag">📁 ${esc(e.project_name)}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function renderTimeHistory() {
  const el = document.getElementById('time-history-list');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  const entries = _allTimeEntries.filter(e => e.date !== today).slice(0, 20);

  if (entries.length === 0) {
    el.innerHTML = `<div class="empty-state" style="padding:20px"><p>${t('time_no_history')}</p></div>`;
    return;
  }

  el.innerHTML = entries.map((e, i) => {
    const dateLabel = new Date(e.date + 'T12:00:00').toLocaleDateString(getDateLocale(), { day: 'numeric', month: 'short' });
    return `
    <div class="meeting-item" style="--meeting-color:#4A90D9; animation-delay:${i * 30}ms">
      <div class="meeting-accent" style="background:#4A90D9"></div>
      <div class="meeting-body">
        <div class="meeting-header">
          <strong>${esc(e.description || e.task_title || t('time_no_desc'))}</strong>
        </div>
        <div class="meeting-meta">
          <span class="meeting-date-tag">📅 ${dateLabel}</span>
          <span class="meeting-time-tag">🕐 ${Math.floor(e.minutes/60)}h ${e.minutes%60}m</span>
          ${e.project_name ? `<span>📁 ${esc(e.project_name)}</span>` : ''}
          ${e.user_name ? `<span>👤 ${esc(e.user_name)}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

window.Pages.timetrack.delete = async function(id) {
  if (!(await confirmDialog(t('confirm_delete')))) return;
  await API.deleteTimeEntry(id);
  clearCache('/api/time');
  window.Pages.timetrack();
};

window.Pages.timetrack.openNew = async function() {
  const [projects, tasks] = await Promise.all([API.getProjects(), API.getTasks()]);
  document.getElementById('time-project').innerHTML = `<option value="">${t('no_project')}</option>` + projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  document.getElementById('time-task').innerHTML = `<option value="">${t('time_no_task')}</option>` + tasks.map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join('');

  document.getElementById('form-time').reset();
  document.getElementById('modal-time').classList.add('active');
  upgradeSelects(document.getElementById('modal-time'));
  initDatePickers(document.getElementById('modal-time'));

  document.getElementById('form-time').onsubmit = async (e) => {
    e.preventDefault();
    const hours = parseInt(document.getElementById('time-hours').value) || 0;
    const mins = parseInt(document.getElementById('time-minutes').value) || 0;
    await API.createTimeEntry({
      project_id: document.getElementById('time-project').value || null,
      task_id: document.getElementById('time-task').value || null,
      minutes: hours * 60 + mins,
      date: document.getElementById('time-date').value || new Date().toISOString().split('T')[0],
      description: document.getElementById('time-desc').value,
    });
    document.getElementById('modal-time').classList.remove('active');
    clearCache('/api/time');
    window.Pages.timetrack();
    showToast(t('time_created'));
  };
};
