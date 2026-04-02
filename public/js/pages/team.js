const TEAM_COLORS = ['#7B6CF6','#E84393','#4A90D9','#1DB954','#F5A623','#00CEC9'];

const ROLE_CONFIG = {
  owner:    { color: '#7B6CF6', modules: ['dashboard','pipeline','clients','projects','tasks','invoices','expenses','meetings','timetrack','templates','chat','ai','team'] },
  admin:    { color: '#E84393', modules: ['dashboard','pipeline','clients','projects','tasks','invoices','expenses','meetings','timetrack','templates','chat','ai','team'] },
  manager:  { color: '#4A90D9', modules: ['dashboard','clients','projects','tasks','meetings','timetrack','chat'] },
  employee: { color: '#1DB954', modules: ['tasks','timetrack','chat','meetings'] },
};

function getRoleLabel(role) {
  const map = { owner: t('role_owner'), admin: t('role_admin'), manager: t('role_manager'), employee: t('role_employee') };
  return map[role] || role;
}

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

  el.innerHTML = workload.map((member, i) => {
    const color = TEAM_COLORS[i % TEAM_COLORS.length];
    const active = member.in_progress + member.pending;
    const total = member.total || 0;
    const donePct = total ? Math.round((member.done / total) * 100) : 0;
    const roleLabel = getRoleLabel(member.role);
    const roleColor = (ROLE_CONFIG[member.role] || ROLE_CONFIG.employee).color;
    const isOverloaded = active >= 5;
    const isCurrentUser = window.currentUser && member.id === window.currentUser.id;

    return `
    <div class="team-card" style="--accent:${color}; animation-delay:${i * 80}ms">
      <div class="team-card-top">
        <div class="team-avatar-lg" style="background:${color}">${esc(member.name.charAt(0))}</div>
        <div class="team-card-info">
          <div class="team-card-name">${esc(member.name)}</div>
          <span class="team-role-badge" style="--role-color:${roleColor}">${roleLabel}</span>
        </div>
        <div style="display:flex;gap:4px;align-items:center;">
          ${isOverloaded ? `<span class="team-overload-badge">${t('team_overload')}</span>` : ''}
          ${!isCurrentUser && window.currentUser?.role === 'owner' ? `<button class="card-action-btn" style="opacity:1" onclick="Pages.team.openRoleEdit(${member.id},'${member.role}')" title="${t('team_change_role')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>` : ''}
        </div>
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
      ${member.email ? `<div class="team-email" style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">${esc(member.email)}</div>` : ''}
    </div>`;
  }).join('');
}

window.Pages.team.openInvite = function() {
  document.getElementById('form-invite').reset();
  openModal('modal-invite');
  upgradeSelects(document.getElementById('modal-invite'));

  document.getElementById('form-invite').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await API.inviteEmployee({
        name: document.getElementById('invite-name').value,
        email: document.getElementById('invite-email').value,
        password: document.getElementById('invite-password').value,
      });
      // Update role if not default employee
      // Note: invite always creates as employee, then we update role
      closeModal('modal-invite');
      clearCache('/api/team');
      window.Pages.team();
      showToast(t('team_invited') || 'Miembro invitado');
    } catch (err) {
      showToast(err.message);
    }
  };
};

window.Pages.team.openRoleEdit = function(userId, currentRole) {
  document.getElementById('role-user-id').value = userId;
  document.getElementById('role-select').value = currentRole;
  updateRolePermissionsInfo(currentRole);
  openModal('modal-role');
  upgradeSelects(document.getElementById('modal-role'));

  document.getElementById('role-select').onchange = function() {
    updateRolePermissionsInfo(this.value);
  };

  document.getElementById('form-role').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await API.updateRole({
        user_id: +document.getElementById('role-user-id').value,
        role: document.getElementById('role-select').value,
      });
      closeModal('modal-role');
      clearCache('/api/team');
      window.Pages.team();
      showToast(t('team_role_updated'));
    } catch (err) {
      showToast(err.message);
    }
  };
};

function updateRolePermissionsInfo(role) {
  const el = document.getElementById('role-permissions-info');
  if (!el) return;
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.employee;
  const moduleLabels = config.modules.map(m => t(`nav_${m}`)).join(', ');
  el.innerHTML = `
    <div style="margin:12px 0;padding:12px;background:rgba(123,108,246,0.06);border-radius:8px;font-size:0.82rem;">
      <strong style="color:var(--text-heading)">${t('team_access')}:</strong>
      <p style="color:var(--text-muted);margin-top:4px">${moduleLabels}</p>
    </div>
  `;
}

window.Pages.team.exportCalendar = function() {
  window.open('/api/calendar/export', '_blank');
};

window.Pages.team.openIntegrations = async function() {
  try {
    const integrations = await API.getIntegrations();
    document.getElementById('int-slack-url').value = integrations.slack_webhook || '';
  } catch {}
  openModal('modal-integrations');

  document.getElementById('form-integrations').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await API.updateIntegrations({
        slack_webhook: document.getElementById('int-slack-url').value || null,
      });
      closeModal('modal-integrations');
      showToast(t('team_integrations_saved'));
    } catch (err) {
      showToast(err.message);
    }
  };
};

window.Pages.team.testSlack = async function() {
  const url = document.getElementById('int-slack-url').value;
  if (!url) return showToast('URL requerida');
  try {
    await API.testSlack(url);
    showToast('✅ Slack conectado!');
  } catch (err) {
    showToast('❌ ' + err.message);
  }
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
