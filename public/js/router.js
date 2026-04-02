// Router SPA + flujo login/app + theme toggle

window.currentUser = null;
window._currentPage = null;
const _pageCache = {};
const _appVersion = '31';

const ICONS = {
  dashboard: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  pipeline: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  clients: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  projects: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  tasks: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  invoices: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  expenses: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  chat: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  timetrack: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  ai: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M16 14v1a4 4 0 0 1-8 0v-1"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>',
  meetings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  templates: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
  team: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
};

const OWNER_NAV = ['dashboard','pipeline','clients','projects','tasks','invoices','expenses','meetings','timetrack','templates','chat','ai','team'];
const ADMIN_NAV = ['dashboard','pipeline','clients','projects','tasks','invoices','expenses','meetings','timetrack','templates','chat','ai','team'];
const MANAGER_NAV = ['dashboard','clients','projects','tasks','meetings','timetrack','chat'];
const EMPLOYEE_NAV = ['tasks','timetrack','chat','meetings'];

// Theme
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  syncThemeCheckbox(saved);
}

function toggleTheme() {
  const checkbox = document.getElementById('theme-input');
  const next = checkbox && checkbox.checked ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  if (window.Pages.dashboard && document.getElementById('chart-revenue')) {
    window.Pages.dashboard();
  }
}

function syncThemeCheckbox(theme) {
  const checkbox = document.getElementById('theme-input');
  if (checkbox) checkbox.checked = (theme === 'dark');
}

// Init
async function init() {
  initTheme();
  updateLoginTexts();
  try {
    window.currentUser = await API.me();
    showApp();
  } catch {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('login-view').style.display = 'flex';
  document.getElementById('app-view').style.display = 'none';
  updateLoginTexts();
  disconnectSocket();
}

function showApp() {
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('app-view').style.display = 'grid';

  const userNameEl = document.getElementById('user-name');
  if (userNameEl) userNameEl.textContent = window.currentUser.name;
  const userRoleEl = document.getElementById('user-role');
  if (userRoleEl) userRoleEl.textContent =
    window.currentUser.role === 'owner' ? t('owner') : t('employee');

  const avatar = document.getElementById('header-avatar');
  if (avatar) avatar.textContent = window.currentUser.name.charAt(0).toUpperCase();

  const roleNavMap = { owner: OWNER_NAV, admin: ADMIN_NAV, manager: MANAGER_NAV, employee: EMPLOYEE_NAV };
  const navPages = roleNavMap[window.currentUser.role] || EMPLOYEE_NAV;
  const navContainer = document.getElementById('sidebar-nav');
  navContainer.innerHTML = navPages.map(page => {
    const label = t(`nav_${page}`);
    return `<a href="#${page}" data-page="${page}" data-tooltip="${label}">
      <span class="nav-icon">${ICONS[page] || ''}</span>
      <span class="nav-label">${label}</span>
    </a>`;
  }).join('');

  navContainer.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link.dataset.page);
    });
  });

  // Sidebar tooltips — positioned with JS, never off-screen
  setupSidebarTooltips(navContainer);

  // Language selector in sidebar
  const langContainer = document.getElementById('sidebar-lang');
  if (langContainer) {
    langContainer.innerHTML = '';
    langContainer.appendChild(renderLangSelector());
  }

  // Profile navigation
  const settingsBtn = document.querySelector('.sidebar-help');
  if (settingsBtn) settingsBtn.onclick = () => navigateTo('profile');
  const headerAvatar = document.getElementById('header-avatar');
  if (headerAvatar) headerAvatar.onclick = () => navigateTo('profile');

  connectSocket();
  updateNotificationCount();

  const defaultPage = window.currentUser.role === 'owner' ? 'dashboard' : 'tasks';
  navigateTo(defaultPage);
  showOnboarding();

  // Load Chart.js + Flatpickr, then re-render current page so charts appear
  loadLibs(() => {
    if (window._currentPage && window.Pages[window._currentPage]) {
      window.Pages[window._currentPage]();
    }
  });

  // Prefetch all pages in background
  setTimeout(() => {
    const pages = window.currentUser.role === 'owner'
      ? ['pipeline','clients','projects','tasks','invoices','expenses','meetings','timetrack','templates','chat','ai','team','profile']
      : ['profile'];
    pages.forEach(p => {
      if (!_pageCache[p]) fetch(`/pages/${p}.html?v=${_appVersion}`).then(r => r.ok ? r.text() : '').then(html => { if (html) _pageCache[p] = html; });
    });
  }, 2000);
}

