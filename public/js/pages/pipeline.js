const PIPELINE_STAGES = ['lead', 'proposal', 'development', 'delivered', 'paid'];
const PIPELINE_COLORS = { lead: '#4A90D9', proposal: '#F5A623', development: '#7B6CF6', delivered: '#1DB954', paid: '#00CEC9' };
const PIPE_AVATAR_COLORS = ['#7B6CF6','#E84393','#4A90D9','#1DB954','#F5A623','#00CEC9'];

function getPipelineLabels() {
  return {
    lead: t('stage_lead'),
    proposal: t('stage_proposal'),
    development: t('stage_development'),
    delivered: t('stage_delivered'),
    paid: t('stage_paid'),
  };
}

window.Pages.pipeline = async function() {
  try {
    const clients = await API.getClients();
    const labels = getPipelineLabels();

    // Update column headers
    document.querySelectorAll('.pipeline-column h4').forEach(h4 => {
      const col = h4.closest('.pipeline-column');
      const cardsEl = col.querySelector('.pipeline-cards');
      if (cardsEl) {
        const stage = cardsEl.dataset.stage;
        if (stage && labels[stage]) h4.textContent = labels[stage];
      }
    });

    renderPipelineKPIs(clients);

    const newBtn = document.getElementById('btn-new-pipeline-client');
    if (newBtn) newBtn.textContent = t('pipeline_new');

    PIPELINE_STAGES.forEach(stage => {
      const container = document.querySelector(`.pipeline-cards[data-stage="${stage}"]`);
      const stageClients = clients.filter(c => c.pipeline_stage === stage);

      const countBadge = document.querySelector(`[data-stage-count="${stage}"]`);
      if (countBadge) countBadge.textContent = stageClients.length;

      container.innerHTML = stageClients.map((client, i) => {
        const stageIdx = PIPELINE_STAGES.indexOf(stage);
        const prevStage = stageIdx > 0 ? PIPELINE_STAGES[stageIdx - 1] : null;
        const nextStage = stageIdx < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[stageIdx + 1] : null;

        return `
          <div class="pipeline-card" draggable="true" data-id="${client.id}" style="animation-delay:${i * 50}ms">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
              <div style="width:32px;height:32px;border-radius:50%;background:${PIPE_AVATAR_COLORS[i % PIPE_AVATAR_COLORS.length]};display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:0.75rem;flex-shrink:0;">${esc(client.name.charAt(0))}</div>
              <div>
                <h5 style="margin:0;">${esc(client.name)}</h5>
                <small>${esc(client.company) || t('pipeline_no_company')}</small>
              </div>
            </div>
            ${client.email ? `<div style="font-size:0.75rem;color:var(--text-muted);display:flex;align-items:center;gap:6px;margin-top:4px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              ${esc(client.email)}
            </div>` : ''}
            ${client.phone ? `<div class="pc-phone">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72"/></svg>
              ${esc(client.phone)}
            </div>` : ''}
            ${client.notes ? `<div class="pc-notes">${esc(client.notes)}</div>` : ''}
            <div class="pc-stage-actions">
              ${prevStage ? `<button class="pc-move-btn" onclick="Pages.pipeline.move(${client.id},'${prevStage}')" title="${t('pipeline_move_to', { stage: labels[prevStage] })}">← ${labels[prevStage].slice(0,8)}</button>` : ''}
              ${nextStage ? `<button class="pc-move-btn" onclick="Pages.pipeline.move(${client.id},'${nextStage}')" title="${t('pipeline_move_to', { stage: labels[nextStage] })}">${labels[nextStage].slice(0,8)} →</button>` : ''}
            </div>
          </div>
        `;
      }).join('');

      if (stageClients.length === 0) {
        container.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem;padding:20px 8px;text-align:center;opacity:0.6;">${t('pipeline_drag_hint')}</div>`;
      }
    });

    setupDragAndDrop();

    const form = document.getElementById('form-client');
    form.onsubmit = async (e) => {
      e.preventDefault();
      await API.createClient({
        name: document.getElementById('client-name').value,
        company: document.getElementById('client-company').value,
        email: document.getElementById('client-email').value,
        phone: document.getElementById('client-phone').value,
        notes: document.getElementById('client-notes').value,
      });
      document.getElementById('modal-client').classList.remove('active');
      form.reset();
      window.Pages.pipeline();
    };

  } catch (err) {
    console.error('Error cargando pipeline:', err);
  }
};

function renderPipelineKPIs(clients) {
  const container = document.getElementById('pipeline-kpis');
  const total = clients.length;
  const labels = getPipelineLabels();

  container.innerHTML = PIPELINE_STAGES.map((stage, i) => {
    const count = clients.filter(c => c.pipeline_stage === stage).length;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `
      <div class="pipeline-kpi-item" style="--kpi-accent:${PIPELINE_COLORS[stage]}; animation-delay:${i * 50}ms">
        <div class="pki-value">${count}</div>
        <div class="pki-label">${labels[stage]} (${pct}%)</div>
      </div>
    `;
  }).join('');
}

window.Pages.pipeline.openNewClient = function() {
  document.getElementById('modal-client').classList.add('active');
};

window.Pages.pipeline.move = async function(clientId, newStage) {
  await API.updateClient(clientId, { pipeline_stage: newStage });
  window.Pages.pipeline();
};

function setupDragAndDrop() {
  const cards = document.querySelectorAll('.pipeline-card');
  const columns = document.querySelectorAll('.pipeline-cards');

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', card.dataset.id);
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });

  columns.forEach(col => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.closest('.pipeline-column').classList.add('drag-over');
    });
    col.addEventListener('dragleave', (e) => {
      if (!col.contains(e.relatedTarget)) {
        col.closest('.pipeline-column').classList.remove('drag-over');
      }
    });
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.closest('.pipeline-column').classList.remove('drag-over');
      const clientId = e.dataTransfer.getData('text/plain');
      const newStage = col.dataset.stage;
      await API.updateClient(clientId, { pipeline_stage: newStage });
      window.Pages.pipeline();
    });
  });
}
