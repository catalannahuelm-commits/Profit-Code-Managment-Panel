const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// --- AUTH HELPERS ---
function signToken(user) {
  return jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role, org_id: user.org_id }, JWT_SECRET, { expiresIn: '24h' });
}

function getUser(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/token=([^;]+)/);
  if (!match) return null;
  try { return jwt.verify(match[1], JWT_SECRET); } catch { return null; }
}

function auth(req, res) {
  const u = getUser(req);
  if (!u) { res.status(401).json({ error: 'No autorizado' }); return null; }
  return u;
}

function ownerOnly(req, res) {
  const u = auth(req, res);
  if (!u) return null;
  if (u.role !== 'owner' && u.role !== 'admin') { res.status(403).json({ error: 'Acceso denegado' }); return null; }
  return u;
}

function parsePath(url) {
  const [path] = url.split('?');
  return path.replace('/api/', '').split('/').filter(Boolean);
}

// --- MAIN HANDLER ---
module.exports = async (req, res) => {
  const parts = parsePath(req.url);
  const method = req.method;

  try {
    // ========== AUTH ==========
    if (parts[0] === 'auth') {
      if (parts[1] === 'login' && method === 'POST') {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
        const { data: users } = await supabase.from('users').select('*').eq('email', email).limit(1);
        if (!users?.length) return res.status(401).json({ error: 'Credenciales incorrectas' });
        const user = users[0];
        if (!await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: 'Credenciales incorrectas' });
        const token = signToken(user);
        res.setHeader('Set-Cookie', `token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
        return res.json({ id: user.id, name: user.name, email: user.email, role: user.role, org_id: user.org_id });
      }
      if (parts[1] === 'logout') {
        res.setHeader('Set-Cookie', 'token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
        return res.json({ ok: true });
      }
      if (parts[1] === 'me') {
        const u = auth(req, res); if (!u) return;
        return res.json({ id: u.id, name: u.name, email: u.email, role: u.role, org_id: u.org_id });
      }
      // Register new org + owner
      if (parts[1] === 'register' && method === 'POST') {
        const { org_name, name, email, password } = req.body;
        if (!org_name || !name || !email || !password) return res.status(400).json({ error: 'Todos los campos son requeridos' });
        if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        // Check email unique
        const { data: existing } = await supabase.from('users').select('id').eq('email', email).limit(1);
        if (existing?.length) return res.status(400).json({ error: 'Ese email ya está registrado' });
        // Create slug
        const slug = org_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const { data: existingOrg } = await supabase.from('organizations').select('id').eq('slug', slug).limit(1);
        if (existingOrg?.length) return res.status(400).json({ error: 'Ya existe una organización con ese nombre' });
        // Create org
        const { data: org } = await supabase.from('organizations').insert({ name: org_name, slug }).select().single();
        // Create owner user
        const hash = await bcrypt.hash(password, 10);
        const { data: user } = await supabase.from('users').insert({ name, email, password_hash: hash, role: 'owner', org_id: org.id }).select().single();
        const token = signToken(user);
        res.setHeader('Set-Cookie', `token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
        return res.json({ id: user.id, name: user.name, email: user.email, role: user.role, org_id: user.org_id });
      }
    }

    // ========== CLIENTS ==========
    if (parts[0] === 'clients') {
      if (!parts[1]) {
        if (method === 'GET') {
          const u = auth(req, res); if (!u) return;
          const { data } = await supabase.from('clients').select('*').eq('org_id', u.org_id).order('updated_at', { ascending: false });
          return res.json(data || []);
        }
        if (method === 'POST') {
          const u = ownerOnly(req, res); if (!u) return;
          const { name, company, email, phone, notes } = req.body;
          if (!name) return res.status(400).json({ error: 'Nombre requerido' });
          const { data } = await supabase.from('clients').insert({ name, company, email, phone, notes, org_id: u.org_id }).select().single();
          return res.status(201).json(data);
        }
      } else {
        const id = parts[1];
        if (method === 'GET') {
          const u = auth(req, res); if (!u) return;
          const { data } = await supabase.from('clients').select('*').eq('id', id).eq('org_id', u.org_id).single();
          return res.json(data);
        }
        if (method === 'PUT') {
          const u = ownerOnly(req, res); if (!u) return;
          const updates = {};
          ['name','company','email','phone','pipeline_stage','notes'].forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
          updates.updated_at = new Date().toISOString();
          const { data } = await supabase.from('clients').update(updates).eq('id', id).eq('org_id', u.org_id).select().single();
          return res.json(data);
        }
        if (method === 'DELETE') {
          const u = ownerOnly(req, res); if (!u) return;
          await supabase.from('clients').delete().eq('id', id).eq('org_id', u.org_id);
          return res.json({ ok: true });
        }
      }
    }

    // ========== PROJECTS ==========
    if (parts[0] === 'projects') {
      if (!parts[1]) {
        if (method === 'GET') {
          const u = auth(req, res); if (!u) return;
          const { data } = await supabase.from('projects').select('*, clients(name)').eq('org_id', u.org_id).order('created_at', { ascending: false });
          return res.json((data || []).map(p => ({ ...p, client_name: p.clients?.name, clients: undefined })));
        }
        if (method === 'POST') {
          const u = ownerOnly(req, res); if (!u) return;
          const { client_id, name, description, budget, deadline } = req.body;
          if (!client_id || !name) return res.status(400).json({ error: 'Cliente y nombre requeridos' });
          const { data } = await supabase.from('projects').insert({ client_id, name, description, budget: budget || 0, deadline, org_id: u.org_id }).select().single();
          return res.status(201).json(data);
        }
      } else {
        if (method === 'PUT') {
          const u = ownerOnly(req, res); if (!u) return;
          const updates = {};
          ['name','description','budget','cost','status','deadline'].forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
          const { data } = await supabase.from('projects').update(updates).eq('id', parts[1]).eq('org_id', u.org_id).select().single();
          return res.json(data);
        }
        if (method === 'DELETE') {
          const u = ownerOnly(req, res); if (!u) return;
          await supabase.from('tasks').delete().eq('project_id', parts[1]).eq('org_id', u.org_id);
          await supabase.from('invoices').delete().eq('project_id', parts[1]).eq('org_id', u.org_id);
          await supabase.from('expenses').delete().eq('project_id', parts[1]).eq('org_id', u.org_id);
          await supabase.from('projects').delete().eq('id', parts[1]).eq('org_id', u.org_id);
          return res.json({ ok: true });
        }
      }
    }

    // ========== TASKS ==========
    if (parts[0] === 'tasks') {
      if (!parts[1]) {
        if (method === 'GET') {
          const u = auth(req, res); if (!u) return;
          let query = supabase.from('tasks').select('*, projects(name), users(name)').eq('org_id', u.org_id).order('created_at', { ascending: false });
          if (u.role !== 'owner') query = query.eq('assigned_to', u.id);
          const { data } = await query;
          return res.json((data || []).map(t => ({ ...t, project_name: t.projects?.name, assigned_name: t.users?.name, projects: undefined, users: undefined })));
        }
        if (method === 'POST') {
          const u = ownerOnly(req, res); if (!u) return;
          const { project_id, assigned_to, title, description, priority, deadline } = req.body;
          if (!project_id || !title) return res.status(400).json({ error: 'Proyecto y título requeridos' });
          const { data } = await supabase.from('tasks').insert({ project_id, assigned_to, title, description, priority: priority || 'medium', deadline, org_id: u.org_id }).select().single();
          // Notify assigned user
          if (assigned_to) {
            const { data: assignee } = await supabase.from('users').select('email, email_prefs').eq('id', assigned_to).single();
            if (assignee?.email && (assignee.email_prefs?.task_assigned !== false)) {
              notifyEmail(assignee.email, `Nueva tarea asignada: ${title}`, `<p style="color:#c4c4d4;">Se te asignó la tarea <strong style="color:#fff;">${title}</strong>.</p><p style="color:#8888a8;">Prioridad: ${priority || 'medium'}</p>`);
            }
            notifySlack(u.org_id, `📋 Nueva tarea asignada a ${assignee?.email || '?'}: *${title}*`);
          }
          return res.status(201).json(data);
        }
      } else {
        if (method === 'PUT') {
          const u = auth(req, res); if (!u) return;
          const updates = {};
          ['title','description','status','priority','assigned_to','deadline'].forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
          updates.updated_at = new Date().toISOString();
          const { data } = await supabase.from('tasks').update(updates).eq('id', parts[1]).eq('org_id', u.org_id).select().single();
          return res.json(data);
        }
        if (method === 'DELETE') {
          const u = ownerOnly(req, res); if (!u) return;
          await supabase.from('tasks').delete().eq('id', parts[1]).eq('org_id', u.org_id);
          return res.json({ ok: true });
        }
      }
    }

    // ========== INVOICES & EXPENSES ==========
    if (parts[0] === 'invoices') {
      if (parts[1] === 'expenses') {
        if (!parts[2]) {
          if (method === 'GET') {
            const u = ownerOnly(req, res); if (!u) return;
            const { data } = await supabase.from('expenses').select('*, projects(name)').eq('org_id', u.org_id).order('date', { ascending: false });
            return res.json((data || []).map(e => ({ ...e, project_name: e.projects?.name, projects: undefined })));
          }
          if (method === 'POST') {
            const u = ownerOnly(req, res); if (!u) return;
            const { project_id, description, amount, category, date } = req.body;
            if (!description || !amount) return res.status(400).json({ error: 'Descripción y monto requeridos' });
            const { data } = await supabase.from('expenses').insert({ project_id, description, amount, category: category || 'other', date: date || new Date().toISOString().split('T')[0], org_id: u.org_id }).select().single();
            return res.status(201).json(data);
          }
        } else {
          if (method === 'DELETE') {
            const u = ownerOnly(req, res); if (!u) return;
            await supabase.from('expenses').delete().eq('id', parts[2]).eq('org_id', u.org_id);
            return res.json({ ok: true });
          }
        }
      }
      if (!parts[1]) {
        if (method === 'GET') {
          const u = ownerOnly(req, res); if (!u) return;
          const { data } = await supabase.from('invoices').select('*, clients(name), projects(name)').eq('org_id', u.org_id).order('created_at', { ascending: false });
          return res.json((data || []).map(i => ({ ...i, client_name: i.clients?.name, project_name: i.projects?.name, clients: undefined, projects: undefined })));
        }
        if (method === 'POST') {
          const u = ownerOnly(req, res); if (!u) return;
          const { project_id, amount, due_date, description } = req.body;
          if (!project_id || !amount) return res.status(400).json({ error: 'Proyecto y monto requeridos' });
          const { data: proj } = await supabase.from('projects').select('client_id').eq('id', project_id).eq('org_id', u.org_id).single();
          if (!proj) return res.status(404).json({ error: 'Proyecto no encontrado' });
          const { data } = await supabase.from('invoices').insert({ project_id, client_id: proj.client_id, amount, due_date, description, org_id: u.org_id }).select().single();
          notifySlack(u.org_id, `💰 Nueva factura creada: $${amount} — ${description || 'Sin descripción'}`);
          return res.status(201).json(data);
        }
      }
      if (parts[1] && parts[1] !== 'expenses') {
        if (method === 'PUT') {
          const u = ownerOnly(req, res); if (!u) return;
          const updates = {};
          if (req.body.status === 'paid') { updates.status = 'paid'; updates.paid_date = req.body.paid_date || new Date().toISOString().split('T')[0]; }
          else if (req.body.status) updates.status = req.body.status;
          const { data } = await supabase.from('invoices').update(updates).eq('id', parts[1]).eq('org_id', u.org_id).select('*, clients(name), projects(name)').single();
          data.client_name = data.clients?.name; data.project_name = data.projects?.name;
          delete data.clients; delete data.projects;
          return res.json(data);
        }
        if (method === 'DELETE') {
          const u = ownerOnly(req, res); if (!u) return;
          await supabase.from('invoices').delete().eq('id', parts[1]).eq('org_id', u.org_id);
          return res.json({ ok: true });
        }
      }
    }

    // ========== DASHBOARD ==========
    if (parts[0] === 'dashboard') {
      const u = ownerOnly(req, res); if (!u) return;
      const oid = u.org_id;
      const now = new Date();
      const sixAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().split('T')[0];
      const curMonth = now.toISOString().slice(0, 7);
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);
      const [inv, exp, proj, cli, tsk, topCliRes] = await Promise.all([
        supabase.from('invoices').select('amount, status, paid_date, client_id').eq('org_id', oid),
        supabase.from('expenses').select('amount, date, category').eq('org_id', oid),
        supabase.from('projects').select('id, name, status, budget, cost, deadline').eq('org_id', oid),
        supabase.from('clients').select('id, name, pipeline_stage').eq('org_id', oid),
        supabase.from('tasks').select('id, status, updated_at').eq('org_id', oid),
        supabase.from('invoices').select('client_id, amount').eq('org_id', oid).eq('status', 'paid'),
      ]);
      const invoices = inv.data || [], expenses = exp.data || [], projects = proj.data || [], clients = cli.data || [], tasks = tsk.data || [];
      const income = invoices.filter(i => i.status === 'paid' && i.paid_date?.startsWith(curMonth)).reduce((s, i) => s + i.amount, 0);
      const prevIncome = invoices.filter(i => i.status === 'paid' && i.paid_date?.startsWith(prevMonth)).reduce((s, i) => s + i.amount, 0);
      const monthExp = expenses.filter(e => e.date?.startsWith(curMonth)).reduce((s, e) => s + e.amount, 0);
      const prevExp = expenses.filter(e => e.date?.startsWith(prevMonth)).reduce((s, e) => s + e.amount, 0);
      const pipe = {}; clients.forEach(c => { pipe[c.pipeline_stage] = (pipe[c.pipeline_stage] || 0) + 1; });
      const mRev = {}, mExp = {};
      invoices.filter(i => i.status === 'paid' && i.paid_date >= sixAgo).forEach(i => { const m = i.paid_date.slice(0, 7); mRev[m] = (mRev[m] || 0) + i.amount; });
      expenses.filter(e => e.date >= sixAgo).forEach(e => { const m = e.date.slice(0, 7); mExp[m] = (mExp[m] || 0) + e.amount; });

      // Top clients by revenue
      const clientRevMap = {};
      (topCliRes.data || []).forEach(i => { clientRevMap[i.client_id] = (clientRevMap[i.client_id] || 0) + i.amount; });
      const topClients = Object.entries(clientRevMap)
        .map(([id, revenue]) => ({ id: +id, name: (clients.find(c => c.id === +id) || {}).name || '?', revenue }))
        .sort((a, b) => b.revenue - a.revenue).slice(0, 5);

      // Task stats
      const totalTasks = tasks.length;
      const doneTasks = tasks.filter(t => t.status === 'done').length;
      const taskRate = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

      // Projects at risk (active + deadline within 7 days or overdue)
      const atRisk = projects.filter(p => {
        if (p.status !== 'active' || !p.deadline) return false;
        const dl = new Date(p.deadline);
        const diff = Math.ceil((dl - now) / (1000 * 60 * 60 * 24));
        return diff <= 7;
      }).map(p => ({ id: p.id, name: p.name, deadline: p.deadline, daysLeft: Math.ceil((new Date(p.deadline) - now) / (1000 * 60 * 60 * 24)) }));

      // Monthly profit trend
      const allMonths = new Set([...Object.keys(mRev), ...Object.keys(mExp)]);
      const profitTrend = [...allMonths].sort().map(m => ({ month: m, profit: (mRev[m] || 0) - (mExp[m] || 0) }));

      return res.json({
        income, expenses: monthExp, profit: income - monthExp,
        prevIncome, prevExpenses: prevExp, prevProfit: prevIncome - prevExp,
        activeProjects: projects.filter(p => p.status === 'active').length,
        pipeline: Object.entries(pipe).map(([pipeline_stage, count]) => ({ pipeline_stage, count })),
        monthlyRevenue: Object.entries(mRev).map(([month, total]) => ({ month, total })),
        monthlyExpenses: Object.entries(mExp).map(([month, total]) => ({ month, total })),
        pendingInvoices: invoices.filter(i => ['pending','sent','overdue'].includes(i.status)).reduce((s, i) => s + i.amount, 0),
        topClients, taskRate, doneTasks, totalTasks, atRisk, profitTrend,
        totalRevenue: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0),
        totalExpenses: expenses.reduce((s, e) => s + e.amount, 0),
      });
    }

    // ========== TEAM ==========
    if (parts[0] === 'team') {
      // Update role
      if (parts[1] === 'role' && method === 'PUT') {
        const u = ownerOnly(req, res); if (!u) return;
        const { user_id, role } = req.body;
        if (!user_id || !role) return res.status(400).json({ error: 'User ID y rol requeridos' });
        if (!['owner','admin','manager','employee'].includes(role)) return res.status(400).json({ error: 'Rol inválido' });
        if (+user_id === u.id && role !== 'owner') return res.status(400).json({ error: 'No podés cambiar tu propio rol' });
        await supabase.from('users').update({ role }).eq('id', user_id).eq('org_id', u.org_id);
        return res.json({ ok: true });
      }
      // Update permissions
      if (parts[1] === 'permissions' && method === 'PUT') {
        const u = ownerOnly(req, res); if (!u) return;
        const { user_id, permissions } = req.body;
        if (!user_id) return res.status(400).json({ error: 'User ID requerido' });
        await supabase.from('users').update({ permissions: permissions || {} }).eq('id', user_id).eq('org_id', u.org_id);
        return res.json({ ok: true });
      }
      if (parts[1] === 'invite') { /* handled below */ }
      else {
      const u = ownerOnly(req, res); if (!u) return;
      const [usersRes, tasksRes] = await Promise.all([
        supabase.from('users').select('id, name, email, role, permissions').eq('org_id', u.org_id),
        supabase.from('tasks').select('assigned_to, status').eq('org_id', u.org_id)
      ]);
      const users = usersRes.data || [], tasks = tasksRes.data || [];
      return res.json(users.map(u => {
        const ut = tasks.filter(t => t.assigned_to === u.id);
        return { id: u.id, name: u.name, email: u.email, role: u.role, permissions: u.permissions || {}, pending: ut.filter(t => t.status === 'pending').length, in_progress: ut.filter(t => t.status === 'in_progress').length, done: ut.filter(t => t.status === 'done').length, total: ut.length };
      }));
      }
    }

    // ========== MEETINGS ==========
    if (parts[0] === 'meetings') {
      if (!parts[1]) {
        if (method === 'GET') {
          const u = auth(req, res); if (!u) return;
          const { data } = await supabase.from('meetings').select('*, users!meetings_user_id_fkey(name)').eq('org_id', u.org_id).order('date', { ascending: true });
          return res.json((data || []).map(m => ({ ...m, user_name: m.users?.name, users: undefined })));
        }
        if (method === 'POST') {
          const u = auth(req, res); if (!u) return;
          const { title, description, date, time_start, time_end, attendees } = req.body;
          if (!title || !date) return res.status(400).json({ error: 'Título y fecha requeridos' });
          const { data } = await supabase.from('meetings').insert({
            org_id: u.org_id, user_id: u.id, title, description,
            date, time_start: time_start || null, time_end: time_end || null,
            attendees: attendees || []
          }).select().single();
          // Notify attendees
          if (attendees?.length) {
            const { data: users } = await supabase.from('users').select('email, email_prefs').in('id', attendees).eq('org_id', u.org_id);
            (users || []).forEach(att => {
              if (att.email && att.email_prefs?.meeting_created !== false) {
                notifyEmail(att.email, `Nueva reunión: ${title}`, `<p style="color:#c4c4d4;">Fuiste invitado a <strong style="color:#fff;">${title}</strong></p><p style="color:#8888a8;">Fecha: ${date} ${time_start ? '| ' + time_start : ''}</p>`);
              }
            });
          }
          notifySlack(u.org_id, `📅 Nueva reunión: *${title}* — ${date} ${time_start || ''}`);
          return res.status(201).json(data);
        }
      } else {
        if (method === 'PUT') {
          const u = auth(req, res); if (!u) return;
          const updates = {};
          ['title','description','date','time_start','time_end','attendees'].forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
          const { data } = await supabase.from('meetings').update(updates).eq('id', parts[1]).eq('org_id', u.org_id).select().single();
          return res.json(data);
        }
        if (method === 'DELETE') {
          const u = auth(req, res); if (!u) return;
          await supabase.from('meetings').delete().eq('id', parts[1]).eq('org_id', u.org_id);
          return res.json({ ok: true });
        }
      }
    }

    // ========== INVITE EMPLOYEE ==========
    if (parts[0] === 'team' && parts[1] === 'invite' && method === 'POST') {
      const u = ownerOnly(req, res); if (!u) return;
      const { name, email, password } = req.body;
      if (!name || !email || !password) return res.status(400).json({ error: 'Nombre, email y contraseña requeridos' });
      const { data: existing } = await supabase.from('users').select('id').eq('email', email).limit(1);
      if (existing?.length) return res.status(400).json({ error: 'Ese email ya está registrado' });
      const hash = await bcrypt.hash(password, 10);
      const { data } = await supabase.from('users').insert({ name, email, password_hash: hash, role: 'employee', org_id: u.org_id }).select('id, name, email, role').single();
      return res.json(data);
    }

    // ========== SEARCH ==========
    if (parts[0] === 'search' && method === 'GET') {
      const u = auth(req, res); if (!u) return;
      const q = (req.url.split('q=')[1] || '').split('&')[0];
      if (!q || q.length < 2) return res.json([]);
      const query = decodeURIComponent(q).toLowerCase();
      const [clients, projects, tasks] = await Promise.all([
        supabase.from('clients').select('id, name, company, email').eq('org_id', u.org_id).ilike('name', `%${query}%`).limit(5),
        supabase.from('projects').select('id, name').eq('org_id', u.org_id).ilike('name', `%${query}%`).limit(5),
        supabase.from('tasks').select('id, title').eq('org_id', u.org_id).ilike('title', `%${query}%`).limit(5),
      ]);
      return res.json([
        ...(clients.data || []).map(c => ({ type: 'client', id: c.id, label: c.name, sub: c.company || c.email })),
        ...(projects.data || []).map(p => ({ type: 'project', id: p.id, label: p.name })),
        ...(tasks.data || []).map(t => ({ type: 'task', id: t.id, label: t.title })),
      ]);
    }

    // ========== NOTIFICATIONS ==========
    if (parts[0] === 'notifications') {
      const u = auth(req, res); if (!u) return;
      const { data } = await supabase.from('notifications').select('*').eq('user_id', u.id).eq('org_id', u.org_id).order('created_at', { ascending: false }).limit(50);
      return res.json(data || []);
    }

    // ========== PROFILE ==========
    if (parts[0] === 'profile') {
      if (parts[1] === 'notes') {
        const u = auth(req, res); if (!u) return;
        if (!parts[2]) {
          if (method === 'GET') {
            const { data } = await supabase.from('user_notes').select('*').eq('user_id', u.id).eq('org_id', u.org_id).order('updated_at', { ascending: false });
            return res.json(data || []);
          }
          if (method === 'POST') {
            const { title, content, color } = req.body;
            const { data } = await supabase.from('user_notes').insert({ user_id: u.id, title: title || '', content: content || '', color: color || '#7B6CF6', org_id: u.org_id }).select().single();
            return res.status(201).json(data);
          }
        } else {
          if (method === 'PUT') {
            const updates = {};
            ['title','content','color'].forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
            updates.updated_at = new Date().toISOString();
            const { data } = await supabase.from('user_notes').update(updates).eq('id', parts[2]).eq('user_id', u.id).select().single();
            return res.json(data);
          }
          if (method === 'DELETE') {
            await supabase.from('user_notes').delete().eq('id', parts[2]).eq('user_id', u.id);
            return res.json({ ok: true });
          }
        }
      }
      if (parts[1] === 'avatar' && method === 'POST') {
        const u = auth(req, res); if (!u) return;
        const { image } = req.body;
        if (!image) return res.status(400).json({ error: 'Imagen requerida' });
        const match = image.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!match) return res.status(400).json({ error: 'Formato inválido' });
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const buffer = Buffer.from(match[2], 'base64');
        const fileName = `${u.org_id}/${u.id}.${ext}`;
        const { error: upErr } = await supabase.storage.from('avatars').upload(fileName, buffer, { contentType: `image/${match[1]}`, upsert: true });
        if (upErr) return res.status(500).json({ error: 'Error subiendo: ' + upErr.message });
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        const avatarUrl = urlData.publicUrl + '?t=' + Date.now();
        await supabase.from('users').update({ avatar: avatarUrl }).eq('id', u.id);
        return res.json({ avatar: avatarUrl });
      }
      if (parts[1] === 'password' && method === 'PUT') {
        const u = auth(req, res); if (!u) return;
        const { current, password } = req.body;
        if (!current || !password) return res.status(400).json({ error: 'Contraseñas requeridas' });
        const { data: users } = await supabase.from('users').select('password_hash').eq('id', u.id).limit(1);
        if (!users?.length || !await bcrypt.compare(current, users[0].password_hash)) return res.status(400).json({ error: 'Contraseña actual incorrecta' });
        const hash = await bcrypt.hash(password, 10);
        await supabase.from('users').update({ password_hash: hash }).eq('id', u.id);
        return res.json({ ok: true });
      }
      if (!parts[1]) {
        const u = auth(req, res); if (!u) return;
        if (method === 'GET') {
          const { data } = await supabase.from('users').select('id, name, email, role, phone, bio, avatar, created_at, org_id').eq('id', u.id).single();
          return res.json(data);
        }
        if (method === 'PUT') {
          const updates = {};
          ['name','email','phone','bio'].forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
          const { data } = await supabase.from('users').update(updates).eq('id', u.id).select('id, name, email, role, phone, bio, avatar, created_at, org_id').single();
          return res.json(data);
        }
      }
    }

    // ========== BADGES ==========
    if (parts[0] === 'badges') {
      const AUTO_BADGES = [
        { key: 'first_task', title: 'Primera Tarea', desc: 'Completaste tu primera tarea', icon: '🎯', color: '#7B6CF6', tier: 'bronze' },
        { key: 'task_5', title: 'Productivo', desc: 'Completaste 5 tareas', icon: '⚡', color: '#F5A623', tier: 'bronze' },
        { key: 'task_10', title: 'Máquina', desc: 'Completaste 10 tareas', icon: '🔥', color: '#E74C3C', tier: 'silver' },
        { key: 'task_25', title: 'Imparable', desc: 'Completaste 25 tareas', icon: '💎', color: '#00CEC9', tier: 'gold' },
        { key: 'first_client', title: 'Primer Cliente', desc: 'Agregaste tu primer cliente', icon: '🤝', color: '#1DB954', tier: 'bronze' },
        { key: 'clients_5', title: 'Networker', desc: 'Tenés 5 clientes', icon: '🌐', color: '#4A90D9', tier: 'silver' },
        { key: 'first_invoice', title: 'Primer Cobro', desc: 'Cobraste tu primera factura', icon: '💰', color: '#1DB954', tier: 'bronze' },
        { key: 'first_project', title: 'Primer Proyecto', desc: 'Creaste tu primer proyecto', icon: '📁', color: '#4A90D9', tier: 'bronze' },
      ];

      if (parts[1] === 'catalog') return res.json(AUTO_BADGES);

      if (parts[1] === 'user') {
        const u = auth(req, res); if (!u) return;
        const userId = parts[2] || u.id;
        const [autoRes, manualRes] = await Promise.all([
          supabase.from('user_badges').select('badge_key, unlocked_at').eq('user_id', userId).eq('org_id', u.org_id),
          supabase.from('manual_badges').select('*, users!manual_badges_given_by_fkey(name)').eq('user_id', userId).eq('org_id', u.org_id).order('created_at', { ascending: false })
        ]);
        const unlocked = (autoRes.data || []).map(b => {
          const def = AUTO_BADGES.find(d => d.key === b.badge_key);
          return def ? { ...def, unlocked_at: b.unlocked_at, type: 'auto' } : null;
        }).filter(Boolean);
        const manual = (manualRes.data || []).map(b => ({
          id: b.id, title: b.title, icon: b.icon, color: b.color, reason: b.reason,
          given_by_name: b.users?.name || '?', created_at: b.created_at, type: 'manual'
        }));
        return res.json({ unlocked, manual, catalog: AUTO_BADGES });
      }

      if (parts[1] === 'check' && method === 'POST') {
        const u = auth(req, res); if (!u) return;
        const oid = u.org_id;
        const [tasksRes, clientsRes, invoicesRes, projectsRes, existingRes] = await Promise.all([
          supabase.from('tasks').select('id').eq('assigned_to', u.id).eq('status', 'done').eq('org_id', oid),
          supabase.from('clients').select('id').eq('org_id', oid),
          supabase.from('invoices').select('id').eq('status', 'paid').eq('org_id', oid),
          supabase.from('projects').select('id').eq('org_id', oid),
          supabase.from('user_badges').select('badge_key').eq('user_id', u.id)
        ]);
        const tasksDone = tasksRes.data?.length || 0;
        const clientCount = clientsRes.data?.length || 0;
        const paidCount = invoicesRes.data?.length || 0;
        const projectCount = projectsRes.data?.length || 0;
        const existing = new Set((existingRes.data || []).map(b => b.badge_key));
        const newBadges = [];
        const checks = [
          [tasksDone >= 1, 'first_task'], [tasksDone >= 5, 'task_5'], [tasksDone >= 10, 'task_10'], [tasksDone >= 25, 'task_25'],
          [clientCount >= 1, 'first_client'], [clientCount >= 5, 'clients_5'],
          [paidCount >= 1, 'first_invoice'], [projectCount >= 1, 'first_project']
        ];
        for (const [cond, key] of checks) {
          if (cond && !existing.has(key)) {
            await supabase.from('user_badges').insert({ user_id: u.id, badge_key: key, org_id: u.org_id });
            const def = AUTO_BADGES.find(b => b.key === key);
            if (def) newBadges.push(def);
          }
        }
        return res.json({ new: newBadges, total: newBadges.length });
      }

      if (parts[1] === 'give' && method === 'POST') {
        const u = ownerOnly(req, res); if (!u) return;
        const { user_id, title, icon, color, reason } = req.body;
        if (!user_id || !title) return res.status(400).json({ error: 'Usuario y título requeridos' });
        const { data } = await supabase.from('manual_badges').insert({ user_id, given_by: u.id, title, icon: icon || '⭐', color: color || '#F5A623', reason, org_id: u.org_id }).select().single();
        return res.json(data);
      }

      if (parts[1] === 'manual' && parts[2] && method === 'DELETE') {
        const u = ownerOnly(req, res); if (!u) return;
        await supabase.from('manual_badges').delete().eq('id', parts[2]).eq('org_id', u.org_id);
        return res.json({ ok: true });
      }
    }

    // ========== CHAT ==========
    if (parts[0] === 'chat') {
      const u = auth(req, res); if (!u) return;
      if (method === 'GET') {
        const limit = 100;
        const { data } = await supabase.from('chat_messages').select('*, users(name)').eq('org_id', u.org_id).order('created_at', { ascending: false }).limit(limit);
        return res.json((data || []).reverse().map(m => ({ ...m, user_name: m.users?.name, users: undefined })));
      }
      if (method === 'POST') {
        const { message } = req.body;
        if (!message?.trim()) return res.status(400).json({ error: 'Mensaje vacío' });
        const { data } = await supabase.from('chat_messages').insert({ org_id: u.org_id, user_id: u.id, message: message.trim() }).select('*, users(name)').single();
        data.user_name = data.users?.name; delete data.users;
        // Trigger webhooks for chat
        fireWebhooks(u.org_id, 'chat.message', { user: u.name, message: message.trim() });
        return res.status(201).json(data);
      }
    }

    // ========== TIME TRACKING ==========
    if (parts[0] === 'time') {
      const u = auth(req, res); if (!u) return;
      if (!parts[1]) {
        if (method === 'GET') {
          const { data } = await supabase.from('time_entries').select('*, users(name), tasks(title), projects(name)').eq('org_id', u.org_id).order('date', { ascending: false }).limit(200);
          return res.json((data || []).map(t => ({ ...t, user_name: t.users?.name, task_title: t.tasks?.title, project_name: t.projects?.name, users: undefined, tasks: undefined, projects: undefined })));
        }
        if (method === 'POST') {
          const { task_id, project_id, description, minutes, date } = req.body;
          if (!minutes) return res.status(400).json({ error: 'Minutos requeridos' });
          const { data } = await supabase.from('time_entries').insert({ org_id: u.org_id, user_id: u.id, task_id: task_id || null, project_id: project_id || null, description, minutes, date: date || new Date().toISOString().split('T')[0] }).select().single();
          return res.status(201).json(data);
        }
      }
      if (parts[1] && method === 'DELETE') {
        await supabase.from('time_entries').delete().eq('id', parts[1]).eq('org_id', u.org_id);
        return res.json({ ok: true });
      }
    }

    // ========== TEMPLATES ==========
    if (parts[0] === 'templates') {
      const u = ownerOnly(req, res); if (!u) return;
      if (!parts[1]) {
        if (method === 'GET') {
          const { data } = await supabase.from('project_templates').select('*').eq('org_id', u.org_id).order('created_at', { ascending: false });
          return res.json(data || []);
        }
        if (method === 'POST') {
          const { name, description, tasks } = req.body;
          if (!name) return res.status(400).json({ error: 'Nombre requerido' });
          const { data } = await supabase.from('project_templates').insert({ org_id: u.org_id, name, description, tasks: tasks || [] }).select().single();
          return res.status(201).json(data);
        }
      }
      // Apply template — creates project + tasks from template
      if (parts[1] === 'apply' && method === 'POST') {
        const { template_id, client_id, project_name, budget, deadline } = req.body;
        const { data: tpl } = await supabase.from('project_templates').select('*').eq('id', template_id).eq('org_id', u.org_id).single();
        if (!tpl) return res.status(404).json({ error: 'Template no encontrado' });
        // Create project
        const { data: proj } = await supabase.from('projects').insert({ org_id: u.org_id, client_id, name: project_name || tpl.name, description: tpl.description, budget: budget || 0, deadline }).select().single();
        // Create tasks from template
        const templateTasks = tpl.tasks || [];
        for (const t of templateTasks) {
          await supabase.from('tasks').insert({ org_id: u.org_id, project_id: proj.id, title: t.title, description: t.description || '', priority: t.priority || 'medium', assigned_to: t.assigned_to || null });
        }
        return res.json({ project: proj, tasks_created: templateTasks.length });
      }
      if (parts[1] && parts[1] !== 'apply') {
        if (method === 'PUT') {
          const updates = {};
          ['name','description','tasks'].forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
          const { data } = await supabase.from('project_templates').update(updates).eq('id', parts[1]).eq('org_id', u.org_id).select().single();
          return res.json(data);
        }
        if (method === 'DELETE') {
          await supabase.from('project_templates').delete().eq('id', parts[1]).eq('org_id', u.org_id);
          return res.json({ ok: true });
        }
      }
    }

    // ========== CLIENT PORTAL ==========
    if (parts[0] === 'portal') {
      // Public access — no auth needed for token-based access
      if (parts[1] === 'view' && parts[2]) {
        const token = parts[2];
        const { data: portal } = await supabase.from('client_portal_tokens').select('*, projects(*, clients(name))').eq('token', token).eq('active', true).single();
        if (!portal) return res.status(404).json({ error: 'Portal no encontrado o inactivo' });
        const proj = portal.projects;
        const { data: tasks } = await supabase.from('tasks').select('title, status, priority, deadline').eq('project_id', proj.id).order('created_at', { ascending: true });
        const { data: invoices } = await supabase.from('invoices').select('amount, status, due_date').eq('project_id', proj.id);
        return res.json({
          project: { name: proj.name, description: proj.description, status: proj.status, budget: proj.budget, cost: proj.cost, deadline: proj.deadline, client_name: proj.clients?.name },
          tasks: tasks || [],
          invoices: invoices || []
        });
      }
      // Generate/manage tokens — auth required
      const u = ownerOnly(req, res); if (!u) return;
      if (method === 'GET') {
        const { data } = await supabase.from('client_portal_tokens').select('*, projects(name)').eq('org_id', u.org_id);
        return res.json((data || []).map(t => ({ ...t, project_name: t.projects?.name, projects: undefined })));
      }
      if (method === 'POST') {
        const { project_id } = req.body;
        if (!project_id) return res.status(400).json({ error: 'Proyecto requerido' });
        const token = require('crypto').randomBytes(24).toString('hex');
        const { data } = await supabase.from('client_portal_tokens').insert({ org_id: u.org_id, project_id, token }).select().single();
        return res.json({ ...data, url: `${req.headers.origin || ''}/portal/${token}` });
      }
      if (parts[1] && method === 'DELETE') {
        await supabase.from('client_portal_tokens').delete().eq('id', parts[1]).eq('org_id', u.org_id);
        return res.json({ ok: true });
      }
    }

    // ========== WEBHOOKS ==========
    if (parts[0] === 'webhooks') {
      const u = ownerOnly(req, res); if (!u) return;
      if (!parts[1]) {
        if (method === 'GET') {
          const { data } = await supabase.from('webhooks').select('*').eq('org_id', u.org_id);
          return res.json(data || []);
        }
        if (method === 'POST') {
          const { event, url } = req.body;
          if (!event || !url) return res.status(400).json({ error: 'Evento y URL requeridos' });
          const { data } = await supabase.from('webhooks').insert({ org_id: u.org_id, event, url }).select().single();
          return res.json(data);
        }
      }
      if (parts[1] && method === 'DELETE') {
        await supabase.from('webhooks').delete().eq('id', parts[1]).eq('org_id', u.org_id);
        return res.json({ ok: true });
      }
    }

    // ========== AI ASSISTANT ==========
    if (parts[0] === 'ai') {
      const u = auth(req, res); if (!u) return;
      if (parts[1] === 'generate' && method === 'POST') {
        const { type, context } = req.body;
        if (!type) return res.status(400).json({ error: 'Tipo requerido' });
        const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;
        if (!CLAUDE_KEY) return res.status(500).json({ error: 'API key no configurada' });

        const prompts = {
          proposal: `Genera una propuesta comercial profesional para un proyecto de desarrollo web. Contexto: ${context}. Responde en español, formato markdown, máximo 500 palabras.`,
          summary: `Resume esta información de reunión/proyecto de forma clara y concisa. Contexto: ${context}. Responde en español, máximo 300 palabras.`,
          estimate: `Basándote en este contexto, sugiere un presupuesto y timeline realista para el proyecto. Contexto: ${context}. Responde en español con rangos de precio en USD y tiempos estimados.`,
          tasks: `Genera una lista de tareas técnicas para este proyecto. Contexto: ${context}. Responde en español, formato JSON array con objetos {title, description, priority}. Solo el JSON, sin texto extra.`,
        };

        const prompt = prompts[type] || `${type}: ${context}`;

        try {
          const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] })
          });
          const aiData = await aiRes.json();
          const text = aiData.content?.[0]?.text || 'Sin respuesta';
          // Log usage
          await supabase.from('ai_logs').insert({ org_id: u.org_id, user_id: u.id, type, prompt: context, response: text });
          return res.json({ result: text, type });
        } catch (e) {
          return res.status(500).json({ error: 'Error al generar con IA: ' + e.message });
        }
      }
    }

    // ========== EMAIL NOTIFICATIONS ==========
    if (parts[0] === 'email') {
      if (parts[1] === 'send' && method === 'POST') {
        const u = auth(req, res); if (!u) return;
        const { to, subject, html } = req.body;
        const result = await sendEmail(to, subject, html);
        if (result.error) return res.status(500).json(result);
        return res.json(result);
      }
      // Get/update notification preferences
      if (parts[1] === 'preferences') {
        const u = auth(req, res); if (!u) return;
        if (method === 'GET') {
          const { data } = await supabase.from('users').select('email_prefs').eq('id', u.id).single();
          return res.json(data?.email_prefs || { task_assigned: true, invoice_created: true, meeting_created: true, project_status: true, weekly_report: true });
        }
        if (method === 'PUT') {
          await supabase.from('users').update({ email_prefs: req.body }).eq('id', u.id);
          return res.json({ ok: true });
        }
      }
    }

    // ========== CALENDAR EXPORT ==========
    if (parts[0] === 'calendar' && parts[1] === 'export') {
      const u = auth(req, res); if (!u) return;
      const { data: meetings } = await supabase.from('meetings').select('*').eq('org_id', u.org_id);
      const events = (meetings || []).map(m => {
        const dtStart = m.date.replace(/-/g, '') + (m.time_start ? 'T' + m.time_start.replace(':', '') + '00' : 'T090000');
        const dtEnd = m.date.replace(/-/g, '') + (m.time_end ? 'T' + m.time_end.replace(':', '') + '00' : 'T100000');
        return `BEGIN:VEVENT\r\nDTSTART:${dtStart}\r\nDTEND:${dtEnd}\r\nSUMMARY:${(m.title || '').replace(/[,;\\]/g, '')}\r\nDESCRIPTION:${(m.description || '').replace(/[,;\\]/g, '')}\r\nUID:profit-${m.id}@profitcode.app\r\nEND:VEVENT`;
      }).join('\r\n');
      const ical = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Profit Code//Meetings//EN\r\nCALSCALE:GREGORIAN\r\n${events}\r\nEND:VCALENDAR`;
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="profit-code-meetings.ics"');
      return res.send(ical);
    }

    // ========== INTEGRATIONS (Slack) ==========
    if (parts[0] === 'integrations') {
      const u = ownerOnly(req, res); if (!u) return;
      if (method === 'GET') {
        const { data } = await supabase.from('organizations').select('integrations').eq('id', u.org_id).single();
        return res.json(data?.integrations || {});
      }
      if (method === 'PUT') {
        await supabase.from('organizations').update({ integrations: req.body }).eq('id', u.org_id);
        return res.json({ ok: true });
      }
      if (parts[1] === 'slack-test' && method === 'POST') {
        const { webhook_url } = req.body;
        if (!webhook_url) return res.status(400).json({ error: 'URL requerida' });
        try {
          await fetch(webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: '✅ Profit Code conectado correctamente!' })
          });
          return res.json({ ok: true });
        } catch (e) {
          return res.status(400).json({ error: 'No se pudo conectar con Slack' });
        }
      }
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error del servidor' });
  }
};