async function navigateTo(page) {
  window._currentPage = page;

  // Update nav
  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });

  // Update title + subtitle
  document.getElementById('page-title').textContent = t(`page_${page}`);
  const subtitle = document.getElementById('page-subtitle');
  if (subtitle) subtitle.textContent = t(`page_${page}_sub`);

  // Override tasks title for employees
  if (page === 'tasks' && window.currentUser && window.currentUser.role !== 'owner') {
    document.getElementById('page-title').textContent = t('nav_my_tasks');
  }

  // Close any open modals/panels and cleanup custom selects
  document.querySelectorAll('.modal-overlay.active').forEach(m => {
    closeModal(m.id);
  });
  document.querySelectorAll('.cs-wrapper').forEach(w => w.remove());
  document.querySelectorAll('select[data-upgraded]').forEach(s => {
    s.removeAttribute('data-upgraded');
    s.style.display = '';
  });
  const notifPanel = document.getElementById('notification-panel');
  if (notifPanel) notifPanel.classList.remove('active');

  // Load page (cached)
  const content = document.getElementById('main-content');
  try {
    if (!_pageCache[page]) {
      const res = await fetch(`/pages/${page}.html?v=${_appVersion}`);
      if (res.ok) _pageCache[page] = await res.text();
    }
    if (_pageCache[page]) {
      content.innerHTML = _pageCache[page];
      content.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
      // Translate static elements in loaded page
      translateStaticElements();
      if (window.Pages && window.Pages[page]) {
        window.Pages[page]();
      }
    } else {
      content.innerHTML = `
        <div class="empty-state">
          <div class="icon">🚧</div>
          <p>${t('loading')}</p>
        </div>`;
    }
  } catch {
    content.innerHTML = `
      <div class="empty-state">
        <div class="icon">❌</div>
        <p>Error</p>
      </div>`;
  }
}

