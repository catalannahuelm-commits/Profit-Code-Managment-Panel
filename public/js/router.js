// Router SPA + flujo login/app + theme toggle

window.currentUser = null;
window._currentPage = null;

const ICONS = {
  dashboard: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  pipeline: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  clients: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  projects: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  tasks: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  invoices: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  expenses: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  team: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
};

const OWNER_NAV = ['dashboard','pipeline','clients','projects','tasks','invoices','expenses','team'];
const EMPLOYEE_NAV = ['tasks'];

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

  const navPages = window.currentUser.role === 'owner' ? OWNER_NAV : EMPLOYEE_NAV;
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
    m.classList.remove('active');
    const form = m.querySelector('form');
    if (form) form.reset();
  });
  document.querySelectorAll('.cs-wrapper').forEach(w => w.remove());
  document.querySelectorAll('select[data-upgraded]').forEach(s => {
    s.removeAttribute('data-upgraded');
    s.style.display = '';
  });
  const notifPanel = document.getElementById('notification-panel');
  if (notifPanel) notifPanel.classList.remove('active');

  // Load page
  const content = document.getElementById('main-content');
  try {
    const res = await fetch(`/pages/${page}.html`);
    if (res.ok) {
      content.innerHTML = await res.text();
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
  const loginCard = document.querySelector('.login-card:not(.register-card)');
  const registerCard = document.getElementById('register-card');
  if (registerCard.style.display === 'none') {
    loginCard.style.display = 'none';
    registerCard.style.display = '';
  } else {
    loginCard.style.display = '';
    registerCard.style.display = 'none';
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
