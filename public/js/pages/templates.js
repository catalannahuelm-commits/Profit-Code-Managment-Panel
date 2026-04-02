let _allTemplates = [];

window.Pages.templates = async function() {
  try {
    _allTemplates = await API.getTemplates();
    renderTemplates(_allTemplates);
    const btn = document.getElementById('btn-new-template');
    if (btn) btn.textContent = t('tpl_new');
  } catch (err) {
    console.error('Error cargando templates:', err);
  }
};

function renderTemplates(templates) {
  const grid = document.getElementById('templates-grid');
  if (!grid) return;

  if (!templates.length) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>${t('tpl_empty')}</p></div>`;
    return;
  }

  const colors = ['#7B6CF6', '#E84393', '#4A90D9', '#1DB954', '#F5A623', '#00CEC9'];

  grid.innerHTML = templates.map((tpl, i) => {
    const color = colors[i % colors.length];
    const taskCount = (tpl.tasks || []).length;
    return `
    <div class="template-card" style="--tpl-accent:${color}; animation-delay:${i * 60}ms">
      <div class="template-card-header">
        <div class="template-icon" style="background:${color}15;color:${color}">📋</div>
        <div>
          <h4>${esc(tpl.name)}</h4>
          ${tpl.description ? `<p class="template-desc">${esc(tpl.description)}</p>` : ''}
        </div>
      </div>
      <div class="template-tasks-preview">
        ${(tpl.tasks || []).slice(0, 4).map(tk => `
          <div class="template-task-preview">
            <span class="template-task-dot" style="background:${color}"></span>
            <span>${esc(tk.title)}</span>
            <span class="template-task-priority" style="color:${tk.priority === 'high' ? '#E74C3C' : tk.priority === 'medium' ? '#F5A623' : '#4A90D9'}">${t('priority_' + (tk.priority || 'medium'))}</span>
          </div>
        `).join('')}
        ${taskCount > 4 ? `<div class="template-more">+${taskCount - 4} ${t('tpl_more_tasks')}</div>` : ''}
      </div>
      <div class="template-footer">
        <span class="template-task-count">${taskCount} ${t('tpl_tasks_label')}</span>
        <div class="card-actions" style="opacity:1">
          <button class="card-action-btn" onclick="Pages.templates.openApply(${tpl.id})" title="${t('tpl_apply')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
          </button>
          <button class="card-action-btn" onclick="Pages.templates.openEdit(${tpl.id})" title="${t('edit')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="card-action-btn" onclick="Pages.templates.delete(${tpl.id})" title="${t('delete')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

window.Pages.templates.addTaskRow = function(task) {
  const list = document.getElementById('template-tasks-list');
  const row = document.createElement('div');
  row.className = 'template-task-row';
  row.innerHTML = `
    <input type="text" class="tpl-task-title" placeholder="${t('tasks_title')}" value="${task ? esc(task.title) : ''}" required>
    <select class="tpl-task-priority">
      <option value="low" ${task?.priority === 'low' ? 'selected' : ''}>${t('priority_low')}</option>
      <option value="medium" ${!task || task?.priority === 'medium' ? 'selected' : ''}>${t('priority_medium')}</option>
      <option value="high" ${task?.priority === 'high' ? 'selected' : ''}>${t('priority_high')}</option>
    </select>
    <button type="button" class="card-action-btn" style="opacity:1" onclick="this.parentElement.remove()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;
  list.appendChild(row);
};

function getTasksFromForm() {
  const rows = document.querySelectorAll('#template-tasks-list .template-task-row');
  return [...rows].map(row => ({
    title: row.querySelector('.tpl-task-title').value,
    priority: row.querySelector('.tpl-task-priority').value,
  })).filter(t => t.title.trim());
}

let _editingTemplateId = null;

window.Pages.templates.openNew = function() {
  _editingTemplateId = null;
  document.getElementById('form-template').reset();
  document.getElementById('template-tasks-list').innerHTML = '';
  document.getElementById('template-modal-title').textContent = t('tpl_new');
  document.getElementById('template-submit-btn').textContent = t('tpl_create');
  Pages.templates.addTaskRow();
  Pages.templates.addTaskRow();
  Pages.templates.addTaskRow();
  openModal('modal-template');

  document.getElementById('form-template').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('template-name').value,
      description: document.getElementById('template-description').value,
      tasks: getTasksFromForm(),
    };
    await API.createTemplate(data);
    closeModal('modal-template');
    clearCache('/api/templates');
    window.Pages.templates();
    showToast(t('tpl_created'));
  };
};

window.Pages.templates.openEdit = function(id) {
  const tpl = _allTemplates.find(t => t.id === id);
  if (!tpl) return;
  _editingTemplateId = id;
  document.getElementById('template-name').value = tpl.name;
  document.getElementById('template-description').value = tpl.description || '';
  document.getElementById('template-modal-title').textContent = t('tpl_edit');
  document.getElementById('template-submit-btn').textContent = t('save');
  const list = document.getElementById('template-tasks-list');
  list.innerHTML = '';
  (tpl.tasks || []).forEach(tk => Pages.templates.addTaskRow(tk));
  openModal('modal-template');

  document.getElementById('form-template').onsubmit = async (e) => {
    e.preventDefault();
    await API.request('PUT', `/api/templates/${id}`, {
      name: document.getElementById('template-name').value,
      description: document.getElementById('template-description').value,
      tasks: getTasksFromForm(),
    });
    closeModal('modal-template');
    clearCache('/api/templates');
    window.Pages.templates();
    showToast(t('tpl_updated'));
  };
};

window.Pages.templates.delete = async function(id) {
  if (!(await confirmDialog(t('confirm_delete')))) return;
  await API.deleteTemplate(id);
  clearCache('/api/templates');
  window.Pages.templates();
};

window.Pages.templates.openApply = async function(id) {
  const tpl = _allTemplates.find(t => t.id === id);
  if (!tpl) return;
  document.getElementById('apply-template-title').textContent = t('tpl_apply') + ': ' + tpl.name;
  document.getElementById('apply-project-name').value = tpl.name;

  const clients = await API.getClients();
  const select = document.getElementById('apply-client');
  select.innerHTML = `<option value="">${t('projects_select_client')}</option>` +
    clients.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  upgradeSelects(document.getElementById('modal-apply-template'));
  initDatePickers(document.getElementById('modal-apply-template'));
  openModal('modal-apply-template');

  document.getElementById('form-apply-template').onsubmit = async (e) => {
    e.preventDefault();
    await API.applyTemplate({
      template_id: id,
      client_id: document.getElementById('apply-client').value,
      project_name: document.getElementById('apply-project-name').value,
      budget: parseFloat(document.getElementById('apply-budget').value) || 0,
      deadline: document.getElementById('apply-deadline').value || null,
    });
    closeModal('modal-apply-template');
    clearCache('/api/projects');
    clearCache('/api/tasks');
    showToast(t('tpl_applied'));
  };
};
