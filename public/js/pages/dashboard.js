const DASHBOARD_KPIS = [
  { id: 'income', key: 'dash_income', subKey: 'dash_income_sub', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1DB954" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>', color: '#1DB954' },
  { id: 'projects', key: 'dash_active_projects', subKey: 'dash_active_projects_sub', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4A90D9" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>', color: '#4A90D9' },
  { id: 'profit', key: 'dash_profit', subKey: 'dash_profit_sub', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7B6CF6" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>', color: '#7B6CF6' },
  { id: 'pending', key: 'dash_pending', subKey: 'dash_pending_sub', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F5A623" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>', color: '#F5A623' },
];

window.Pages.dashboard = async function() {
  const kpiContainer = document.getElementById('dashboard-kpis');
  if (kpiContainer && !kpiContainer.children.length) {
    kpiContainer.innerHTML = '<div class="sk sk-kpi"></div><div class="sk sk-kpi"></div><div class="sk sk-kpi"></div><div class="sk sk-kpi"></div>';
  }
  try {
    const data = await API.getDashboard();

    const greetName = document.getElementById('greeting-name');
    if (greetName && window.currentUser) greetName.textContent = window.currentUser.name;
    const greetLabel = document.getElementById('greeting-label');
    if (greetLabel) greetLabel.textContent = t('dash_greeting');

    renderDashboardKPIs(data);

    const expEl = document.getElementById('stat-expenses');
    if (expEl) expEl.textContent = `$${data.expenses.toLocaleString()}`;

    const totalPipeline = data.pipeline.reduce((sum, p) => sum + p.count, 0);
    const leads = data.pipeline.find(p => p.pipeline_stage === 'lead');
    const paid = data.pipeline.find(p => p.pipeline_stage === 'paid');
    const ptEl = document.getElementById('stat-pipeline-total');
    if (ptEl) ptEl.textContent = totalPipeline;
    const slEl = document.getElementById('stat-leads');
    if (slEl) slEl.textContent = leads ? leads.count : 0;
    const convEl = document.getElementById('stat-conversion');
    if (convEl && totalPipeline > 0) {
      const paidCount = paid ? paid.count : 0;
      convEl.textContent = `${Math.round((paidCount / totalPipeline) * 100)}%`;
    }

    // Total revenue/expenses
    const trEl = document.getElementById('stat-total-revenue');
    if (trEl) trEl.textContent = `$${(data.totalRevenue || 0).toLocaleString()}`;
    const teEl = document.getElementById('stat-total-expenses');
    if (teEl) teEl.textContent = `$${(data.totalExpenses || 0).toLocaleString()}`;

    document.querySelectorAll('[data-stat-label]').forEach(el => {
      el.textContent = t(el.dataset.statLabel);
    });

    renderRevenueChart(data.monthlyRevenue, data.monthlyExpenses);
    renderPipelineChart(data.pipeline);
    renderExpensesChart(data.monthlyExpenses);
    renderProfitTrendChart(data.profitTrend || []);
    renderTopClients(data.topClients || []);
    renderTaskOverview(data);
    renderAtRisk(data.atRisk || []);
  } catch (err) {
    console.error('Error cargando dashboard:', err);
  }
};

function getChangeIndicator(current, previous) {
  if (!previous || previous === 0) return '';
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (pct === 0) return '';
  const isUp = pct > 0;
  const display = Math.abs(pct) > 999 ? `$${Math.abs(current - previous).toLocaleString()}` : `${Math.abs(pct)}%`;
  return `<span class="${isUp ? 'kpi-up' : 'kpi-down'}">${isUp ? '▲' : '▼'} ${display}</span>`;
}

function renderDashboardKPIs(data) {
  const container = document.getElementById('dashboard-kpis');
  const values = {
    income: `$${data.income.toLocaleString()}`,
    projects: data.activeProjects,
    profit: `$${data.profit.toLocaleString()}`,
    pending: `$${data.pendingInvoices.toLocaleString()}`
  };
  const changes = {
    income: getChangeIndicator(data.income, data.prevIncome),
    profit: getChangeIndicator(data.profit, data.prevProfit),
  };

  container.innerHTML = DASHBOARD_KPIS.map((kpi, i) => {
    const profitPositive = kpi.id === 'profit' ? data.profit >= 0 : true;
    const change = changes[kpi.id] || '';
    return `
      <div class="dashboard-kpi" style="--kpi-accent:${kpi.color}; animation-delay:${i * 60}ms">
        <div class="kpi-top">
          <div>
            <div class="kpi-label">${t(kpi.key)}</div>
            <div class="kpi-value">${values[kpi.id]}</div>
          </div>
          <div class="kpi-icon-wrap" style="background:${kpi.color}15;border:1px solid ${kpi.color}30">
            ${kpi.icon}
          </div>
        </div>
        <div class="kpi-sub">
          ${change || (kpi.id === 'profit' ? `<span class="${profitPositive ? 'kpi-up' : 'kpi-down'}">${profitPositive ? '▲' : '▼'}</span>` : '')}
          ${t(kpi.subKey)}
        </div>
      </div>
    `;
  }).join('');
}

function getChartColors() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    grid: isDark ? 'rgba(123, 108, 246, 0.06)' : 'rgba(0,0,0,0.06)',
    text: isDark ? '#8888A8' : '#9CA3AF',
    purple: '#7B6CF6',
    pink: '#C084FC',
  };
}

function renderRevenueChart(revenue, expenses) {
  const canvas = document.getElementById('chart-revenue');
  if (!canvas || typeof Chart === 'undefined') return;

  const allMonths = new Set();
  revenue.forEach(r => allMonths.add(r.month));
  expenses.forEach(e => allMonths.add(e.month));

  if (allMonths.size === 0) {
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      allMonths.add(d.toISOString().slice(0, 7));
    }
  }

  const months = [...allMonths].sort();
  const revenueMap = Object.fromEntries(revenue.map(r => [r.month, r.total]));
  const expenseMap = Object.fromEntries(expenses.map(e => [e.month, e.total]));
  const monthNames = getMonthNames();
  const labels = months.map(m => monthNames[parseInt(m.split('-')[1]) - 1]);
  const c = getChartColors();

  if (canvas._chartInstance) canvas._chartInstance.destroy();
  const ctx = canvas.getContext('2d');

  const gradRev = ctx.createLinearGradient(0, 0, 0, 300);
  gradRev.addColorStop(0, 'rgba(123, 108, 246, 0.35)');
  gradRev.addColorStop(0.5, 'rgba(123, 108, 246, 0.08)');
  gradRev.addColorStop(1, 'rgba(123, 108, 246, 0)');

  const gradExp = ctx.createLinearGradient(0, 0, 0, 300);
  gradExp.addColorStop(0, 'rgba(192, 132, 252, 0.2)');
  gradExp.addColorStop(1, 'rgba(192, 132, 252, 0)');

  canvas._chartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: t('dash_revenue'),
          data: months.map(m => revenueMap[m] || 0),
          borderColor: c.purple, backgroundColor: gradRev,
          borderWidth: 3, fill: true, tension: 0.45,
          pointBackgroundColor: c.purple, pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2, pointRadius: 5, pointHoverRadius: 8,
          pointHoverBackgroundColor: '#FFFFFF', pointHoverBorderColor: c.purple, pointHoverBorderWidth: 3
        },
        {
          label: t('dash_expenses'),
          data: months.map(m => expenseMap[m] || 0),
          borderColor: c.pink, backgroundColor: gradExp,
          borderWidth: 2, borderDash: [6, 4], fill: true, tension: 0.45,
          pointBackgroundColor: c.pink, pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 7
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: c.text, font: { family: 'Poppins', size: 11 }, usePointStyle: true, pointStyle: 'circle', padding: 20 } },
        tooltip: {
          backgroundColor: 'rgba(20, 10, 40, 0.9)', titleColor: '#FFF', bodyColor: '#C4C4D4',
          borderColor: 'rgba(123, 108, 246, 0.3)', borderWidth: 1, cornerRadius: 10, padding: 12,
          titleFont: { family: 'Poppins', weight: '600' }, bodyFont: { family: 'Poppins' },
          callbacks: { label: (ctx) => ` ${ctx.dataset.label}: $${ctx.parsed.y.toLocaleString()}` }
        }
      },
      scales: {
        x: { ticks: { color: c.text, font: { size: 11, family: 'Poppins' } }, grid: { display: false } },
        y: { ticks: { color: c.text, font: { size: 11, family: 'Poppins' }, callback: v => '$' + v.toLocaleString() }, grid: { color: c.grid } }
      }
    }
  });
}

