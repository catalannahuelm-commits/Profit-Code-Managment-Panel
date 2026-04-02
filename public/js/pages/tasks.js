function getStatusOptions() {
  return [
    { value: 'pending', label: t('status_pending'), color: '#F5A623' },
    { value: 'in_progress', label: t('status_in_progress'), color: '#7B6CF6' },
    { value: 'done', label: t('status_done'), color: '#1DB954' },
  ];
}

function getPriorityConfig() {
  return {
    high: { label: t('priority_high'), color: '#E74C3C', icon: '▲' },
    medium: { label: t('priority_medium'), color: '#F5A623', icon: '■' },
    low: { label: t('priority_low'), color: '#1DB954', icon: '▼' },
  };
}

let _allTasks = [];

window.Pages.tasks = async function() {
  var list = document.getElementById('tasks-list');
  if (list && !list.children.length) list.innerHTML = '<div class="sk sk-row"></div><div class="sk sk-row"></div><div class="sk sk-row"></div><div class="sk sk-row"></div>';
  try {
    _allTasks = await API.getTasks();
    updateSummary(_allTasks);
    updateCounts(_allTasks);
    renderTasks(_allTasks);

    const filterContainer = document.querySelector('.task-filter')?.parentElement;
    if (filterContainer) {
      filterContainer.onclick = (e) => {
        const btn = e.target.closest('.task-filter');
        if (!btn) return;
        filterContainer.querySelectorAll('.task-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        const filtered = filter === 'all' ? _allTasks : _allTasks.filter(t => t.status === filter);
        renderTasks(filtered);
      };
    }
  } catch (err) {
    console.error('Error cargando tareas:', err);
  }
};

function updateSummary(tasks) {
  const el = document.getElementById('tasks-summary');
  if (!el) return;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const done = tasks.filter(t => t.status === 'done').length;
  const total = tasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  // Overdue
  const today = new Date().toISOString().split('T')[0];
  const overdue = tasks.filter(t => t.deadline && t.deadline < today && t.status !== 'done').length;

  el.innerHTML = `
    <div class="task-kpi">
      <div class="task-kpi-value">${total}</div>
      <div class="task-kpi-label">${t('tasks_total')}</div>
    </div>
    <div class="task-kpi">
      <div class="task-kpi-value" style="color:#F5A623">${pending}</div>
      <div class="task-kpi-label">${t('tasks_pending')}</div>
    </div>
    <div class="task-kpi">
      <div class="task-kpi-value" style="color:#7B6CF6">${inProgress}</div>
      <div class="task-kpi-label">${t('tasks_in_progress')}</div>
    </div>
    <div class="task-kpi">
      <div class="task-kpi-value" style="color:#1DB954">${done}</div>
      <div class="task-kpi-label">${t('tasks_done')}</div>
    </div>
    <div class="task-kpi">
      <div class="task-kpi-value" style="color:${overdue > 0 ? '#E74C3C' : 'var(--text-muted)'}">${overdue}</div>
      <div class="task-kpi-label">${t('tasks_overdue')}</div>
    </div>
    <div class="task-kpi task-kpi-progress">
      <div class="task-progress-bar">
        <div class="task-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="task-kpi-label">${pct}% ${t('tasks_completed_pct')}</div>
    </div>
  `;
}

function updateCounts(tasks) {
  const counts = { all: tasks.length, pending: 0, in_progress: 0, done: 0 };
  tasks.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });
  Object.keys(counts).forEach(k => {
    const el = document.getElementById('count-' + k);
    if (el) el.textContent = counts[k];
  });
}

