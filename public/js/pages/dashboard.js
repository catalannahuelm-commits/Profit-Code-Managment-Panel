const DASHBOARD_KPIS = [
  { id: 'income', key: 'dash_income', subKey: 'dash_income_sub', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1DB954" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>', color: '#1DB954' },
  { id: 'projects', key: 'dash_active_projects', subKey: 'dash_active_projects_sub', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4A90D9" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>', color: '#4A90D9' },
  { id: 'profit', key: 'dash_profit', subKey: 'dash_profit_sub', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7B6CF6" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>', color: '#7B6CF6' },
  { id: 'pending', key: 'dash_pending', subKey: 'dash_pending_sub', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F5A623" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>', color: '#F5A623' },
];

window.Pages.dashboard = async function() {
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

    // Update stat labels
    document.querySelectorAll('[data-stat-label]').forEach(el => {
      el.textContent = t(el.dataset.statLabel);
    });

    renderRevenueChart(data.monthlyRevenue, data.monthlyExpenses);
    renderPipelineChart(data.pipeline);
    renderExpensesChart(data.monthlyExpenses);
  } catch (err) {
    console.error('Error cargando dashboard:', err);
  }
};

function renderDashboardKPIs(data) {
  const container = document.getElementById('dashboard-kpis');
  const values = {
    income: `$${data.income.toLocaleString()}`,
    projects: data.activeProjects,
    profit: `$${data.profit.toLocaleString()}`,
    pending: `$${data.pendingInvoices.toLocaleString()}`
  };

  container.innerHTML = DASHBOARD_KPIS.map((kpi, i) => {
    const profitPositive = kpi.id === 'profit' ? data.profit >= 0 : true;
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
          ${kpi.id === 'profit' ? `<span class="${profitPositive ? 'kpi-up' : 'kpi-down'}">${profitPositive ? '▲' : '▼'}</span>` : ''}
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
          borderColor: c.purple,
          backgroundColor: gradRev,
          borderWidth: 3, fill: true, tension: 0.45,
          pointBackgroundColor: c.purple, pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2, pointRadius: 5, pointHoverRadius: 8,
          pointHoverBackgroundColor: '#FFFFFF', pointHoverBorderColor: c.purple, pointHoverBorderWidth: 3
        },
        {
          label: t('dash_expenses'),
          data: months.map(m => expenseMap[m] || 0),
          borderColor: c.pink,
          backgroundColor: gradExp,
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
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: stageColors, borderRadius: 8, borderSkipped: false, barThickness: 32, borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(20, 10, 40, 0.9)', titleColor: '#FFF', bodyColor: '#C4C4D4',
          borderColor: 'rgba(123, 108, 246, 0.3)', borderWidth: 1, cornerRadius: 10, padding: 12,
          titleFont: { family: 'Poppins', weight: '600' }, bodyFont: { family: 'Poppins' }
        }
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
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 0, hoverOffset: 8 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: {
          legend: { position: 'right', labels: { color: '#C4C4D4', font: { family: 'Poppins', size: 11 }, usePointStyle: true, pointStyle: 'circle', padding: 14 } },
          tooltip: {
            backgroundColor: 'rgba(20, 10, 40, 0.9)', titleColor: '#FFF', bodyColor: '#C4C4D4',
            borderColor: 'rgba(123, 108, 246, 0.3)', borderWidth: 1, cornerRadius: 10, padding: 12,
            titleFont: { family: 'Poppins', weight: '600' }, bodyFont: { family: 'Poppins' },
            callbacks: { label: (ctx) => ` ${ctx.label}: $${ctx.parsed.toLocaleString()}` }
          }
        }
      }
    });
  }).catch(() => {});
}
