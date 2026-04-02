function getInvStatus() {
  return {
    pending: { label: t('invoices_status_pending'), color: '#F5A623', icon: '○' },
    paid: { label: t('invoices_status_paid'), color: '#1DB954', icon: '●' },
    overdue: { label: t('invoices_status_overdue'), color: '#E74C3C', icon: '!' },
  };
}

let _allInvoices = [];

window.Pages.invoices = async function() {
  var list = document.getElementById('invoices-list');
  if (list && !list.children.length) list.innerHTML = '<div class="sk sk-row"></div><div class="sk sk-row"></div><div class="sk sk-row"></div>';
  try {
    _allInvoices = await API.getInvoices();
    updateInvSummary(_allInvoices);
    updateInvCounts(_allInvoices);
    renderInvoices(_allInvoices);

    const filterContainer = document.querySelector('.invoice-filter')?.parentElement;
    if (filterContainer) {
      filterContainer.onclick = (e) => {
        const btn = e.target.closest('.invoice-filter');
        if (!btn) return;
        filterContainer.querySelectorAll('.invoice-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        const filtered = filter === 'all' ? _allInvoices : _allInvoices.filter(i => i.status === filter);
        renderInvoices(filtered);
      };
    }
  } catch (err) {
    console.error('Error cargando facturas:', err);
  }
};

function updateInvSummary(invoices) {
  const el = document.getElementById('inv-summary');
  if (!el) return;

  const total = invoices.reduce((s, i) => s + i.amount, 0);
  const paid = invoices.filter(i => i.status === 'paid');
  const paidTotal = paid.reduce((s, i) => s + i.amount, 0);
  const pending = invoices.filter(i => i.status !== 'paid');
  const pendingTotal = pending.reduce((s, i) => s + i.amount, 0);
  const today = new Date().toISOString().split('T')[0];
  const overdue = invoices.filter(i => i.due_date && i.due_date < today && i.status !== 'paid');
  const overdueTotal = overdue.reduce((s, i) => s + i.amount, 0);

  el.innerHTML = `
    <div class="inv-kpi">
      <div class="inv-kpi-icon" style="background: rgba(123, 108, 246, 0.15); color: #7B6CF6;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      </div>
      <div>
        <div class="inv-kpi-value">$${total.toLocaleString()}</div>
        <div class="inv-kpi-label">${t('invoices_total_billed')}</div>
      </div>
    </div>
    <div class="inv-kpi">
      <div class="inv-kpi-icon" style="background: rgba(29, 185, 84, 0.15); color: #1DB954;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
      </div>
      <div>
        <div class="inv-kpi-value" style="color:#1DB954">$${paidTotal.toLocaleString()}</div>
        <div class="inv-kpi-label">${t('invoices_collected')}</div>
      </div>
    </div>
    <div class="inv-kpi">
      <div class="inv-kpi-icon" style="background: rgba(245, 166, 35, 0.15); color: #F5A623;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </div>
      <div>
        <div class="inv-kpi-value" style="color:#F5A623">$${pendingTotal.toLocaleString()}</div>
        <div class="inv-kpi-label">${t('invoices_to_collect')}</div>
      </div>
    </div>
    <div class="inv-kpi">
      <div class="inv-kpi-icon" style="background: rgba(231, 76, 60, 0.15); color: #E74C3C;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <div>
        <div class="inv-kpi-value" style="color:${overdueTotal > 0 ? '#E74C3C' : 'var(--text-muted)'}">$${overdueTotal.toLocaleString()}</div>
        <div class="inv-kpi-label">${t('invoices_overdue_total')}</div>
      </div>
    </div>
  `;
}

function updateInvCounts(invoices) {
  const today = new Date().toISOString().split('T')[0];
  const counts = {
    all: invoices.length,
    pending: invoices.filter(i => i.status === 'pending').length,
    paid: invoices.filter(i => i.status === 'paid').length,
    overdue: invoices.filter(i => i.due_date && i.due_date < today && i.status !== 'paid').length,
  };
  Object.keys(counts).forEach(k => {
    const el = document.getElementById('inv-count-' + k);
    if (el) el.textContent = counts[k];
  });
}

function invDeadlineLabel(dueDate, status) {
  if (!dueDate) return '';
  if (status === 'paid') return `<span class="inv-due">${esc(dueDate)}</span>`;

  const today = new Date(); today.setHours(0,0,0,0);
  const dl = new Date(dueDate + 'T00:00:00');
  const diff = Math.ceil((dl - today) / (1000 * 60 * 60 * 24));

  if (diff < 0) return `<span class="inv-due overdue"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> ${t('invoices_status_overdue')} ${Math.abs(diff)}d</span>`;
  if (diff === 0) return `<span class="inv-due today">${t('invoices_due_today')}</span>`;
  if (diff <= 5) return `<span class="inv-due soon">${t('invoices_due_in', { n: diff })}</span>`;
  return `<span class="inv-due">${esc(dueDate)}</span>`;
}

function renderInvoices(invoices) {
  const container = document.getElementById('invoices-list');

  if (invoices.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📄</div><p>${t('invoices_empty')}</p></div>`;
    return;
  }

  container.innerHTML = invoices.map((inv, i) => {
    const invStatuses = getInvStatus();
    const st = invStatuses[inv.status] || invStatuses.pending;
    const initial = (inv.client_name || '?').charAt(0).toUpperCase();

    return `
    <div class="card inv-card" style="animation-delay:${i * 40}ms">
      <div class="inv-card-accent" style="background:${st.color}"></div>
      <div class="inv-card-body">
        <div class="inv-card-left">
          <div class="inv-card-header">
            <span class="inv-number">#${inv.id}</span>
            <button class="task-status-btn inv-status-toggle" data-inv-id="${inv.id}" data-current="${inv.status}" style="--status-color:${st.color};font-size:0.78rem;padding:4px 12px;" onclick="event.stopPropagation();Pages.invoices.openStatusMenu(this)">
              <span class="task-status-dot" style="background:${st.color}"></span>
              ${esc(st.label)}
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
          <div class="inv-card-client">
            <div class="inv-avatar">${initial}</div>
            <div>
              <div class="inv-client-name">${esc(inv.client_name) || t('no_client')}</div>
              <div class="inv-project-name"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> ${esc(inv.project_name) || t('no_project')}</div>
            </div>
          </div>
        </div>
        <div class="inv-card-right">
          <div class="inv-amount">$${inv.amount.toLocaleString()}</div>
          <div class="inv-card-dates">
            ${invDeadlineLabel(inv.due_date, inv.status)}
            ${inv.status === 'paid' && inv.paid_date ? `<span class="inv-paid-date"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg> ${t('invoices_collected_on', { date: esc(inv.paid_date) })}</span>` : ''}
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            ${inv.status !== 'paid' ? `
              <button class="inv-pay-btn" onclick="event.stopPropagation(); markAsPaid(${inv.id})">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                ${t('invoices_collect')}
              </button>
            ` : ''}
            <button class="card-action-btn" onclick="event.stopPropagation();Pages.invoices.delete(${inv.id})" title="${t('delete')}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function invoiceStatusLabel(status) {
  const map = { pending: 'Pendiente', sent: 'Enviada', paid: 'Pagada', overdue: 'Vencida' };
  return map[status] || status;
}

async function markAsPaid(id) {
  if (!(await confirmDialog(t('invoices_confirm_pay'), { type: 'success', btnText: t('invoices_collect'), title: t('invoices_collect') }))) return;
  try {
    await API.updateInvoice(id, { status: 'paid' });
    window.Pages.invoices();
  } catch (err) {
    alert('Error al actualizar la factura: ' + err.message);
  }
}

window.Pages.invoices.openStatusMenu = function(btn) {
  const existing = document.getElementById('floating-inv-menu');
  if (existing) { existing.remove(); return; }
  const invId = parseInt(btn.dataset.invId);
  const current = btn.dataset.current;
  const statuses = getInvStatus();
  const rect = btn.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = 'floating-inv-menu';
  menu.className = 'task-status-menu';
  menu.style.cssText = `display:block;position:fixed;top:${rect.bottom + 6}px;left:${rect.left}px;z-index:99999;width:170px;`;
  menu.innerHTML = Object.entries(statuses).map(([key, s]) => `
    <div class="task-status-option ${key === current ? 'active' : ''}" data-value="${key}" style="--opt-color:${s.color}">
      <span class="task-status-opt-dot" style="background:${s.color}"></span>
      ${esc(s.label)}
    </div>
  `).join('');
  document.body.appendChild(menu);
  menu.querySelectorAll('.task-status-option').forEach(opt => {
    opt.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      menu.remove();
      const data = { status: opt.dataset.value };
      if (opt.dataset.value === 'paid') data.paid_date = new Date().toISOString().split('T')[0];
      await API.updateInvoice(invId, data);
      clearCache('/api/invoices');
      window.Pages.invoices();
    });
  });
  setTimeout(() => document.addEventListener('click', function close() {
    const m = document.getElementById('floating-inv-menu'); if (m) m.remove();
    document.removeEventListener('click', close);
  }, { once: true }), 10);
};

window.Pages.invoices.delete = async function(id) {
  if (!(await confirmDialog(t('confirm_delete')))) return;
  await API.deleteInvoice(id);
  clearCache('/api/invoices');
  window.Pages.invoices();
};

window.Pages.invoices.openNew = async function() {
  const projects = await API.getProjects();
  document.getElementById('invoice-project').innerHTML = `<option value="">${t('tasks_select_project')}</option>` +
    projects.map(p => `<option value="${p.id}">${esc(p.name)} (${esc(p.client_name) || 'sin cliente'})</option>`).join('');

  openModal('modal-invoice');
  upgradeSelects(document.getElementById('modal-invoice'));
  initDatePickers(document.getElementById('modal-invoice'));

  document.getElementById('form-invoice').onsubmit = async (e) => {
    e.preventDefault();
    await API.createInvoice({
      project_id: document.getElementById('invoice-project').value,
      amount: parseFloat(document.getElementById('invoice-amount').value),
      due_date: document.getElementById('invoice-due').value,
      description: document.getElementById('invoice-description').value,
    });
    closeModal('modal-invoice');
    document.getElementById('form-invoice').reset();
    window.Pages.invoices();
  };
};