function deadlineLabel(deadline, status) {
  if (!deadline || status === 'done') return deadline ? `<span class="task-card-deadline">${esc(deadline)}</span>` : '';
  const today = new Date();
  today.setHours(0,0,0,0);
  const dl = new Date(deadline + 'T00:00:00');
  const diff = Math.ceil((dl - today) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `<span class="task-card-deadline overdue"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> ${t('tasks_overdue_days', { n: Math.abs(diff) })}</span>`;
  if (diff === 0) return `<span class="task-card-deadline today">${t('tasks_today')}</span>`;
  if (diff <= 3) return `<span class="task-card-deadline soon">${t('tasks_days_left', { n: diff })}</span>`;
  return `<span class="task-card-deadline">${esc(deadline)}</span>`;
}

function renderTasks(tasks) {
  const container = document.getElementById('tasks-list');

  if (tasks.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">✅</div><p>${t('tasks_empty')}</p></div>`;
    return;
  }

  container.innerHTML = tasks.map((t, i) => {
    const statusOpts = getStatusOptions();
    const priConfig = getPriorityConfig();
    const current = statusOpts.find(s => s.value === t.status) || statusOpts[0];
    const pri = priConfig[t.priority] || priConfig.medium;
    return `
    <div class="card task-card" data-task-id="${t.id}" style="--pri-color:${pri.color}; animation-delay:${i * 40}ms">
      <div class="task-card-accent" style="background:${pri.color}"></div>
      <div class="task-card-body">
        <div class="task-card-left">
          <div class="task-card-header">
            <strong class="task-card-title">${esc(t.title)}</strong>
          </div>
          <div class="task-card-meta">
            <span class="task-priority-tag" style="--pri-color:${pri.color}">
              <span>${pri.icon}</span> ${esc(pri.label)}
            </span>
            ${t.project_name ? `<span class="task-card-project"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> ${esc(t.project_name)}</span>` : ''}
            ${t.assigned_name ? `<span class="task-card-assignee"><span class="task-avatar">${esc(t.assigned_name.charAt(0))}</span> ${esc(t.assigned_name)}</span>` : ''}
          </div>
        </div>
        <div class="task-card-right">
          ${deadlineLabel(t.deadline, t.status)}
          <button class="meeting-delete-btn" onclick="event.stopPropagation();Pages.tasks.delete(${t.id})" title="${window.t ? t('delete') : 'Eliminar'}" style="opacity:0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
          <div class="task-status-dropdown" data-task-id="${t.id}" data-current="${esc(t.status)}">
            <button class="task-status-btn" style="--status-color: ${current.color}">
              <span class="task-status-dot" style="background: ${current.color}"></span>
              ${esc(current.label)}
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <div class="task-status-menu">
              ${statusOpts.map(s => `
                <div class="task-status-option ${s.value === t.status ? 'active' : ''}" data-value="${s.value}" style="--opt-color: ${s.color}">
                  <span class="task-status-opt-dot" style="background: ${s.color}"></span>
                  ${esc(s.label)}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  // Dropdowns
  container.querySelectorAll('.task-status-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dropdown = btn.closest('.task-status-dropdown');
      const wasOpen = dropdown.classList.contains('open');
      container.querySelectorAll('.task-status-dropdown.open').forEach(d => {
        d.classList.remove('open');
        d.closest('.task-card').style.zIndex = '';
      });
      if (!wasOpen) {
        dropdown.classList.add('open');
        dropdown.closest('.task-card').style.zIndex = '100';
      }
    });
  });

  container.querySelectorAll('.task-status-option').forEach(opt => {
    opt.addEventListener('click', async (e) => {
      e.stopPropagation();
      const dropdown = opt.closest('.task-status-dropdown');
      const taskId = parseInt(dropdown.dataset.taskId);
      const newStatus = opt.dataset.value;
      dropdown.classList.remove('open');
      dropdown.closest('.task-card').style.zIndex = '';
      await updateTaskStatus(taskId, newStatus);
      window.Pages.tasks();
    });
  });

  // Close on outside click
  document.addEventListener('click', () => {
    container.querySelectorAll('.task-status-dropdown.open').forEach(d => {
      d.classList.remove('open');
      d.closest('.task-card').style.zIndex = '';
    });
  });
}

function statusText(status) {
  const map = { pending: 'Pendiente', in_progress: 'En Proceso', done: 'Terminada' };
  return map[status] || status;
}

async function updateTaskStatus(taskId, status) {
  try {
    await API.updateTask(taskId, { status });
  } catch (err) {
    alert('Error al actualizar: ' + err.message);
    window.Pages.tasks();
  }
}

window.Pages.tasks.delete = async function(id) {
  if (!confirm(t('confirm_delete'))) return;
  await API.deleteTask(id);
  clearCache('/api/tasks');
  window.Pages.tasks();
};

window.Pages.tasks.openNew = async function() {
  const [projects, users] = await Promise.all([
    API.getProjects(),
    API.request('GET', '/api/team/workload')
  ]);

  document.getElementById('task-project').innerHTML = `<option value="">${t('tasks_select_project')}</option>` +
    projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');

  document.getElementById('task-assign').innerHTML = `<option value="">${t('tasks_unassigned')}</option>` +
    users.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('');

  document.getElementById('modal-task').classList.add('active');
  upgradeSelects(document.getElementById('modal-task'));
  initDatePickers(document.getElementById('modal-task'));
  document.getElementById('modal-task-title').textContent = t('tasks_modal_title');
  document.getElementById('task-id').value = '';

  document.getElementById('form-task').onsubmit = async (e) => {
    e.preventDefault();
    await API.createTask({
      project_id: document.getElementById('task-project').value,
      assigned_to: document.getElementById('task-assign').value || null,
      title: document.getElementById('task-title').value,
      description: document.getElementById('task-description').value,
      priority: document.getElementById('task-priority').value,
      deadline: document.getElementById('task-deadline').value || null,
    });
    document.getElementById('modal-task').classList.remove('active');
    document.getElementById('form-task').reset();
    window.Pages.tasks();
  };
};
