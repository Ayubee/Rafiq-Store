/**
 * Vercel Serverless API Handler
 * High-speed, zero-dependency, crash-proof REST API for Support Desk
 */

const crypto = require('crypto');
const seedData = require('../data/seed.json');

// In-Memory Database store with Seed Data
const store = {
  categories: JSON.parse(JSON.stringify(seedData.categories || [])),
  macros: JSON.parse(JSON.stringify(seedData.macros || [])),
  tokens: new Set(),
  adminUser: {
    username: 'admin',
    passwordHash: crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD || 'admin123').digest('hex')
  },
  nextCatId: 100,
  nextMacroId: 100
};

// Helper: Parse JSON Body in Serverless Function
function parseBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') {
      return resolve(req.body);
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch (e) { resolve({}); }
    });
  });
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(data));
}

module.exports = async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // --- 1. PUBLIC OPERATOR APIS ---

  // GET /api/macros
  if (method === 'GET' && pathname === '/api/macros') {
    const active = store.macros.filter(m => m.is_active === 1).sort((a,b) => (b.usage_count||0) - (a.usage_count||0));
    return sendJson(res, 200, active);
  }

  // GET /api/categories
  if (method === 'GET' && pathname === '/api/categories') {
    const list = store.categories.map(c => {
      const count = store.macros.filter(m => m.category_id === c.id && m.is_active === 1).length;
      return { ...c, macro_count: count };
    });
    return sendJson(res, 200, list);
  }

  // POST /api/macros/:id/use
  const useMatch = pathname.match(/^\/api\/macros\/(\d+)\/use$/);
  if (method === 'POST' && useMatch) {
    const macroId = Number(useMatch[1]);
    const m = store.macros.find(x => x.id === macroId);
    if (m) m.usage_count = (m.usage_count || 0) + 1;
    return sendJson(res, 200, { success: true });
  }

  // --- 2. ADMIN AUTHENTICATION ---

  // POST /api/admin/login
  if (method === 'POST' && pathname === '/api/admin/login') {
    const body = await parseBody(req);
    const { username, password } = body;

    const hash = crypto.createHash('sha256').update(password || '').digest('hex');
    if (username === store.adminUser.username && hash === store.adminUser.passwordHash) {
      const token = crypto.randomBytes(32).toString('hex');
      store.tokens.add(token);
      return sendJson(res, 200, { success: true, token, username });
    }
    return sendJson(res, 401, { error: 'Foydalanuvchi nomi yoki parol noto‘g‘ri' });
  }

  // GET /api/admin/check
  if (method === 'GET' && pathname === '/api/admin/check') {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace('Bearer ', '').trim();
    return sendJson(res, store.tokens.has(token) ? 200 : 401, { authenticated: store.tokens.has(token) });
  }

  // POST /api/admin/logout
  if (method === 'POST' && pathname === '/api/admin/logout') {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace('Bearer ', '').trim();
    store.tokens.delete(token);
    return sendJson(res, 200, { success: true });
  }

  // --- 3. PROTECTED ADMIN APIS ---
  if (pathname.startsWith('/api/admin/')) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!store.tokens.has(token)) {
      return sendJson(res, 401, { error: 'Admin autentifikatsiyasi talab qilinadi' });
    }

    // GET /api/admin/stats
    if (method === 'GET' && pathname === '/api/admin/stats') {
      const totalMacros = store.macros.length;
      const activeMacros = store.macros.filter(m => m.is_active === 1).length;
      const totalCategories = store.categories.length;
      const totalUsage = store.macros.reduce((acc, m) => acc + (m.usage_count || 0), 0);
      const topMacros = [...store.macros].sort((a,b) => (b.usage_count||0) - (a.usage_count||0)).slice(0, 5);
      const recentCreated = [...store.macros].sort((a,b) => b.id - a.id).slice(0, 5);

      return sendJson(res, 200, {
        totalMacros,
        activeMacros,
        totalCategories,
        totalUsage,
        topMacros,
        recentCreated
      });
    }

    // GET /api/admin/macros
    if (method === 'GET' && pathname === '/api/admin/macros') {
      const list = store.macros.map(m => {
        const cat = store.categories.find(c => c.id === m.category_id) || {};
        return {
          ...m,
          category_name: cat.name || 'Umumiy',
          category_icon: cat.icon || '📁'
        };
      }).sort((a,b) => b.id - a.id);
      return sendJson(res, 200, list);
    }

    // POST /api/admin/macros
    if (method === 'POST' && pathname === '/api/admin/macros') {
      const body = await parseBody(req);
      const newId = store.nextMacroId++;
      const newMacro = {
        id: newId,
        category_id: Number(body.category_id),
        title: body.title || '',
        problem_description: body.problem_description || '',
        operator_action: body.operator_action || '',
        response_template: body.response_template || '',
        language: body.language || 'UZ',
        keywords: body.keywords || '',
        notes: body.notes || '',
        is_active: body.is_active !== undefined ? Number(body.is_active) : 1,
        usage_count: 0,
        created_at: new Date().toISOString()
      };
      store.macros.push(newMacro);
      return sendJson(res, 201, { success: true, id: newId });
    }

    // PUT /api/admin/macros/:id
    const editMatch = pathname.match(/^\/api\/admin\/macros\/(\d+)$/);
    if (method === 'PUT' && editMatch) {
      const id = Number(editMatch[1]);
      const body = await parseBody(req);
      const m = store.macros.find(x => x.id === id);
      if (m) {
        Object.assign(m, {
          category_id: Number(body.category_id),
          title: body.title,
          problem_description: body.problem_description,
          operator_action: body.operator_action,
          response_template: body.response_template,
          language: body.language || 'UZ',
          keywords: body.keywords || '',
          notes: body.notes || '',
          is_active: Number(body.is_active)
        });
      }
      return sendJson(res, 200, { success: true });
    }

    // DELETE /api/admin/macros/:id
    if (method === 'DELETE' && editMatch) {
      const id = Number(editMatch[1]);
      store.macros = store.macros.filter(x => x.id !== id);
      return sendJson(res, 200, { success: true });
    }

    // POST /api/admin/macros/:id/toggle
    const toggleMatch = pathname.match(/^\/api\/admin\/macros\/(\d+)\/toggle$/);
    if (method === 'POST' && toggleMatch) {
      const id = Number(toggleMatch[1]);
      const m = store.macros.find(x => x.id === id);
      if (m) {
        m.is_active = m.is_active === 1 ? 0 : 1;
        return sendJson(res, 200, { success: true, is_active: m.is_active });
      }
      return sendJson(res, 404, { error: 'Topilmadi' });
    }

    // POST /api/admin/macros/:id/duplicate
    const dupMatch = pathname.match(/^\/api\/admin\/macros\/(\d+)\/duplicate$/);
    if (method === 'POST' && dupMatch) {
      const id = Number(dupMatch[1]);
      const m = store.macros.find(x => x.id === id);
      if (m) {
        const dupId = store.nextMacroId++;
        const dup = { ...m, id: dupId, title: `${m.title} (Nusxa)` };
        store.macros.push(dup);
        return sendJson(res, 201, { success: true, id: dupId });
      }
      return sendJson(res, 404, { error: 'Topilmadi' });
    }

    // POST /api/admin/categories
    if (method === 'POST' && pathname === '/api/admin/categories') {
      const body = await parseBody(req);
      const newCatId = store.nextCatId++;
      store.categories.push({ id: newCatId, name: body.name, icon: body.icon || '📁' });
      return sendJson(res, 201, { success: true, id: newCatId });
    }

    // PUT /api/admin/categories/:id
    const catEditMatch = pathname.match(/^\/api\/admin\/categories\/(\d+)$/);
    if (method === 'PUT' && catEditMatch) {
      const id = Number(catEditMatch[1]);
      const body = await parseBody(req);
      const c = store.categories.find(x => x.id === id);
      if (c) {
        c.name = body.name;
        c.icon = body.icon || '📁';
      }
      return sendJson(res, 200, { success: true });
    }

    // DELETE /api/admin/categories/:id
    if (method === 'DELETE' && catEditMatch) {
      const id = Number(catEditMatch[1]);
      const hasMacros = store.macros.some(m => m.category_id === id);
      if (hasMacros) {
        return sendJson(res, 400, { error: 'Kategoriyada makroslar mavjud' });
      }
      store.categories = store.categories.filter(x => x.id !== id);
      return sendJson(res, 200, { success: true });
    }

    // GET /api/admin/backup
    if (method === 'GET' && pathname === '/api/admin/backup') {
      return sendJson(res, 200, {
        version: '1.0',
        exported_at: new Date().toISOString(),
        categories: store.categories,
        macros: store.macros
      });
    }

    // POST /api/admin/change-password
    if (method === 'POST' && pathname === '/api/admin/change-password') {
      const body = await parseBody(req);
      const currentHash = crypto.createHash('sha256').update(body.currentPassword || '').digest('hex');
      if (currentHash !== store.adminUser.passwordHash) {
        return sendJson(res, 400, { error: 'Joriy parol noto‘g‘ri' });
      }
      store.adminUser.passwordHash = crypto.createHash('sha256').update(body.newPassword || '').digest('hex');
      return sendJson(res, 200, { success: true });
    }
  }

  // Not found
  return sendJson(res, 404, { error: 'API endpoint not found' });
};
