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

  // Search
  search(q) { return this.request('GET', `/api/search?q=${encodeURIComponent(q)}`); },

  // Team invite
  inviteEmployee(data) { return this.request('POST', '/api/team/invite', data); },

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
  deleteProject(id) { return this.request('DELETE', `/api/projects/${id}`); },

  // Tasks
  getTasks() { return this.request('GET', '/api/tasks'); },
  getMyTasks() { return this.request('GET', '/api/tasks/mine'); },
  createTask(data) { return this.request('POST', '/api/tasks', data); },
  updateTask(id, data) { return this.request('PUT', `/api/tasks/${id}`, data); },
  deleteTask(id) { return this.request('DELETE', `/api/tasks/${id}`); },

  // Task Comments
  getComments(taskId) { return this.request('GET', `/api/tasks/${taskId}/comments`); },
  addComment(taskId, content) { return this.request('POST', `/api/tasks/${taskId}/comments`, { content }); },

  // Invoices
  getInvoices() { return this.request('GET', '/api/invoices'); },
  createInvoice(data) { return this.request('POST', '/api/invoices', data); },
  updateInvoice(id, data) { return this.request('PUT', `/api/invoices/${id}`, data); },
  deleteInvoice(id) { return this.request('DELETE', `/api/invoices/${id}`); },

  // Expenses
  getExpenses() { return this.request('GET', '/api/invoices/expenses'); },
  createExpense(data) { return this.request('POST', '/api/invoices/expenses', data); },
  deleteExpense(id) { return this.request('DELETE', `/api/invoices/expenses/${id}`); },

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
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const json = await this.request('POST', '/api/profile/avatar', { image: reader.result });
          resolve(json);
        } catch (e) { reject(e); }
      };
      reader.onerror = () => reject(new Error('Error leyendo archivo'));
      reader.readAsDataURL(file);
    });
  },

  // Badges
  getBadges(userId) { return this.request('GET', userId ? `/api/badges/user/${userId}` : '/api/badges/user'); },
  getBadgeCatalog() { return this.request('GET', '/api/badges/catalog'); },
  checkBadges() { return this.request('POST', '/api/badges/check'); },
  giveBadge(data) { return this.request('POST', '/api/badges/give', data); },
  deleteManualBadge(id) { return this.request('DELETE', `/api/badges/manual/${id}`); },

  // Chat
  getChat() { return this.request('GET', '/api/chat'); },
  sendChat(message) { return this.request('POST', '/api/chat', { message }); },

  // Time tracking
  getTimeEntries() { return this.request('GET', '/api/time'); },
  createTimeEntry(data) { return this.request('POST', '/api/time', data); },
  deleteTimeEntry(id) { return this.request('DELETE', `/api/time/${id}`); },

  // Templates
  getTemplates() { return this.request('GET', '/api/templates'); },
  createTemplate(data) { return this.request('POST', '/api/templates', data); },
  applyTemplate(data) { return this.request('POST', '/api/templates/apply', data); },
  deleteTemplate(id) { return this.request('DELETE', `/api/templates/${id}`); },

  // Client portal
  getPortalTokens() { return this.request('GET', '/api/portal'); },
  createPortalToken(project_id) { return this.request('POST', '/api/portal', { project_id }); },
  viewPortal(token) { return this.request('GET', `/api/portal/view/${token}`); },
  deletePortalToken(id) { return this.request('DELETE', `/api/portal/${id}`); },

  // Webhooks
  getWebhooks() { return this.request('GET', '/api/webhooks'); },
  createWebhook(data) { return this.request('POST', '/api/webhooks', data); },
  deleteWebhook(id) { return this.request('DELETE', `/api/webhooks/${id}`); },

  // AI
  aiGenerate(type, context) { return this.request('POST', '/api/ai/generate', { type, context }); },

  // Meetings
  getMeetings() { return this.request('GET', '/api/meetings'); },
  createMeeting(data) { return this.request('POST', '/api/meetings', data); },
  updateMeeting(id, data) { return this.request('PUT', `/api/meetings/${id}`, data); },
  deleteMeeting(id) { return this.request('DELETE', `/api/meetings/${id}`); },

  // Notes
  getNotes() { return this.request('GET', '/api/profile/notes'); },
  createNote(data) { return this.request('POST', '/api/profile/notes', data); },
  updateNote(id, data) { return this.request('PUT', `/api/profile/notes/${id}`, data); },
  deleteNote(id) { return this.request('DELETE', `/api/profile/notes/${id}`); },
};
