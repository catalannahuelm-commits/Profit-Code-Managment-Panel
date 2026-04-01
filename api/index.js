const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// --- CONFIG ---
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// --- AUTH HELPERS ---
function signToken(user) {
  return jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
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

function owner(req, res) {
  const u = auth(req, res);
  if (!u) return null;
  if (u.role !== 'owner') { res.status(403).json({ error: 'Acceso denegado' }); return null; }
  return u;
}

// --- ROUTE PARSER ---
function parsePath(url) {
  const [path] = url.split('?');
  return path.replace('/api/', '').split('/').filter(Boolean);
}

// --- HANDLER ---
module.exports = async (req, res) => {
  const parts = parsePath(req.url);
  const method = req.method;

  try {
    // AUTH
    if (parts[0] === 'auth') {
      if (parts[1] === 'login' && method === 'POST') {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email y contrasena requeridos' });
        const { data: users } = await supabase.from('users').select('*').eq('email', email).limit(1);
        if (!users?.length) return res.status(401).json({ error: 'Credenciales incorrectas' });
        const user = users[0];
        if (!await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: 'Credenciales incorrectas' });
        const token = signToken(user);
        res.setHeader('Set-Cookie', `token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
        return res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
      }
      if (parts[1] === 'logout') {
        res.setHeader('Set-Cookie', 'token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
        return res.json({ ok: true });
      }
      if (parts[1] === 'me') {
        const u = auth(req, res); if (!u) return;
        return res.json({ id: u.id, name: u.name, email: u.email, role: u.role });
      }
    }

    // CLIENTS
    if (parts[0] === 'clients') {
      if (!parts[1]) {
        if (method === 'GET') {
          const u = auth(req, res); if (!u) return;
          const { data } = await supabase.from('clients').select('*').order('updated_at', { ascending: false });
          return res.json(data || []);
        }
        if (method === 'POST') {
          const u = owner(req, res); if (!u) return;
          const { name, company, email, phone, notes } = req.body;
          if (!name) return res.status(400).json({ error: 'Nombre requerido' });
          const { data } = await supabase.from('clients').insert({ name, company, email, phone, notes }).select().single();
          return res.status(201).json(data);
        }
      } else {
        const id = parts[1];
        if (method === 'GET') {
          const u = auth(req, res); if (!u) return;
          const { data } = await supabase.from('clients').select('*').eq('id', id).single();
          return res.json(data);
        }
        if (method === 'PUT') {
          const u = owner(req, res); if (!u) return;
          const updates = {};
          ['name','company','email','phone','pipeline_stage','notes'].forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
          updates.updated_at = new Date().toISOString();
          const { data } = await supabase.from('clients').update(updates).eq('id', id).select().single();
          return res.json(data);
        }
        if (method === 'DELETE') {
          const u = owner(req, res); if (!u) return;
          await supabase.from('clients').delete().eq('id', id);
          return res.json({ ok: true });
        }
      }
    }

    // PROJECTS
    if (parts[0] === 'projects') {
      if (!parts[1]) {
        if (method === 'GET') {
          const u = auth(req, res); if (!u) return;
          const { data } = await supabase.from('projects').select('*, clients(name)').order('created_at', { ascending: false });
          return res.json((data || []).map(p => ({ ...p, client_name: p.clients?.name, clients: undefined })));
        }
        if (method === 'POST') {
          const u = owner(req, res); if (!u) return;
          const { client_id, name, description, budget, deadline } = req.body;
          if (!client_id || !name) return res.status(400).json({ error: 'Cliente y nombre requeridos' });
          const { data } = await supabase.from('projects').insert({ client_id, name, description, budget: budget || 0, deadline }).select().single();
          return res.status(201).json(data);
        }
      } else {
        if (method === 'PUT') {
          const u = owner(req, res); if (!u) return;
          const updates = {};
          ['name','description','budget','cost','status','deadline'].forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
          const { data } = await supabase.from('projects').update(updates).eq('id', parts[1]).select().single();
          return res.json(data);
        }
      }
    }

    // TASKS
    if (parts[0] === 'tasks') {
      if (!parts[1]) {
        if (method === 'GET') {
          const u = auth(req, res); if (!u) return;
          let query = supabase.from('tasks').select('*, projects(name), users(name)').order('created_at', { ascending: false });
          if (u.role !== 'owner') query = query.eq('assigned_to', u.id);
          const { data } = await query;
          return res.json((data || []).map(t => ({ ...t, project_name: t.projects?.name, assigned_name: t.users?.name, projects: undefined, users: undefined })));
        }
        if (method === 'POST') {
          const u = owner(req, res); if (!u) return;
          const { project_id, assigned_to, title, description, priority, deadline } = req.body;
          if (!project_id || !title) return res.status(400).json({ error: 'Proyecto y titulo requeridos' });
          const { data } = await supabase.from('tasks').insert({ project_id, assigned_to, title, description, priority: priority || 'medium', deadline }).select().single();
          return res.status(201).json(data);
        }
      } else {
        if (method === 'PUT') {
          const u = auth(req, res); if (!u) return;
          const updates = {};
          ['title','description','status','priority','assigned_to','deadline'].forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
          updates.updated_at = new Date().toISOString();
          const { data } = await supabase.from('tasks').update(updates).eq('id', parts[1]).select().single();
          return res.json(data);
        }
      }
    }

    // INVOICES
    if (parts[0] === 'invoices') {
      // Expenses sub-route
      if (parts[1] === 'expenses') {
        if (method === 'GET') {
          const u = owner(req, res); if (!u) return;
          const { data } = await supabase.from('expenses').select('*, projects(name)').order('date', { ascending: false });
          return res.json((data || []).map(e => ({ ...e, project_name: e.projects?.name, projects: undefined })));
        }
        if (method === 'POST') {
          const u = owner(req, res); if (!u) return;
          const { project_id, description, amount, category, date } = req.body;
          if (!description || !amount) return res.status(400).json({ error: 'Descripcion y monto requeridos' });
          const { data } = await supabase.from('expenses').insert({ project_id, description, amount, category: category || 'other', date: date || new Date().toISOString().split('T')[0] }).select().single();
          return res.status(201).json(data);
        }
      }
      if (!parts[1]) {
        if (method === 'GET') {
          const u = owner(req, res); if (!u) return;
          const { data } = await supabase.from('invoices').select('*, clients(name), projects(name)').order('created_at', { ascending: false });
          return res.json((data || []).map(i => ({ ...i, client_name: i.clients?.name, project_name: i.projects?.name, clients: undefined, projects: undefined })));
        }
        if (method === 'POST') {
          const u = owner(req, res); if (!u) return;
          const { project_id, amount, due_date, description } = req.body;
          if (!project_id || !amount) return res.status(400).json({ error: 'Proyecto y monto requeridos' });
          const { data: proj } = await supabase.from('projects').select('client_id').eq('id', project_id).single();
          if (!proj) return res.status(404).json({ error: 'Proyecto no encontrado' });
          const { data } = await supabase.from('invoices').insert({ project_id, client_id: proj.client_id, amount, due_date, description }).select().single();
          return res.status(201).json(data);
        }
      }
      if (parts[1] && parts[1] !== 'expenses') {
        if (method === 'PUT') {
          const u = owner(req, res); if (!u) return;
          const updates = {};
          if (req.body.status === 'paid') { updates.status = 'paid'; updates.paid_date = req.body.paid_date || new Date().toISOString().split('T')[0]; }
          else if (req.body.status) updates.status = req.body.status;
          const { data } = await supabase.from('invoices').update(updates).eq('id', parts[1]).select('*, clients(name), projects(name)').single();
          data.client_name = data.clients?.name; data.project_name = data.projects?.name;
          delete data.clients; delete data.projects;
          return res.json(data);
        }
      }
    }

    // DASHBOARD
    if (parts[0] === 'dashboard') {
      const u = owner(req, res); if (!u) return;
      const sixAgo = new Date(new Date().getFullYear(), new Date().getMonth() - 6, 1).toISOString().split('T')[0];
      const curMonth = new Date().toISOString().slice(0, 7);
      const [inv, exp, proj, cli] = await Promise.all([
        supabase.from('invoices').select('amount, status, paid_date'),
        supabase.from('expenses').select('amount, date'),
        supabase.from('projects').select('status'),
        supabase.from('clients').select('pipeline_stage'),
      ]);
      const invoices = inv.data || [], expenses = exp.data || [], projects = proj.data || [], clients = cli.data || [];
      const income = invoices.filter(i => i.status === 'paid' && i.paid_date?.startsWith(curMonth)).reduce((s, i) => s + i.amount, 0);
      const monthExp = expenses.filter(e => e.date?.startsWith(curMonth)).reduce((s, e) => s + e.amount, 0);
      const pipe = {}; clients.forEach(c => { pipe[c.pipeline_stage] = (pipe[c.pipeline_stage] || 0) + 1; });
      const mRev = {}, mExp = {};
      invoices.filter(i => i.status === 'paid' && i.paid_date >= sixAgo).forEach(i => { const m = i.paid_date.slice(0, 7); mRev[m] = (mRev[m] || 0) + i.amount; });
      expenses.filter(e => e.date >= sixAgo).forEach(e => { const m = e.date.slice(0, 7); mExp[m] = (mExp[m] || 0) + e.amount; });
      return res.json({
        income, expenses: monthExp, profit: income - monthExp,
        activeProjects: projects.filter(p => p.status === 'active').length,
        pipeline: Object.entries(pipe).map(([pipeline_stage, count]) => ({ pipeline_stage, count })),
        monthlyRevenue: Object.entries(mRev).map(([month, total]) => ({ month, total })),
        monthlyExpenses: Object.entries(mExp).map(([month, total]) => ({ month, total })),
        pendingInvoices: invoices.filter(i => ['pending','sent','overdue'].includes(i.status)).reduce((s, i) => s + i.amount, 0)
      });
    }

    // TEAM
    if (parts[0] === 'team') {
      const u = owner(req, res); if (!u) return;
      const [usersRes, tasksRes] = await Promise.all([
        supabase.from('users').select('id, name, role'),
        supabase.from('tasks').select('assigned_to, status')
      ]);
      const users = usersRes.data || [], tasks = tasksRes.data || [];
      return res.json(users.map(u => {
        const ut = tasks.filter(t => t.assigned_to === u.id);
        return { id: u.id, name: u.name, role: u.role, pending: ut.filter(t => t.status === 'pending').length, in_progress: ut.filter(t => t.status === 'in_progress').length, done: ut.filter(t => t.status === 'done').length, total: ut.length };
      }));
    }

    // NOTIFICATIONS
    if (parts[0] === 'notifications') {
      const u = auth(req, res); if (!u) return;
      const { data } = await supabase.from('notifications').select('*').eq('user_id', u.id).order('created_at', { ascending: false }).limit(50);
      return res.json(data || []);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error del servidor' });
  }
};
