const CAT_CONFIG = {
  hosting: { label: 'Hosting', color: '#4A90D9', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>' },
  tools: { label: 'Herramientas', color: '#F5A623', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>' },
  freelancer: { label: 'Freelancer', color: '#E84393', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' },
  marketing: { label: 'Marketing', color: '#1DB954', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>' },
  other: { label: 'Otros', color: '#8888A8', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' },
};

let _allExpenses = [];

window.Pages.expenses = async function() {
  var list = document.getElementById('expenses-list');
  if (list && !list.children.length) list.innerHTML = '<div class="sk sk-row"></div><div class="sk sk-row"></div><div class="sk sk-row"></div>';
  try {
    _allExpenses = await API.getExpenses();
    updateExpSummary(_allExpenses);
    updateExpCounts(_allExpenses);
    renderExpenses(_allExpenses);

    const filterContainer = document.querySelector('.expense-filter')?.parentElement;
    if (filterContainer) {
      filterContainer.onclick = (e) => {
        const btn = e.target.closest('.expense-filter');
        if (!btn) return;
        filterContainer.querySelectorAll('.expense-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        const filtered = filter === 'all' ? _allExpenses : _allExpenses.filter(e => e.category === filter);
        renderExpenses(filtered);
      };
    }
  } catch (err) {
    console.error('Error cargando gastos:', err);
  }
};

function updateExpSummary(expenses) {
  const el = document.getElementById('exp-summary');
  if (!el) return;

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const thisMonth = expenses
    .filter(e => e.date && e.date.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((s, e) => s + e.amount, 0);

  // Top category
  const byCat = {};
  expenses.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  const topCatConfig = topCat ? CAT_CONFIG[topCat[0]] : null;

  // Average per expense
  const avg = expenses.length ? Math.round(total / expenses.length) : 0;

  el.innerHTML = `
    <div class="exp-kpi">
      <div class="exp-kpi-icon" style="background: rgba(208, 90, 79, 0.15); color: #d05a4f;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
      </div>
      <div>
        <div class="exp-kpi-value">$${total.toLocaleString()}</div>
        <div class="exp-kpi-label">${t('expenses_total')}</div>
      </div>
    </div>
    <div class="exp-kpi">
      <div class="exp-kpi-icon" style="background: rgba(123, 108, 246, 0.15); color: #7B6CF6;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
      <div>
        <div class="exp-kpi-value" style="color:#7B6CF6">$${thisMonth.toLocaleString()}</div>
        <div class="exp-kpi-label">${t('expenses_this_month')}</div>
      </div>
    </div>
    <div class="exp-kpi">
      <div class="exp-kpi-icon" style="background: rgba(245, 166, 35, 0.15); color: #F5A623;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      </div>
      <div>
        <div class="exp-kpi-value" style="color:#F5A623">$${avg.toLocaleString()}</div>
        <div class="exp-kpi-label">${t('expenses_avg')}</div>
      </div>
    </div>
    <div class="exp-kpi">
      <div class="exp-kpi-icon" style="background: ${topCatConfig ? `rgba(0,0,0,0.15)` : 'rgba(136,136,168,0.15)'}; color: ${topCatConfig ? topCatConfig.color : '#8888A8'};">
        ${topCatConfig ? topCatConfig.icon.replace(/14/g, '20') : ''}
      </div>
      <div>
        <div class="exp-kpi-value" style="color:${topCatConfig ? topCatConfig.color : 'var(--text-muted)'}">${topCatConfig ? t('expenses_cat_' + topCat[0]) : '-'}</div>
        <div class="exp-kpi-label">${t('expenses_top_cat')}${topCat ? ` ($${topCat[1].toLocaleString()})` : ''}</div>
      </div>
    </div>
  `;
}

function updateExpCounts(expenses) {
  const counts = { all: expenses.length, hosting: 0, tools: 0, freelancer: 0, marketing: 0, other: 0 };
  expenses.forEach(e => { if (counts[e.category] !== undefined) counts[e.category]++; });
  Object.keys(counts).forEach(k => {
    const el = document.getElementById('exp-count-' + k);
    if (el) el.textContent = counts[k];
  });
}

function renderExpenses(expenses) {
  const container = document.getElementById('expenses-list');

  if (expenses.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">💸</div><p>${t('expenses_empty')}</p></div>`;
    return;
  }

  container.innerHTML = expenses.map((e, i) => {
    const cat = CAT_CONFIG[e.category] || CAT_CONFIG.other;
    return `
    <div class="card exp-card" style="animation-delay:${i * 35}ms">
      <div class="exp-card-accent" style="background:${cat.color}"></div>
      <div class="exp-card-body">
        <div class="exp-card-left">
          <div class="exp-card-icon" style="background:${cat.color}20; color:${cat.color}">
            ${cat.icon}
          </div>
          <div>
            <div class="exp-card-title">${esc(e.description)}</div>
            <div class="exp-card-meta">
              <span class="exp-cat-tag" style="--cat-color:${cat.color}">
                ${cat.icon} ${esc(cat.label)}
              </span>
              <span class="exp-card-project">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                ${e.project_name ? esc(e.project_name) : t('expenses_general')}
              </span>
            </div>
          </div>
        </div>
        <div class="exp-card-right">
          <div class="exp-card-amount ${e.amount >= 1000 ? 'large' : ''}">$${e.amount.toLocaleString()}</div>
          <div class="exp-card-date">${esc(e.date) || '-'}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function expenseCategoryLabel(cat) {
  const map = { hosting: 'Hosting', tools: 'Herramientas', freelancer: 'Freelancer', marketing: 'Marketing', other: 'Otros' };
  return map[cat] || cat;
}

window.Pages.expenses.openNew = async function() {
  const projects = await API.getProjects();
  document.getElementById('expense-project').innerHTML = `<option value="">${t('no_project')}</option>` +
    projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');

  document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];

  document.getElementById('modal-expense').classList.add('active');
  upgradeSelects(document.getElementById('modal-expense'));
  initDatePickers(document.getElementById('modal-expense'));

  document.getElementById('form-expense').onsubmit = async (e) => {
    e.preventDefault();
    await API.createExpense({
      description: document.getElementById('expense-description').value,
      amount: parseFloat(document.getElementById('expense-amount').value),
      category: document.getElementById('expense-category').value,
      project_id: document.getElementById('expense-project').value || null,
      date: document.getElementById('expense-date').value,
    });
    document.getElementById('modal-expense').classList.remove('active');
    document.getElementById('form-expense').reset();
    window.Pages.expenses();
  };
};
