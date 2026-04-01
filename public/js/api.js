// Sanitizar texto para evitar XSS al usar innerHTML
function esc(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// API response cache
const _apiCache = {};
const CACHE_TTL = 20000; // 20 seconds

function getCached(key) {
  const entry = _apiCache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  _apiCache[key] = { data, ts: Date.now() };
}

function clearCache(prefix) {
  if (!prefix) { Object.keys(_apiCache).forEach(k => delete _apiCache[k]); return; }
  Object.keys(_apiCache).forEach(k => { if (k.startsWith(prefix)) delete _apiCache[k]; });
}

const API = {
  async request(method, url, data) {
    // Return cached GET responses
    if (method === 'GET') {
      const cached = getCached(url);
      if (cached) return cached;
    }
    // Invalidate cache on mutations
    if (method !== 'GET') {
      const prefix = '/api/' + url.split('/')[2];
      clearCache(prefix);
    }

    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (data) options.body = JSON.stringify(data);

    const res = await fetch(url, options);
    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || 'Error del servidor');
    }

    if (method === 'GET') setCache(url, json);
    return json;
  },

  // Auth
  login(email, password) {
    return this.request('POST', '/api/auth/login', { email, password });
  },
  register(data) {
    return this.request('POST', '/api/auth/register', data);
  },
  logout() {
    return this.request('POST', '/api/auth/logout');
  },
  me() {
    return this.request('GET', '/api/auth/me');
  },

  // Clients
  getClients() { return this.request('GET', '/api/clients'); },
  getClient(id) { return this.request('GET', `/api/clients/${id}`); },
  createClient(data) { return this.request('POST', '/api/clients', data); },
  updateClient(id, data) { return this.request('PUT', `/api/clients/${id}`, data); },
  deleteClient(id) { return this.request('DELETE', `/api/clients/${id}`); },

  // Projects
  getProjects() { return this.request('GET', '/api/projects'); },
  getProject(id) { return this.request('GET', `/api/projects/${id}`); },
  createProject(data) { return this.request('POST', '/api/projects', data); },
  updateProject(id, data) { return this.request('PUT', `/api/projects/${id}`, data); },

  // Tasks
  getTasks() { return this.request('GET', '/api/tasks'); },
  getMyTasks() { return this.request('GET', '/api/tasks/mine'); },
  createTask(data) { return this.request('POST', '/api/tasks', data); },
  updateTask(id, data) { return this.request('PUT', `/api/tasks/${id}`, data); },

  // Task Comments
  getComments(taskId) { return this.request('GET', `/api/tasks/${taskId}/comments`); },
  addComment(taskId, content) { return this.request('POST', `/api/tasks/${taskId}/comments`, { content }); },

  // Invoices
  getInvoices() { return this.request('GET', '/api/invoices'); },
  createInvoice(data) { return this.request('POST', '/api/invoices', data); },
  updateInvoice(id, data) { return this.request('PUT', `/api/invoices/${id}`, data); },

  // Expenses
  getExpenses() { return this.request('GET', '/api/invoices/expenses'); },
  createExpense(data) { return this.request('POST', '/api/invoices/expenses', data); },

  // Dashboard
  getDashboard() { return this.request('GET', '/api/dashboard'); },

  // Team
  getTeamWorkload() { return this.request('GET', '/api/team/workload'); },

  // Notifications
  getNotifications() { return this.request('GET', '/api/notifications'); },

  // Profile
  getProfile() { return this.request('GET', '/api/profile'); },
  updateProfile(data) { return this.request('PUT', '/api/profile', data); },
  updatePassword(data) { return this.request('PUT', '/api/profile/password', data); },
  async uploadAvatar(file) {
    const form = new FormData();
    form.append('avatar', file);
    const res = await fetch('/api/profile/avatar', { method: 'POST', body: form });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al subir avatar');
    return json;
  },

  // Badges
  getBadges(userId) { return this.request('GET', userId ? `/api/badges/user/${userId}` : '/api/badges/user'); },
  getBadgeCatalog() { return this.request('GET', '/api/badges/catalog'); },
  checkBadges() { return this.request('POST', '/api/badges/check'); },
  giveBadge(data) { return this.request('POST', '/api/badges/give', data); },
  deleteManualBadge(id) { return this.request('DELETE', `/api/badges/manual/${id}`); },

  // Notes
  getNotes() { return this.request('GET', '/api/profile/notes'); },
  createNote(data) { return this.request('POST', '/api/profile/notes', data); },
  updateNote(id, data) { return this.request('PUT', `/api/profile/notes/${id}`, data); },
  deleteNote(id) { return this.request('DELETE', `/api/profile/notes/${id}`); },
};