function renderPipelineChart(pipeline) {
  const canvas = document.getElementById('chart-pipeline');
  if (!canvas || typeof Chart === 'undefined') return;

  const stages = ['lead', 'proposal', 'development', 'delivered', 'paid'];
  const stageKeys = ['dash_leads_short', 'dash_proposal_short', 'dash_in_prog_short', 'dash_done_short', 'dash_paid_short'];
  const stageColors = ['#4A90D9', '#F5A623', '#7B6CF6', '#1DB954', '#00CEC9'];
  const pipelineMap = Object.fromEntries(pipeline.map(p => [p.pipeline_stage, p.count]));
  const labels = stageKeys.map(k => t(k));
  const values = stages.map(s => pipelineMap[s] || 0);
  const c = getChartColors();

  if (canvas._chartInstance) canvas._chartInstance.destroy();
  canvas._chartInstance = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: stageColors, borderRadius: 8, borderSkipped: false, barThickness: 32, borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: 'rgba(20, 10, 40, 0.9)', titleColor: '#FFF', bodyColor: '#C4C4D4', borderColor: 'rgba(123, 108, 246, 0.3)', borderWidth: 1, cornerRadius: 10, padding: 12, titleFont: { family: 'Poppins', weight: '600' }, bodyFont: { family: 'Poppins' } }
      },
      scales: {
        x: { ticks: { color: c.text, font: { size: 10, family: 'Poppins' } }, grid: { display: false } },
        y: { ticks: { color: c.text, font: { size: 10, family: 'Poppins' }, stepSize: 1 }, grid: { color: c.grid } }
      }
    }
  });
}

