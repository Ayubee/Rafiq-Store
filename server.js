/**
 * SUPPORT MANUAL & MACRO MANAGER - BACKEND SERVER
 * Zero-dependency Node.js server using built-in http, node:sqlite, and crypto.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
let DatabaseSync = null;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (e) {
  // node:sqlite not available on older runtimes (e.g. Node 20 on Vercel)
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const IS_VERCEL = Boolean(process.env.VERCEL);
const PUBLIC_DIR = path.join(__dirname, 'public');

// Initialize Database (SQLite if available, otherwise In-Memory JSON store for Vercel Node 20)
let db;
let isInMemory = false;

if (DatabaseSync) {
  let DB_FILE;
  if (IS_VERCEL) {
    const tmpDb = path.join('/tmp', 'support.db');
    const bundledDb = path.join(__dirname, 'data', 'support.db');
    if (!fs.existsSync(tmpDb)) {
      if (fs.existsSync(bundledDb)) {
        try { fs.copyFileSync(bundledDb, tmpDb); } catch (err) {}
      }
    }
    DB_FILE = tmpDb;
  } else {
    const DATA_DIR = path.join(__dirname, 'data');
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    DB_FILE = path.join(DATA_DIR, 'support.db');
  }

  db = new DatabaseSync(DB_FILE);

  try {
    if (IS_VERCEL) {
      db.exec('PRAGMA journal_mode = DELETE;');
    } else {
      db.exec('PRAGMA journal_mode = WAL;');
    }
    db.exec('PRAGMA foreign_keys = ON;');
  } catch (e) {}
} else {
  // --- IN-MEMORY FALLBACK FOR VERCEL RUNTIMES WITHOUT node:sqlite ---
  isInMemory = true;
  console.log('[Notice] Running in-memory store fallback');

  const memoryStore = {
    categories: [],
    macros: [],
    admin_users: [],
    admin_tokens: [],
    catSeq: 1,
    macroSeq: 1
  };

  db = {
    exec(sql) {},
    prepare(sql) {
      const trimmed = sql.trim();
      return {
        all(...params) {
          if (trimmed.includes('FROM macros') && trimmed.includes('is_active = 1')) {
            return memoryStore.macros.filter(m => m.is_active === 1).sort((a,b) => b.usage_count - a.usage_count);
          }
          if (trimmed.includes('FROM macros m') && trimmed.includes('JOIN categories')) {
            return memoryStore.macros.map(m => {
              const cat = memoryStore.categories.find(c => c.id === m.category_id) || {};
              return { ...m, category_name: cat.name || 'Umumiy', category_icon: cat.icon || '📁' };
            }).sort((a,b) => b.id - a.id);
          }
          if (trimmed.includes('FROM categories c')) {
            return memoryStore.categories.map(c => {
              const count = memoryStore.macros.filter(m => m.category_id === c.id && m.is_active === 1).length;
              return { ...c, macro_count: count };
            });
          }
          if (trimmed.includes('FROM categories ORDER BY id ASC')) {
            return memoryStore.categories;
          }
          if (trimmed.includes('FROM macros ORDER BY id ASC')) {
            return memoryStore.macros;
          }
          if (trimmed.includes('ORDER BY usage_count DESC LIMIT 5')) {
            return [...memoryStore.macros].sort((a,b) => (b.usage_count||0) - (a.usage_count||0)).slice(0, 5);
          }
          if (trimmed.includes('ORDER BY id DESC LIMIT 5')) {
            return [...memoryStore.macros].sort((a,b) => b.id - a.id).slice(0, 5);
          }
          return [];
        },
        get(...params) {
          if (trimmed.includes('SELECT COUNT(*) as c FROM categories')) {
            return { c: memoryStore.categories.length };
          }
          if (trimmed.includes('SELECT COUNT(*) as c FROM macros WHERE is_active = 1')) {
            return { c: memoryStore.macros.filter(m => m.is_active === 1).length };
          }
          if (trimmed.includes('SELECT COUNT(*) as c FROM macros WHERE category_id = ?')) {
            return { c: memoryStore.macros.filter(m => m.category_id === Number(params[0])).length };
          }
          if (trimmed.includes('SELECT COUNT(*) as c FROM macros')) {
            return { c: memoryStore.macros.length };
          }
          if (trimmed.includes('SELECT COALESCE(SUM(usage_count), 0) as s FROM macros')) {
            const s = memoryStore.macros.reduce((acc, m) => acc + (m.usage_count || 0), 0);
            return { s };
          }
          if (trimmed.includes('FROM admin_users WHERE username = ?')) {
            return memoryStore.admin_users.find(u => u.username === params[0]);
          }
          if (trimmed.includes('FROM admin_tokens WHERE token = ?')) {
            const token = params[0];
            const session = memoryStore.admin_tokens.find(t => t.token === token);
            if (!session) return null;
            if (session.expires_at && session.expires_at < Date.now()) {
              memoryStore.admin_tokens = memoryStore.admin_tokens.filter(t => t.token !== token);
              return null;
            }
            return session;
          }
          if (trimmed.includes('SELECT is_active FROM macros WHERE id = ?')) {
            const m = memoryStore.macros.find(x => x.id === Number(params[0]));
            return m ? { is_active: m.is_active } : null;
          }
          if (trimmed.includes('SELECT * FROM macros WHERE id = ?')) {
            return memoryStore.macros.find(x => x.id === Number(params[0])) || null;
          }
          if (trimmed.includes('SELECT id FROM categories WHERE name = ?')) {
            const cat = memoryStore.categories.find(c => c.name === params[0]);
            return cat ? { id: cat.id } : null;
          }
          return null;
        },
        run(...params) {
          if (trimmed.startsWith('INSERT INTO admin_users')) {
            memoryStore.admin_users.push({ username: params[0], password_hash: params[1] });
            return { lastInsertRowid: 1 };
          }
          if (trimmed.startsWith('INSERT INTO admin_tokens')) {
            memoryStore.admin_tokens.push({ token: params[0], username: params[1], expires_at: params[2] });
            return { lastInsertRowid: 1 };
          }
          if (trimmed.startsWith('DELETE FROM admin_tokens WHERE token = ?')) {
            memoryStore.admin_tokens = memoryStore.admin_tokens.filter(t => t.token !== params[0]);
            return {};
          }
          if (trimmed.startsWith('INSERT INTO categories')) {
            const id = memoryStore.catSeq++;
            memoryStore.categories.push({ id, name: params[0], icon: params[1] || '📁' });
            return { lastInsertRowid: id };
          }
          if (trimmed.startsWith('INSERT INTO macros')) {
            const id = memoryStore.macroSeq++;
            memoryStore.macros.push({
              id,
              category_id: Number(params[0]),
              title: params[1],
              problem_description: params[2],
              operator_action: params[3],
              response_template: params[4],
              language: params[5],
              keywords: params[6],
              notes: params[7],
              is_active: params[8] !== undefined ? params[8] : 1,
              usage_count: params[9] !== undefined ? params[9] : 0,
              created_at: new Date().toISOString()
            });
            return { lastInsertRowid: id };
          }
          if (trimmed.startsWith('UPDATE macros SET usage_count = usage_count + 1 WHERE id = ?')) {
            const m = memoryStore.macros.find(x => x.id === Number(params[0]));
            if (m) m.usage_count = (m.usage_count || 0) + 1;
            return {};
          }
          if (trimmed.startsWith('UPDATE macros SET category_id = ?')) {
            const m = memoryStore.macros.find(x => x.id === Number(params[params.length - 1]));
            if (m) {
              m.category_id = Number(params[0]);
              m.title = params[1];
              m.problem_description = params[2];
              m.operator_action = params[3];
              m.response_template = params[4];
              m.language = params[5];
              m.keywords = params[6];
              m.notes = params[7];
              m.is_active = Number(params[8]);
            }
            return {};
          }
          if (trimmed.startsWith('UPDATE macros SET is_active = ? WHERE id = ?')) {
            const m = memoryStore.macros.find(x => x.id === Number(params[1]));
            if (m) m.is_active = Number(params[0]);
            return {};
          }
          if (trimmed.startsWith('DELETE FROM macros WHERE id = ?')) {
            memoryStore.macros = memoryStore.macros.filter(x => x.id !== Number(params[0]));
            return {};
          }
          if (trimmed.startsWith('UPDATE categories SET name = ?')) {
            const c = memoryStore.categories.find(x => x.id === Number(params[2]));
            if (c) { c.name = params[0]; c.icon = params[1]; }
            return {};
          }
          if (trimmed.startsWith('DELETE FROM categories WHERE id = ?')) {
            memoryStore.categories = memoryStore.categories.filter(x => x.id !== Number(params[0]));
            return {};
          }
          if (trimmed.startsWith('UPDATE admin_users SET password_hash = ?')) {
            const u = memoryStore.admin_users.find(x => x.username === params[1]);
            if (u) u.password_hash = params[0];
            return {};
          }
          return {};
        }
      };
    }
  };
}

// In-memory rate limiter for login attempts (brute force protection)
const loginAttempts = new Map(); // IP -> { count, lockedUntil }

function checkLoginRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return true;

  if (record.lockedUntil && record.lockedUntil > now) {
    const remainingSec = Math.ceil((record.lockedUntil - now) / 1000);
    throw new Error(`Ko‘p marta noto‘g‘ri urinish. Iltimos, ${remainingSec} soniya kuting.`);
  }

  if (record.lockedUntil && record.lockedUntil <= now) {
    loginAttempts.delete(ip);
    return true;
  }

  return true;
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0 };
  record.count += 1;
  if (record.count >= 5) {
    record.lockedUntil = now + 60 * 1000; // Lock for 60 seconds
  }
  loginAttempts.set(ip, record);
}

function clearFailedLogin(ip) {
  loginAttempts.delete(ip);
}

// Setup database tables and indexes
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT DEFAULT '📁',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS macros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      problem_description TEXT NOT NULL,
      operator_action TEXT NOT NULL,
      response_template TEXT NOT NULL,
      language TEXT DEFAULT 'UZ',
      keywords TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      usage_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_tokens (
      token TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_macros_category ON macros(category_id);
    CREATE INDEX IF NOT EXISTS idx_macros_active ON macros(is_active);
  `);

  // Run migrations if needed
  try {
    db.exec('ALTER TABLE admin_tokens ADD COLUMN expires_at INTEGER;');
  } catch (e) {
    // Column already exists
  }

  // Seed Admin user if not present
  const adminCheck = db.prepare('SELECT id FROM admin_users WHERE username = ?').get('admin');
  if (!adminCheck) {
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const passwordHash = crypto.createHash('sha256').update(defaultPassword).digest('hex');
    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run('admin', passwordHash);
  }

  // Seed default categories and realistic macros if empty
  const countCats = db.prepare('SELECT COUNT(*) as c FROM categories').get();
  if (countCats.c === 0) {
    seedInitialData();
  }
}

function seedInitialData() {
  const insertCat = db.prepare('INSERT INTO categories (name, icon) VALUES (?, ?)');
  const catMap = {};

  const categories = [
    { name: 'Balans va to‘lovlar', icon: '💳' },
    { name: 'Foto nazorat', icon: '📷' },
    { name: 'Buyurtmalar', icon: '🚕' },
    { name: 'Akkaunt', icon: '👤' },
    { name: 'Bonus va promokodlar', icon: '🎁' },
    { name: 'Texnik muammolar', icon: '⚙️' },
    { name: 'Hujjatlar', icon: '📄' },
    { name: 'Boshqa mavzular', icon: '💬' }
  ];

  for (const c of categories) {
    const res = insertCat.run(c.name, c.icon);
    catMap[c.name] = Number(res.lastInsertRowid);
  }

  const insertMacro = db.prepare(`
    INSERT INTO macros (category_id, title, problem_description, operator_action, response_template, language, keywords, notes, is_active, usage_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);

  const sampleMacros = [
    {
      cat: 'Balans va to‘lovlar',
      title: 'Balans to‘ldirilganda mablag‘ hisobga o‘tmay qolishi',
      problem: 'Haydovchi Payme yoki Click orqali balans to‘ldirgan, pul kartadan yechilgan, ammo ilova balansida ko‘rinmayapti.',
      action: '1. Haydovchining telefon raqamini va to‘lov kvitansiyasini (chek) so‘rang.\n2. Billing bo‘limida tranzaksiya ID si bo‘yicha to‘lov holatini tekshiring.\n3. Agar tranzaksiya kutish holatida bo‘lsa, bank processing yangilanishini kuting yoki qo‘lda tasdiqlang.',
      response: 'Assalomu alaykum! To‘lov kvitansiyasini (chek) ushbu chatga rasm ko‘rinishida yuborishingizni so‘raymiz. Biz to‘lov ID raqamini tizim orqali tekshirib, 10-15 daqiqa ichida balansingizga mablag‘ni aks ettirib beramiz. Keltirilgan noqulaylik uchun uzr so‘raymiz.',
      lang: 'UZ',
      keywords: 'balans, to‘lov, payme, click, pul tushmadi, chek, kvitansiya',
      notes: 'Tranzaksiya 30 daqiqadan oshgan bo‘lsa moliya bo‘limiga xabar yuborish kerak.',
      usage: 42
    },
    {
      cat: 'Balans va to‘lovlar',
      title: 'Деньги списаны с карты, но баланс не пополнился',
      problem: 'Водитель пополнил баланс через банковскую карту, деньги списались, но на балансе приложения не отображаются.',
      action: '1. Запросите у водителя номер телефона и квитанцию (чек) об оплате.\n2. Проверьте ID транзакции в биллинге.\n3. При успешном статусе в банке подтвердите зачисление вручную.',
      response: 'Здравствуйте! Пожалуйста, отправьте квитанцию или скриншот чека об оплате в этот чат. Мы сверим номер транзакции с банковской системой и зачислим средства на ваш баланс в течение 10–15 минут. Приносим извинения за временные неудобства.',
      lang: 'RU',
      keywords: 'баланс, оплата, чек, деньги не поступили, пополнение',
      notes: 'Если банк отклонил платёж, уведомить водителя о возврате в течение 24 часов.',
      usage: 28
    },
    {
      cat: 'Foto nazorat',
      title: 'Avtomobil foto nazoratidan o‘ta olmaslik',
      problem: 'Haydovchi avtomobil rasmlarini yuklagan, biroq tizim rad etgan yoki uzoq vaqt tekshirilmoqda.',
      action: '1. Haydovchi profilidagi oxirgi yuborilgan rasmlarni oching.\n2. Davlat raqami, mashina tozaligi va salon holatini ko‘zdan kechiring.\n3. Qaysi burchak xato tushirilganligini aniqlang va qayta topshirish talabini tushuntiring.',
      response: 'Assalomu alaykum! Foto nazorat rasmlaringiz tekshirildi. Avtomobil davlat raqami xira tushganligi yoki mashina toza emasligi sababli rasm rad etilgan. Iltimos, avtomobilni yorug‘ joyda, davlat raqami va barcha to‘rtta tomoni aniq ko‘rinadigan qilib qayta suratga olib ilovaga yuklang.',
      lang: 'UZ',
      keywords: 'foto nazorat, mashina rasmi, rad etildi, tekshiruv, sifat',
      notes: 'Besh marta rad etilsa xizmat ko‘rsatish markaziga yo‘naltiriladi.',
      usage: 35
    },
    {
      cat: 'Foto nazorat',
      title: 'Не пройден фотоконтроль автомобиля',
      problem: 'Водитель загрузил фото авто, но статус отклонён модератором.',
      action: '1. Откройте в админке фотографии водителя.\n2. Выявите причину отказа (грязь, блик на номере, посторонние предметы в салоне).\n3. Укажите точную причину водителю.',
      response: 'Здравствуйте! Ваш фотоконтроль был отклонен, так как государственные номера или детали кузова видны недостаточно четко. Пожалуйста, сделайте новые снимки в освещенном месте, без бликов и посторонних предметов, затем повторно отправьте через приложение.',
      lang: 'RU',
      keywords: 'фотоконтроль, фото авто, отклонено, модерация, номера',
      notes: 'Напоминать водителю протирать госномер перед съемкой.',
      usage: 19
    },
    {
      cat: 'Buyurtmalar',
      title: 'Mijoz sababsiz buyurtmani bekor qildi (Kompensatsiya)',
      problem: 'Haydovchi buyurtma manziliga yetib kelganida mijoz buyurtmani bekor qildi, haydovchi sarflangan vaqt va yoqilg‘i uchun kompensatsiya so‘ramoqda.',
      action: '1. Buyurtma tarixi va haydovchining GPS marshrutini tekshiring.\n2. Haydovchi yetib borish tugmasini bosganidan so‘ng mijoz bekor qilganini tasdiqlang.\n3. Qoidalarga asosan bekor qilish kompensatsiyasini hisoblang va hisobga o‘tkazing.',
      response: 'Assalomu alaykum! Buyurtmangiz tafsilotlari va GPS koordinatalari tekshirildi. Siz ko‘rsatilgan manzilga o‘z vaqtida yetib borganingiz tasdiqlandi. Mijoz tomonidan asossiz bekor qilinganligi sababli, balansingizga bekor qilish kompensatsiyasi o‘tkazib berildi. Yaxshi ish va xavfsiz yo‘l tilaymiz!',
      lang: 'UZ',
      keywords: 'bekor qilindi, mijoz bekor qildi, kompensatsiya, yetib keldim, yo‘l haqi',
      notes: 'Yetib bormasdan bosilgan bo‘lsa kompensatsiya berilmaydi.',
      usage: 51
    },
    {
      cat: 'Akkaunt',
      title: 'Ilovaga kirishda SMS kod kelmasligi',
      problem: 'Foydalanuvchi yoki haydovchi telefon raqamini kiritganda tasdiqlash SMS xabari kelmayapti.',
      action: '1. Raqam to‘g‘ri terilganini va aloqa operatori SMS shlyuz holatini tekshiring.\n2. Qora ro‘yxatda (spam block) emasligini aniqlang.\n3. Foydalanuvchiga telefonni qayta ishga tushirish yoki 2 daqiqadan so‘ng qayta urinishni tavsiya qiling.',
      response: 'Assalomu alaykum! Iltimos, kiritilgan telefon raqami to‘g‘riligini va telefoningizda aloqa signali mavjudligini tekshiring. Ba’zan uyali aloqa operatorlari tomonidan SMS yuborishda qisqa muddatli kechikishlar kuzatiladi. Iltimos, 2-3 daqiqa kutib, ilovani qayta oching va yangi kod so‘rang.',
      lang: 'UZ',
      keywords: 'sms, kod, kira olmayapman, login, autentifikatsiya, parol',
      notes: 'Agar Ucell/Beeline da ommaviy muammo bo‘lsa, status-sahifaga qarang.',
      usage: 24
    },
    {
      cat: 'Bonus va promokodlar',
      title: 'Promokod aktivlashtirilganda xatolik berishi',
      problem: 'Mijoz promokodni kiritganda "Yaroqsiz kod" yoki "Muddati o‘tgan" xatosi chiqmoqda.',
      action: '1. Promokod matnini va amal qilish muddatini marketing bazasidan tekshiring.\n2. Promokod faqat birinchi buyurtma uchun yoki ma’lum toifadagi xizmat uchun ekanligini ko‘ring.\n3. Mijozga shartlarini tushuntiring.',
      response: 'Assalomu alaykum! Ushbu promokod faqat birinchi buyurtma yoki ma’lum toifadagi xizmatlar uchun amal qiladi. Iltimos, promokodni kiritishda katta-kichik harflar va bo‘sh joylar (probel) yo‘qligiga e’tibor bering. Agar aksiya muddati tugagan bo‘lsa, ilovamizning "Aksiyalar" bo‘limidagi faol promokodlardan foydalanishingiz mumkin.',
      lang: 'UZ',
      keywords: 'promokod, bonus, chegirma, aksiya, xatolik',
      notes: 'Bir martalik kod bo‘lsa, avval ishlatilganini tekshiring.',
      usage: 16
    },
    {
      cat: 'Texnik muammolar',
      title: 'GPS xarita joylashuvini noto‘g‘ri ko‘rsatishi',
      problem: 'Ilovadagi xaritada haydovchi yoki mijoz koordinatasi sakrab ketyapti yoki qotib qolgan.',
      action: '1. Ilova versiyasi eng oxirgisi ekanligini tekshiring.\n2. Telefonda geolokatsiya ruxsatlari "Har doim ruxsat berilsin" va "Yuqori aniqlik" rejimida ekanligini eslatib o‘ting.',
      response: 'Assalomu alaykum! GPS joylashuvining aniq ishlashi uchun telefon sozlamalaridan:\n1. "Geolokatsiya" bo‘limida "Yuqori aniqlik (Tochnost)" rejimini yoqing.\n2. Ilova uchun geolokatsiyadan foydalanishga "Har doim ruxsat" berilganligini tekshiring.\n3. Quvvatni tejash (Energosberejeniye) rejimini o‘chirib, ilovani qayta ishga tushiring.',
      lang: 'UZ',
      keywords: 'gps, xarita, navigator, qotib qoldi, koordinata, manzil',
      notes: 'Xiaomi/Samsung telefonlarida foniy rejim cheklovlari tez-tez uchraydi.',
      usage: 31
    }
  ];

  for (const m of sampleMacros) {
    insertMacro.run(
      catMap[m.cat] || 1,
      m.title,
      m.problem,
      m.action,
      m.response,
      m.lang,
      m.keywords,
      m.notes,
      m.usage
    );
  }
}

// Admin Auth Helper with Token Expiration Check
function authenticateAdmin(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.substring(7).trim();
  try {
    const session = db.prepare('SELECT username, expires_at FROM admin_tokens WHERE token = ?').get(token);
    if (!session) return false;
    if (session.expires_at && session.expires_at < Date.now()) {
      db.prepare('DELETE FROM admin_tokens WHERE token = ?').run(token);
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

// Request Body Parser Helper
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) { // 1MB limit
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
  });
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Set standard CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- PUBLIC API ENDPOINTS ---

  // 1. Get active macros for operators
  if (method === 'GET' && pathname === '/api/macros') {
    try {
      const macros = db.prepare(`
        SELECT id, category_id, title, problem_description, operator_action, 
               response_template, language, keywords, notes, is_active, usage_count, 
               created_at, updated_at
        FROM macros
        WHERE is_active = 1
        ORDER BY usage_count DESC, id DESC
      `).all();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(macros));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 2. Get categories
  if (method === 'GET' && pathname === '/api/categories') {
    try {
      const categories = db.prepare(`
        SELECT c.id, c.name, c.icon, COUNT(m.id) as macro_count
        FROM categories c
        LEFT JOIN macros m ON m.category_id = c.id AND m.is_active = 1
        GROUP BY c.id
        ORDER BY c.id ASC
      `).all();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(categories));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 3. Increment macro usage count
  const useMatch = pathname.match(/^\/api\/macros\/(\d+)\/use$/);
  if (method === 'POST' && useMatch) {
    const macroId = Number(useMatch[1]);
    try {
      db.prepare('UPDATE macros SET usage_count = usage_count + 1 WHERE id = ?').run(macroId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // --- ADMIN AUTHENTICATION ---

  // Admin login with Rate Limiting & Token Expiration
  if (method === 'POST' && pathname === '/api/admin/login') {
    const clientIp = req.socket.remoteAddress || '127.0.0.1';
    try {
      checkLoginRateLimit(clientIp);

      const { username, password } = await parseJsonBody(req);
      if (!username || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Foydalanuvchi nomi va parol kiritilishi shart' }));
        return;
      }

      const user = db.prepare('SELECT id, username, password_hash FROM admin_users WHERE username = ?').get(username);
      const hash = crypto.createHash('sha256').update(password).digest('hex');

      if (!user || user.password_hash !== hash) {
        recordFailedLogin(clientIp);
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Foydalanuvchi nomi yoki parol noto‘g‘ri' }));
        return;
      }

      // Successful login: reset failed attempts
      clearFailedLogin(clientIp);

      const token = crypto.randomBytes(32).toString('hex');
      // 24 hours expiry as integer timestamp
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      
      try {
        db.prepare('INSERT INTO admin_tokens (token, username, expires_at) VALUES (?, ?, ?)').run(token, username, expiresAt);
      } catch (tokenErr) {
        db.prepare('INSERT INTO admin_tokens (token, username) VALUES (?, ?)').run(token, username);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, token, username, expiresAt }));
    } catch (err) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Admin check session
  if (method === 'GET' && pathname === '/api/admin/check') {
    const isAuth = authenticateAdmin(req);
    res.writeHead(isAuth ? 200 : 401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ authenticated: isAuth }));
    return;
  }

  // Admin logout
  if (method === 'POST' && pathname === '/api/admin/logout') {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      db.prepare('DELETE FROM admin_tokens WHERE token = ?').run(token);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // --- PROTECTED ADMIN API ENDPOINTS ---
  if (pathname.startsWith('/api/admin/')) {
    if (!authenticateAdmin(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ruxsat yo‘q: Admin autentifikatsiyasi talab qilinadi' }));
      return;
    }

    // Backup Database (Export full JSON)
    if (method === 'GET' && pathname === '/api/admin/backup') {
      try {
        const categories = db.prepare('SELECT * FROM categories ORDER BY id ASC').all();
        const macros = db.prepare('SELECT * FROM macros ORDER BY id ASC').all();
        const backupData = {
          version: '1.0',
          exported_at: new Date().toISOString(),
          categories,
          macros
        };
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="support_macros_backup.json"'
        });
        res.end(JSON.stringify(backupData, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // Restore Database (Import from JSON)
    if (method === 'POST' && pathname === '/api/admin/restore') {
      try {
        const payload = await parseJsonBody(req);
        if (!payload.categories || !payload.macros) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Yaroqsiz backup fayli formati' }));
          return;
        }

        // Import categories and map old IDs to new IDs
        const catMap = {};
        const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name, icon) VALUES (?, ?)');
        const getCat = db.prepare('SELECT id FROM categories WHERE name = ?');

        for (const cat of payload.categories) {
          insertCat.run(cat.name, cat.icon || '📁');
          const existing = getCat.get(cat.name);
          if (existing) catMap[cat.id] = existing.id;
        }

        // Import macros
        const insertMacro = db.prepare(`
          INSERT INTO macros (category_id, title, problem_description, operator_action, response_template, language, keywords, notes, is_active, usage_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let importedCount = 0;
        for (const m of payload.macros) {
          const targetCatId = catMap[m.category_id] || 1;
          insertMacro.run(
            targetCatId,
            m.title,
            m.problem_description || '',
            m.operator_action || '',
            m.response_template,
            m.language || 'UZ',
            m.keywords || '',
            m.notes || '',
            m.is_active !== undefined ? m.is_active : 1,
            m.usage_count || 0
          );
          importedCount += 1;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: importedCount }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // Change password endpoint
    if (method === 'POST' && pathname === '/api/admin/change-password') {
      try {
        const { currentPassword, newPassword } = await parseJsonBody(req);
        if (!currentPassword || !newPassword || newPassword.length < 6) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Yangi parol kamida 6 ta belgidan iborat bo‘lishi kerak' }));
          return;
        }

        // Get admin user
        const user = db.prepare('SELECT id, password_hash FROM admin_users WHERE username = ?').get('admin');
        const currentHash = crypto.createHash('sha256').update(currentPassword).digest('hex');

        if (!user || user.password_hash !== currentHash) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Joriy parol noto‘g‘ri kiritildi' }));
          return;
        }

        const newHash = crypto.createHash('sha256').update(newPassword).digest('hex');
        db.prepare('UPDATE admin_users SET password_hash = ? WHERE username = ?').run(newHash, 'admin');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Parol muvaffaqiyatli yangilandi' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 1. Dashboard stats
    if (method === 'GET' && pathname === '/api/admin/stats') {
      try {
        const totalMacros = db.prepare('SELECT COUNT(*) as c FROM macros').get().c;
        const activeMacros = db.prepare('SELECT COUNT(*) as c FROM macros WHERE is_active = 1').get().c;
        const totalCategories = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
        const totalUsage = db.prepare('SELECT COALESCE(SUM(usage_count), 0) as s FROM macros').get().s;

        const topMacros = db.prepare(`
          SELECT id, title, usage_count, language 
          FROM macros 
          ORDER BY usage_count DESC 
          LIMIT 5
        `).all();

        const recentCreated = db.prepare(`
          SELECT id, title, created_at, language 
          FROM macros 
          ORDER BY id DESC 
          LIMIT 5
        `).all();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          totalMacros,
          activeMacros,
          totalCategories,
          totalUsage,
          topMacros,
          recentCreated
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 2. Get all macros (including inactive)
    if (method === 'GET' && pathname === '/api/admin/macros') {
      try {
        const macros = db.prepare(`
          SELECT m.*, c.name as category_name, c.icon as category_icon
          FROM macros m
          JOIN categories c ON c.id = m.category_id
          ORDER BY m.id DESC
        `).all();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(macros));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 3. Create new macro
    if (method === 'POST' && pathname === '/api/admin/macros') {
      try {
        const data = await parseJsonBody(req);
        if (!data.title || !data.category_id || !data.response_template) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Nomi, kategoriya va tayyor javob to‘ldirilishi shart' }));
          return;
        }

        const insert = db.prepare(`
          INSERT INTO macros (category_id, title, problem_description, operator_action, response_template, language, keywords, notes, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = insert.run(
          Number(data.category_id),
          data.title.trim(),
          (data.problem_description || '').trim(),
          (data.operator_action || '').trim(),
          data.response_template.trim(),
          data.language || 'UZ',
          (data.keywords || '').trim(),
          (data.notes || '').trim(),
          data.is_active !== undefined ? Number(data.is_active) : 1
        );

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, id: Number(result.lastInsertRowid) }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 4. Update macro
    const updateMatch = pathname.match(/^\/api\/admin\/macros\/(\d+)$/);
    if (method === 'PUT' && updateMatch) {
      const macroId = Number(updateMatch[1]);
      try {
        const data = await parseJsonBody(req);
        const update = db.prepare(`
          UPDATE macros 
          SET category_id = ?, title = ?, problem_description = ?, operator_action = ?,
              response_template = ?, language = ?, keywords = ?, notes = ?, is_active = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);

        update.run(
          Number(data.category_id),
          data.title.trim(),
          (data.problem_description || '').trim(),
          (data.operator_action || '').trim(),
          data.response_template.trim(),
          data.language || 'UZ',
          (data.keywords || '').trim(),
          (data.notes || '').trim(),
          Number(data.is_active),
          macroId
        );

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 5. Delete macro
    if (method === 'DELETE' && updateMatch) {
      const macroId = Number(updateMatch[1]);
      try {
        db.prepare('DELETE FROM macros WHERE id = ?').run(macroId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 6. Toggle active status
    const toggleMatch = pathname.match(/^\/api\/admin\/macros\/(\d+)\/toggle$/);
    if (method === 'POST' && toggleMatch) {
      const macroId = Number(toggleMatch[1]);
      try {
        const item = db.prepare('SELECT is_active FROM macros WHERE id = ?').get(macroId);
        if (!item) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Makros topilmadi' }));
          return;
        }
        const newStatus = item.is_active === 1 ? 0 : 1;
        db.prepare('UPDATE macros SET is_active = ? WHERE id = ?').run(newStatus, macroId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, is_active: newStatus }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 7. Duplicate macro
    const dupMatch = pathname.match(/^\/api\/admin\/macros\/(\d+)\/duplicate$/);
    if (method === 'POST' && dupMatch) {
      const macroId = Number(dupMatch[1]);
      try {
        const orig = db.prepare('SELECT * FROM macros WHERE id = ?').get(macroId);
        if (!orig) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Makros topilmadi' }));
          return;
        }

        const insert = db.prepare(`
          INSERT INTO macros (category_id, title, problem_description, operator_action, response_template, language, keywords, notes, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        `);

        const resDup = insert.run(
          orig.category_id,
          `${orig.title} (Nusxa)`,
          orig.problem_description,
          orig.operator_action,
          orig.response_template,
          orig.language,
          orig.keywords,
          orig.notes
        );

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, id: Number(resDup.lastInsertRowid) }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 8. Categories CRUD
    if (method === 'POST' && pathname === '/api/admin/categories') {
      try {
        const { name, icon } = await parseJsonBody(req);
        if (!name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Kategoriya nomi kiritilishi shart' }));
          return;
        }
        const insert = db.prepare('INSERT INTO categories (name, icon) VALUES (?, ?)');
        const resCat = insert.run(name.trim(), (icon || '📁').trim());
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, id: Number(resCat.lastInsertRowid) }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    const catUpdateMatch = pathname.match(/^\/api\/admin\/categories\/(\d+)$/);
    if (method === 'PUT' && catUpdateMatch) {
      const catId = Number(catUpdateMatch[1]);
      try {
        const { name, icon } = await parseJsonBody(req);
        db.prepare('UPDATE categories SET name = ?, icon = ? WHERE id = ?').run(
          name.trim(),
          (icon || '📁').trim(),
          catId
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (method === 'DELETE' && catUpdateMatch) {
      const catId = Number(catUpdateMatch[1]);
      try {
        // Check if category has macros
        const count = db.prepare('SELECT COUNT(*) as c FROM macros WHERE category_id = ?').get(catId).c;
        if (count > 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Bu kategoriyada ${count} ta makros mavjud. Avval ularni boshqa kategoriyaga o‘tkazing yoki o‘chiring.` }));
          return;
        }

        db.prepare('DELETE FROM categories WHERE id = ?').run(catId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  // --- STATIC FILE SERVER ---
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  
  // Security check to avoid directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA routing if needed
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        res.end('Error loading file');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

// Initialize and start server
initDb();

function startServer(port) {
  server.listen(port, () => {
    console.log(`[Support Desk Server] running at http://localhost:${port}`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[Port ${PORT} in use, trying ${PORT + 1}...]`);
    PORT += 1;
    startServer(PORT);
  } else {
    console.error('Server error:', err);
  }
});

// Run standalone server on local/Render, but export handler for Vercel Serverless
if (!IS_VERCEL) {
  startServer(PORT);
}

module.exports = (req, res) => {
  server.emit('request', req, res);
};