// Send email via Resend (non-blocking helper)
async function sendEmail(to, subject, html) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return { error: 'Resend no configurado' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({ from: 'Profit Code <noreply@profitcode.app>', to: Array.isArray(to) ? to : [to], subject, html })
    });
    return await res.json();
  } catch (e) {
    return { error: 'Error enviando email' };
  }
}

// Send email notification (background, non-blocking)
function notifyEmail(to, subject, bodyHtml) {
  const template = `<div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;background:#0d0a1a;color:#c4c4d4;padding:32px;border-radius:12px;">
    <div style="text-align:center;margin-bottom:24px;"><span style="color:#7B6CF6;font-weight:700;font-size:14px;letter-spacing:0.1em;">⚡ PROFIT CODE</span></div>
    <h2 style="color:#fff;font-size:18px;margin-bottom:16px;">${subject}</h2>
    ${bodyHtml}
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid rgba(123,108,246,0.12);text-align:center;font-size:12px;color:#8888a8;">Profit Code — Panel de Gestión para Agencias</div>
  </div>`;
  sendEmail(to, subject, template).catch(() => {});
}

// Send Slack notification (background, non-blocking)
async function notifySlack(orgId, text) {
  try {
    const { data } = await supabase.from('organizations').select('integrations').eq('id', orgId).single();
    const slackUrl = data?.integrations?.slack_webhook;
    if (!slackUrl) return;
    fetch(slackUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }).catch(() => {});
  } catch {}
}

// Fire webhooks in background (non-blocking)
async function fireWebhooks(orgId, event, payload) {
  try {
    const { data } = await supabase.from('webhooks').select('url').eq('org_id', orgId).eq('event', event).eq('active', true);
    if (data) data.forEach(w => fetch(w.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, payload, timestamp: new Date().toISOString() }) }).catch(() => {}));
  } catch {}
}