// Onboarding wizard
function showOnboarding() {
  if (localStorage.getItem('onboarding-done')) return;

  const ob = {
    es: [
      { icon: '👋', title: '¡Bienvenido a Profit Code!', desc: 'Tu panel de gestión está listo. Te mostramos cómo funciona en 30 segundos.' },
      { icon: '👥', title: 'Clientes y Pipeline', desc: 'Cargá tus clientes y arrastralos por las etapas del pipeline: Lead → Propuesta → Desarrollo → Entregado → Cobrado.' },
      { icon: '📁', title: 'Proyectos y Tareas', desc: 'Creá proyectos, asigná tareas a tu equipo, y controlá el progreso con deadlines y prioridades.' },
      { icon: '💰', title: 'Facturación y Gastos', desc: 'Registrá facturas por proyecto, controlá tus gastos, y tené siempre claro tu ganancia neta.' },
      { icon: '🤖', title: 'IA y más', desc: 'Usá la IA para generar propuestas, chatear con tu equipo, trackear tiempo, y compartir progreso con clientes.' },
      { icon: '🚀', title: '¡Listo para arrancar!', desc: 'Empezá creando tu primer cliente desde el Pipeline. Cualquier duda, explorá cada sección del sidebar.' },
    ],
    en: [
      { icon: '👋', title: 'Welcome to Profit Code!', desc: 'Your management panel is ready. We\'ll show you how it works in 30 seconds.' },
      { icon: '👥', title: 'Clients & Pipeline', desc: 'Add your clients and drag them through pipeline stages: Lead → Proposal → Development → Delivered → Paid.' },
      { icon: '📁', title: 'Projects & Tasks', desc: 'Create projects, assign tasks to your team, and track progress with deadlines and priorities.' },
      { icon: '💰', title: 'Billing & Expenses', desc: 'Create invoices per project, track expenses, and always know your net profit.' },
      { icon: '🤖', title: 'AI & more', desc: 'Use AI to generate proposals, chat with your team, track time, and share progress with clients.' },
      { icon: '🚀', title: 'Ready to go!', desc: 'Start by creating your first client from the Pipeline. Explore each sidebar section.' },
    ],
    pt: [
      { icon: '👋', title: 'Bem-vindo ao Profit Code!', desc: 'Seu painel de gestão está pronto. Vamos te mostrar como funciona em 30 segundos.' },
      { icon: '👥', title: 'Clientes e Pipeline', desc: 'Adicione clientes e arraste-os pelas etapas do pipeline: Lead → Proposta → Desenvolvimento → Entregue → Pago.' },
      { icon: '📁', title: 'Projetos e Tarefas', desc: 'Crie projetos, atribua tarefas à equipe e acompanhe o progresso com prazos e prioridades.' },
      { icon: '💰', title: 'Faturamento e Despesas', desc: 'Registre faturas por projeto, controle despesas e tenha sempre claro seu lucro líquido.' },
      { icon: '🤖', title: 'IA e mais', desc: 'Use IA para gerar propostas, conversar com a equipe, registrar tempo e compartilhar progresso com clientes.' },
      { icon: '🚀', title: 'Pronto para começar!', desc: 'Comece criando seu primeiro cliente no Pipeline. Explore cada seção do menu lateral.' },
    ]
  };
  const steps = ob[getLang()] || ob.es;

  let current = 0;

  function render() {
    const existing = document.querySelector('.onboarding-overlay');
    if (existing) existing.remove();

    const s = steps[current];
    const overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';
    overlay.innerHTML = `
      <div class="onboarding-box">
        <div class="onboarding-step-indicator">
          ${steps.map((_, i) => `<div class="onboarding-dot ${i < current ? 'done' : ''} ${i === current ? 'active' : ''}"></div>`).join('')}
        </div>
        <div class="onboarding-icon">${s.icon}</div>
        <div class="onboarding-title">${s.title}</div>
        <div class="onboarding-desc">${s.desc}</div>
        <div class="onboarding-actions">
          ${current < steps.length - 1 ? '<button class="onboarding-btn-skip" id="ob-skip">' + ({es:'Saltar',en:'Skip',pt:'Pular'}[getLang()] || 'Saltar') + '</button>' : ''}
          <button class="onboarding-btn-next" id="ob-next">${current === steps.length - 1 ? ({es:'¡Empezar!',en:'Let\'s go!',pt:'Vamos!'}[getLang()] || '¡Empezar!') : ({es:'Siguiente →',en:'Next →',pt:'Próximo →'}[getLang()] || 'Siguiente →')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#ob-next').onclick = () => {
      if (current < steps.length - 1) { current++; render(); }
      else { overlay.remove(); localStorage.setItem('onboarding-done', '1'); }
    };
    const skipBtn = overlay.querySelector('#ob-skip');
    if (skipBtn) skipBtn.onclick = () => {
      overlay.remove(); localStorage.setItem('onboarding-done', '1');
    };
  }

  setTimeout(render, 1000);
}

// Global search
(function() {
  const searchInput = document.querySelector('.header-search input');
  if (!searchInput) return;
  let searchTimer = null;
  let searchDropdown = null;

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) { closeSearchDropdown(); return; }
    searchTimer = setTimeout(async () => {
      try {
        const results = await API.search(q);
        showSearchResults(results);
      } catch {}
    }, 300);
  });

  searchInput.addEventListener('blur', () => setTimeout(closeSearchDropdown, 200));

  function showSearchResults(results) {
    closeSearchDropdown();
    if (!results.length) return;

    searchDropdown = document.createElement('div');
    searchDropdown.className = 'search-dropdown';
    const icons = { client: '👤', project: '📁', task: '✅' };
    const pages = { client: 'clients', project: 'projects', task: 'tasks' };

    searchDropdown.innerHTML = results.map(r => `
      <div class="search-result-item" data-page="${pages[r.type]}">
        <span class="search-result-icon">${icons[r.type]}</span>
        <div>
          <div class="search-result-label">${esc(r.label)}</div>
          ${r.sub ? `<div class="search-result-sub">${esc(r.sub)}</div>` : ''}
        </div>
        <span class="search-result-type">${r.type}</span>
      </div>
    `).join('');

    searchDropdown.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        navigateTo(item.dataset.page);
        searchInput.value = '';
        closeSearchDropdown();
      });
    });

    searchInput.parentElement.appendChild(searchDropdown);
  }

  function closeSearchDropdown() {
    if (searchDropdown) { searchDropdown.remove(); searchDropdown = null; }
  }
})();

// Sidebar tooltips
function setupSidebarTooltips(container) {
  let tip = document.getElementById('sidebar-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'sidebar-tip';
    tip.className = 'sidebar-tooltip';
    document.body.appendChild(tip);
  }

  container.querySelectorAll('a[data-tooltip]').forEach(link => {
    link.addEventListener('mouseenter', () => {
      const text = link.dataset.tooltip;
      tip.textContent = text;
      tip.classList.add('visible');

      const rect = link.getBoundingClientRect();
      const tipH = tip.offsetHeight;
      let top = rect.top + rect.height / 2 - tipH / 2;

      // Keep within viewport
      if (top < 8) top = 8;
      if (top + tipH > window.innerHeight - 8) top = window.innerHeight - tipH - 8;

      tip.style.left = (rect.right + 12) + 'px';
      tip.style.top = top + 'px';
    });

    link.addEventListener('mouseleave', () => {
      tip.classList.remove('visible');
    });
  });
}

// Login form
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');

  const btn = document.getElementById('login-btn');
  const btnText = btn.querySelector('.login-btn-text');
  const btnLoader = btn.querySelector('.login-btn-loader');

  try {
    btn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnLoader) btnLoader.style.display = 'block';

    window.currentUser = await API.login(email, password);
    errorEl.style.display = 'none';
    showApp();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    if (btnText) btnText.style.display = 'inline';
    if (btnLoader) btnLoader.style.display = 'none';
  }
});

// Logout
document.getElementById('btn-logout').addEventListener('click', async () => {
  await API.logout();
  window.currentUser = null;
  document.getElementById('main-content').innerHTML = '';
  showLogin();
});

// Toggle login/register
function toggleAuthMode() {
  const loginDiv = document.getElementById('auth-login');
  const registerDiv = document.getElementById('auth-register');
  if (registerDiv.style.display === 'none') {
    loginDiv.style.display = 'none';
    registerDiv.style.display = '';
  } else {
    loginDiv.style.display = '';
    registerDiv.style.display = 'none';
  }
}

// Register form
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('register-error');
  const btn = document.getElementById('register-btn');
  const btnText = document.getElementById('register-btn-text');
  const btnLoader = btn.querySelector('.login-btn-loader');

  try {
    btn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnLoader) btnLoader.style.display = 'block';

    window.currentUser = await API.register({
      org_name: document.getElementById('reg-org-name').value,
      name: document.getElementById('reg-name').value,
      email: document.getElementById('reg-email').value,
      password: document.getElementById('reg-password').value,
    });
    errorEl.style.display = 'none';
    showApp();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    if (btnText) btnText.style.display = 'inline';
    if (btnLoader) btnLoader.style.display = 'none';
  }
});

// Start
init();
