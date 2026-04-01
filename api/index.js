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

    // PROFILE
    if (parts[0] === 'profile') {
      // Notes sub-route
      if (parts[1] === 'notes') {
        const u = auth(req, res); if (!u) return;
        if (!parts[2]) {
          if (method === 'GET') {
            const { data } = await supabase.from('user_notes').select('*').eq('user_id', u.id).order('updated_at', { ascending: false });
            return res.json(data || []);
          }
          if (method === 'POST') {
            const { title, content, color } = req.body;
            const { data } = await supabase.from('user_notes').insert({ user_id: u.id, title: title || '', content: content || '', color: color || '#7B6CF6' }).select().single();
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
      // Avatar
      if (parts[1] === 'avatar' && method === 'POST') {
        const u = auth(req, res); if (!u) return;
        return res.json({ avatar: null, message: 'Avatar upload not supported on serverless' });
      }
      // Password
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
      // Profile GET/PUT
      if (!parts[1]) {
        const u = auth(req, res); if (!u) return;
        if (method === 'GET') {
          const { data } = await supabase.from('users').select('id, name, email, role, phone, bio, avatar, created_at').eq('id', u.id).single();
          return res.json(data);
        }
        if (method === 'PUT') {
          const updates = {};
          ['name','email','phone','bio'].forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
          const { data } = await supabase.from('users').update(updates).eq('id', u.id).select('id, name, email, role, phone, bio, avatar, created_at').single();
          return res.json(data);
        }
      }
    }

    // BADGES
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

      // GET catalog
      if (parts[1] === 'catalog') return res.json(AUTO_BADGES);

      // GET user badges
      if (parts[1] === 'user') {
        const u = auth(req, res); if (!u) return;
        const userId = parts[2] || u.id;
        const [autoRes, manualRes] = await Promise.all([
          supabase.from('user_badges').select('badge_key, unlocked_at').eq('user_id', userId),
          supabase.from('manual_badges').select('*, users!manual_badges_given_by_fkey(name)').eq('user_id', userId).order('created_at', { ascending: false })
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

      // POST check badges
      if (parts[1] === 'check' && method === 'POST') {
        const u = auth(req, res); if (!u) return;
        const [tasksRes, clientsRes, invoicesRes, projectsRes, existingRes] = await Promise.all([
          supabase.from('tasks').select('id').eq('assigned_to', u.id).eq('status', 'done'),
          supabase.from('clients').select('id'),
          supabase.from('invoices').select('id').eq('status', 'paid'),
          supabase.from('projects').select('id'),
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
            await supabase.from('user_badges').insert({ user_id: u.id, badge_key: key });
            const def = AUTO_BADGES.find(b => b.key === key);
            if (def) newBadges.push(def);
          }
        }
        return res.json({ new: newBadges, total: newBadges.length });
      }

      // POST give manual badge
      if (parts[1] === 'give' && method === 'POST') {
        const u = owner(req, res); if (!u) return;
        const { user_id, title, icon, color, reason } = req.body;
        if (!user_id || !title) return res.status(400).json({ error: 'Usuario y título requeridos' });
        const { data } = await supabase.from('manual_badges').insert({ user_id, given_by: u.id, title, icon: icon || '⭐', color: color || '#F5A623', reason }).select().single();
        return res.json(data);
      }

      // DELETE manual badge
      if (parts[1] === 'manual' && parts[2] && method === 'DELETE') {
        const u = owner(req, res); if (!u) return;
        await supabase.from('manual_badges').delete().eq('id', parts[2]);
        return res.json({ ok: true });
      }
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error del servidor' });
  }
};