function renderExpensesChart() {
  const canvas = document.getElementById('chart-expenses');
  if (!canvas || typeof Chart === 'undefined') return;
  if (canvas._chartInstance) canvas._chartInstance.destroy();

  API.getExpenses().then(expenses => {
    const catKeys = { hosting: 'expenses_cat_hosting', tools: 'expenses_cat_tools', freelancer: 'expenses_cat_freelancer', marketing: 'expenses_cat_marketing', other: 'expenses_cat_other' };
    const cats = {};
    expenses.forEach(e => {
      const label = t(catKeys[e.category] || 'expenses_cat_other');
      cats[label] = (cats[label] || 0) + e.amount;
    });
    const labels = Object.keys(cats);
    const values = Object.values(cats);
    const colors = ['#7B6CF6', '#E84393', '#4A90D9', '#F5A623', '#00CEC9'];

    canvas._chartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 0, hoverOffset: 8 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: {
          legend: { position: 'right', labels: { color: '#C4C4D4', font: { family: 'Poppins', size: 11 }, usePointStyle: true, pointStyle: 'circle', padding: 14 } },
          tooltip: { backgroundColor: 'rgba(20, 10, 40, 0.9)', titleColor: '#FFF', bodyColor: '#C4C4D4', borderColor: 'rgba(123, 108, 246, 0.3)', borderWidth: 1, cornerRadius: 10, padding: 12, titleFont: { family: 'Poppins', weight: '600' }, bodyFont: { family: 'Poppins' }, callbacks: { label: (ctx) => ` ${ctx.label}: $${ctx.parsed.toLocaleString()}` } }
        }
      }
    });
  }).catch(() => {});
}

// NEW: Profit trend chart
function renderProfitTrendChart(profitTrend) {
  const canvas = document.getElementById('chart-profit-trend');
  if (!canvas || typeof Chart === 'undefined') return;
  if (canvas._chartInstance) canvas._chartInstance.destroy();

  const monthNames = getMonthNames();
  const labels = profitTrend.map(p => monthNames[parseInt(p.month.split('-')[1]) - 1]);
  const values = profitTrend.map(p => p.profit);
  const c = getChartColors();

  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 280);
  grad.addColorStop(0, 'rgba(29, 185, 84, 0.3)');
  grad.addColorStop(0.5, 'rgba(29, 185, 84, 0.05)');
  grad.addColorStop(1, 'rgba(29, 185, 84, 0)');

  canvas._chartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: t('dash_profit'),
        data: values,
        borderColor: '#1DB954', backgroundColor: grad,
        borderWidth: 3, fill: true, tension: 0.4,
        pointBackgroundColor: values.map(v => v >= 0 ? '#1DB954' : '#E74C3C'),
        pointBorderColor: '#FFFFFF', pointBorderWidth: 2, pointRadius: 6, pointHoverRadius: 9
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(20, 10, 40, 0.9)', titleColor: '#FFF', bodyColor: '#C4C4D4',
          borderColor: 'rgba(29, 185, 84, 0.3)', borderWidth: 1, cornerRadius: 10, padding: 12,
          callbacks: { label: (ctx) => ` ${t('dash_profit')}: $${ctx.parsed.y.toLocaleString()}` }
        }
      },
      scales: {
        x: { ticks: { color: c.text, font: { size: 11, family: 'Poppins' } }, grid: { display: false } },
        y: { ticks: { color: c.text, font: { size: 11, family: 'Poppins' }, callback: v => '$' + v.toLocaleString() }, grid: { color: c.grid } }
      }
    }
  });
}

