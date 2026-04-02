const TEAM_COLORS = ['#7B6CF6','#E84393','#4A90D9','#1DB954','#F5A623','#00CEC9'];

window.Pages.team = async function() {
  try {
    const workload = await API.getTeamWorkload();
    renderTeamMembers(workload);
    renderTeamDistribution(workload);
  } catch (err) {
    console.error('Error cargando equipo:', err);
  }
};

function renderTeamMembers(workload) {
  const el = document.getElementById('team-members');
  if (!el) return;

  const totalTasks = workload.reduce((s, m) => s + m.total, 0);
  const totalDone = workload.reduce((s, m) => s + m.done, 0);

  el.innerHTML = workload.map((member, i) => {
    const color = TEAM_COLORS[i % TEAM_COLORS.length];
    const active = member.in_progress + member.pending;
    const total = member.total || 0;
    const donePct = total ? Math.round((member.done / total) * 100) : 0;
    const roleLabel = member.role === 'owner' ? t('owner') : t('employee');
    const isOverloaded = active >= 5;

    return `
    <div class="team-card" style="--accent:${color}; animation-delay:${i * 80}ms">
      <div class="team-card-top">
        <div class="team-avatar-lg" style="background:${color}">${esc(member.name.charAt(0))}</div>
        <div class="team-card-info">
          <div class="team-card-name">${esc(member.name)}</div>
          <span class="team-role-badge" style="--role-color:${member.role === 'owner' ? '#7B6CF6' : '#4A90D9'}">${roleLabel}</span>
        </div>
        ${isOverloaded ? `<span class="team-overload-badge">${t('team_overload')}</span>` : ''}
      </div>

      <div class="team-card-stats">
        <div class="team-stat">
          <div class="team-stat-value" style="color:#F5A623">${member.pending}</div>
          <div class="team-stat-label">${t('team_pending')}</div>
        </div>
        <div class="team-stat">
          <div class="team-stat-value" style="color:#7B6CF6">${member.in_progress}</div>
          <div class="team-stat-label">${t('team_in_progress')}</div>
        </div>
        <div class="team-stat">
          <div class="team-stat-value" style="color:#1DB954">${member.done}</div>
          <div class="team-stat-label">${t('team_done')}</div>
        </div>
        <div class="team-stat">
          <div class="team-stat-value">${total}</div>
          <div class="team-stat-label">${t('team_total')}</div>
        </div>
      </div>

      <div class="team-card-progress">
        <div class="team-progress-header">
          <span>${t('team_progress')}</span>
          <span class="team-progress-pct">${donePct}%</span>
        </div>
        <div class="team-progress-bar">
          <div class="team-progress-fill" style="width:${donePct}%; background:${color}"></div>
        </div>
      </div>
    </div>`;
  }).join('');
}

window.Pages.team.openInvite = function() {
  document.getElementById('form-invite').reset();
  document.getElementById('modal-invite').classList.add('active');

  document.getElementById('form-invite').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await API.inviteEmployee({
        name: document.getElementById('invite-name').value,
        email: document.getElementById('invite-email').value,
        password: document.getElementById('invite-password').value,
      });
      document.getElementById('modal-invite').classList.remove('active');
      clearCache('/api/team');
      window.Pages.team();
      showToast(t('team_invited') || 'Miembro invitado');
    } catch (err) {
      showToast(err.message);
    }
  };
};

function renderTeamDistribution(workload) {
  const el = document.getElementById('team-distribution');
  if (!el) return;

  const totalTasks = workload.reduce((s, m) => s + m.total, 0);

  el.innerHTML = `
    <div class="team-dist-header">
      <h3>${t('team_distribution')}</h3>
      <span class="team-dist-total">${totalTasks} ${t('team_total_tasks')}</span>
    </div>
    <div class="team-dist-list">
      ${workload.map((member, i) => {
        const color = TEAM_COLORS[i % TEAM_COLORS.length];
        const pct = totalTasks ? Math.round((member.total / totalTasks) * 100) : 0;
        const donePct = member.total ? Math.round((member.done / member.total) * 100) : 0;
        return `
        <div class="team-dist-row" style="animation-delay:${i * 60}ms">
          <div class="team-dist-member">
            <div class="team-avatar-sm" style="background:${color}">${esc(member.name.charAt(0))}</div>
            <div class="team-dist-name">${esc(member.name)}</div>
          </div>
          <div class="team-dist-bars">
            <div class="team-dist-bar-wrap">
              <div class="team-dist-bar" style="width:${pct}%; background:${color}"></div>
            </div>
            <div class="team-dist-numbers">
              <span class="team-dist-count">${member.total} ${t('team_tasks')}</span>
              <span class="team-dist-pct">${pct}%</span>
            </div>
          </div>
          <div class="team-dist-mini-stats">
            <span style="color:#F5A623" title="${t('team_pending')}">${member.pending}</span>
            <span style="color:#7B6CF6" title="${t('team_in_progress')}">${member.in_progress}</span>
            <span style="color:#1DB954" title="${t('team_done')}">${member.done}</span>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}
