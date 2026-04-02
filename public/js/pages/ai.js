let _aiType = 'proposal';
let _lastResult = '';

window.Pages.ai = async function() {};

window.Pages.ai.setType = function(type, btn) {
  _aiType = type;
  document.querySelectorAll('.ai-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};

window.Pages.ai.generate = async function() {
  const context = document.getElementById('ai-context').value.trim();
  if (!context) return showToast(t('ai_no_context'));

  const btn = document.getElementById('ai-generate-btn');
  const btnText = document.getElementById('ai-btn-text');
  const loader = document.getElementById('ai-loader');
  const resultEl = document.getElementById('ai-result');

  btn.disabled = true;
  btnText.style.display = 'none';
  loader.style.display = 'block';
  resultEl.innerHTML = '<div class="sk sk-row"></div><div class="sk sk-row"></div><div class="sk sk-row"></div>';

  try {
    const data = await API.aiGenerate(_aiType, context);
    _lastResult = data.result;

    if (_aiType === 'tasks') {
      try {
        const tasks = JSON.parse(data.result);
        resultEl.innerHTML = tasks.map((t, i) => `
          <div class="meeting-item" style="--meeting-color:#7B6CF6; animation-delay:${i * 40}ms">
            <div class="meeting-accent" style="background:${t.priority === 'high' ? '#E74C3C' : t.priority === 'low' ? '#1DB954' : '#F5A623'}"></div>
            <div class="meeting-body">
              <div class="meeting-header"><strong>${esc(t.title)}</strong></div>
              ${t.description ? `<div class="meeting-meta"><span>${esc(t.description)}</span></div>` : ''}
            </div>
          </div>
        `).join('');
      } catch {
        resultEl.innerHTML = `<pre class="ai-pre">${esc(data.result)}</pre>`;
      }
    } else {
      resultEl.innerHTML = `<div class="ai-markdown">${formatMarkdown(data.result)}</div>`;
    }

    document.getElementById('ai-actions').style.display = 'flex';
  } catch (err) {
    resultEl.innerHTML = `<div class="empty-state" style="padding:20px"><p style="color:var(--danger)">${esc(err.message)}</p></div>`;
  } finally {
    btn.disabled = false;
    btnText.style.display = 'inline';
    loader.style.display = 'none';
  }
};

window.Pages.ai.copy = function() {
  navigator.clipboard.writeText(_lastResult).then(() => showToast(t('ai_copied')));
};

function formatMarkdown(text) {
  return text
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}