// NEW: Top clients ranking
function renderTopClients(topClients) {
  const el = document.getElementById('dash-top-clients');
  if (!el) return;

  if (!topClients.length) {
    el.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:20px">${t('dash_no_clients')}</p>`;
    return;
  }

  const maxRev = topClients[0]?.revenue || 1;
  const colors = ['#7B6CF6', '#E84393', '#4A90D9', '#1DB954', '#F5A623'];

  el.innerHTML = topClients.map((c, i) => {
    const pct = Math.round((c.revenue / maxRev) * 100);
    return `
    <div class="dash-client-row" style="animation-delay:${i * 60}ms">
      <div class="dash-client-rank" style="background:${colors[i]}15;color:${colors[i]}">${i + 1}</div>
      <div class="dash-client-info">
        <div class="dash-client-name">${esc(c.name)}</div>
        <div class="dash-client-bar-wrap">
          <div class="dash-client-bar" style="width:${pct}%;background:${colors[i]}"></div>
        </div>
      </div>
      <div class="dash-client-revenue">$${c.revenue.toLocaleString()}</div>
    </div>`;
  }).join('');
}

// NEW: Task overview with donut
function renderTaskOverview(data) {
  const el = document.getElementById('dash-task-overview');
  if (!el) return;

  const rate = data.taskRate || 0;
  const done = data.doneTasks || 0;
  const total = data.totalTasks || 0;
  const pending = total - done;

  el.innerHTML = `
    <div class="dash-task-ring-container">
      <div class="dash-task-ring">
        <svg viewBox="0 0 36 36" class="dash-task-svg">
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(123,108,246,0.1)" stroke-width="3"/>
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#1DB954" stroke-width="3" stroke-dasharray="${rate}, 100" stroke-linecap="round"/>
        </svg>
        <div class="dash-task-ring-label">${rate}%</div>
      </div>
      <div class="dash-task-stats">
        <div class="dash-task-stat">
          <span class="dash-task-stat-dot" style="background:#1DB954"></span>
          <span>${t('dash_tasks_done')}: <strong>${done}</strong></span>
        </div>
        <div class="dash-task-stat">
          <span class="dash-task-stat-dot" style="background:#F5A623"></span>
          <span>${t('dash_tasks_pending')}: <strong>${pending}</strong></span>
        </div>
        <div class="dash-task-stat">
          <span class="dash-task-stat-dot" style="background:#7B6CF6"></span>
          <span>${t('dash_tasks_total')}: <strong>${total}</strong></span>
        </div>
      </div>
    </div>
  `;
}

// NEW: Projects at risk
function renderAtRisk(atRisk) {
  const el = document.getElementById('dash-at-risk');
  if (!el) return;

  if (!atRisk.length) {
    el.innerHTML = `<div class="dash-at-risk-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1DB954" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><p>${t('dash_no_risk')}</p></div>`;
    return;
  }

  el.innerHTML = atRisk.map((p, i) => {
    const isOverdue = p.daysLeft < 0;
    const color = isOverdue ? '#E74C3C' : '#F5A623';
    const label = isOverdue ? t('projects_overdue', { n: Math.abs(p.daysLeft) }) : t('projects_days_left', { n: p.daysLeft });
    return `
    <div class="dash-risk-row" style="animation-delay:${i * 50}ms">
      <div class="dash-risk-icon" style="background:${color}15;color:${color}">${isOverdue ? '⚠' : '⏳'}</div>
      <div class="dash-risk-info">
        <div class="dash-risk-name">${esc(p.name)}</div>
        <div class="dash-risk-deadline">${new Date(p.deadline).toLocaleDateString(getDateLocale(), { day: 'numeric', month: 'short' })}</div>
      </div>
      <span class="dash-risk-badge" style="background:${color}15;color:${color}">${label}</span>
    </div>`;
  }).join('');
}
