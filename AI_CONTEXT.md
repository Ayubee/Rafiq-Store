# 🤖 AI_CONTEXT.md — Support Manual & Macro Manager
> **Eslatma boshqa AI / LLM agentlar uchun:** Ushbu hujjat loyihaning to‘liq arxitekturasi, biznes mantiqi, hal qilingan texnik muammolar va kod bazasi tuzilmasini bir qarashda tushunishingiz uchun maxsus tayyorlangan. Har qanday o‘zgartirish kiritishdan oldin ushbu qo‘llanmani to‘liq o‘qib chiqing.

---

## 1. Loyihaning asosiy maqsadi (Project Overview)
**Support Manual & Macro Manager** — mijozlar va haydovchilar bilan ishlovchi qo‘llab-quvvatlash xizmati (Call Center / Support Desk) operatorlari uchun yaratilgan o‘ta yengil, tezkor va zamonaviy Web Application.

- **Asosiy vazifa:** Operator murojaat olganda (masalan: *balans to‘ldirilmadi, foto nazorat rad etildi, buyurtma bekor bo‘ldi, ilovaga kira olmayapti, promokod ishlamadi*), kerakli javobni **5–10 soniya ichida** topishi va bir bosishda mijozga yuborish uchun nusxalab olishi (COPY) kerak.
- **Ikki tomonlama interfeys:**
  1. **Operator paneli:** Oddiy, tezkor, chalg‘ituvchi elementlarsiz, klaviatura hotkeylari bilan boshqariladigan panel.
  2. **Admin paneli:** Himoyalangan alohida panel — yangi makroslar qo‘shish, tahrirlash, o‘chirish, nofaol qilish, nusxa olish, kategoriyalar boshqaruvi, dashboard analitikasi va bazani JSON backup/restore qilish.

---

## 2. Texnologik Stek va Arxitektura (Zero-Dependency)
Loyiha **ortiqcha tashqi kutubxonalarsiz (Zero external dependencies)**, faqat Node.js ning o‘zida mavjud built-in modullari asosida qurilgan.

- **Runtime:** Node.js (v20+ va v22+ qo‘llab-quvvatlaydi).
- **Backend:** Node.js built-in `http`, `crypto`, `fs`, `path`, `node:sqlite`.
- **Database (Dual-Architecture):**
  - **Lokal & Render.com (Doimiy server):** Rasmiy `node:sqlite` (SQLite ma’lumotlar bazasi `data/support.db`) orqali **WAL (Write-Ahead Logging)** rejimida ishlaydi.
  - **Vercel (Serverless):** Vercel serverless platformasi stateless bo‘lgani uchun xotirada ishlovchi crash-proof **In-Memory Store (`data/seed.json` asosida)** va **Stateless HMAC SHA-256 Token Auth** bilan ishlaydi.
- **Frontend:** Vanilla JavaScript (ES6+), Semantic HTML5, CSS Variables asosidagi Light/Dark mode Support Dashboard dizayn tizimi.

---

## 3. Fayllar Tuzilmasi va Ularning Vazifalari
```text
rafiq-store/
├── AI_CONTEXT.md              # Boshqa AI agentlar uchun ushbu to‘liq texnik qo‘llanma
├── README.md                  # Umumiy loyiha tavsifi (parollarsiz, toza)
├── package.json               # Node.js konfiguratsiyasi (scripts: start -> node server.js)
├── vercel.json                # Vercel Serverless routing sozlamalari
├── server.js                  # Asosiy HTTP server (standalone & local/Render rejim)
├── api/
│   └── index.js               # Vercel Serverless Function uchun REST API handleri
├── data/
│   ├── support.db             # SQLite ma'lumotlar bazasi (lokal va doimiy serverlar uchun)
│   └── seed.json              # 8 ta tayyor real makros va kategoriyalar JSON formati
├── index.html                 # Vercel Edge CDN uchun ildizdagi statik SPA fayl
├── css/
│   └── style.css              # Ildizdagi CSS dizayn tizimi (Dark/Light mode, grid, toast)
├── js/
│   ├── app.js                 # Operator paneli: qidiruv, transliteratsiya, copy, filtrlar
│   └── admin.js               # Admin paneli: HMAC auth, CRUD, kategoriya modali, sozlamalar
└── public/                    # Mahalliy server.js xizmat qiladigan statik katalog
    ├── index.html             # (index.html bilan sinxron)
    ├── css/style.css          # (css/style.css bilan sinxron)
    └── js/
        ├── app.js             # (js/app.js bilan sinxron)
        └── admin.js           # (js/admin.js bilan sinxron)
```

> ⚠️ **MUHIM QOIDA:** Agar frontend kodlariga (`index.html`, `style.css`, `app.js`, `admin.js`) o‘zgartirish kiritsangiz, **ham ildizdagi fayllarni, ham `public/` ichidagi fayllarni bir xil sinxron yangilang!** (Ildizdagi fayllar Vercel uchun, `public/` dagi fayllar esa `server.js` uchun xizmat qiladi).

---

## 4. Hal Qilingan Muhim Texnik Muammolar (Critical Fixes)

Boshqa AI ushbu loyihada ilgari yuz bergan va hal qilingan quyidagi nuqtalarni bilishi shart:

### 1) Vercel `attempt to write a readonly database` muammosi:
- **Sababi:** Vercel serverless konteyneri repozitoriya fayllarini faqat o‘qish rejimida (`Read-Only`) yuklaydi. SQLite bazaga yozishga uringanda xato beradi.
- **Yechim:** Vercel uchun ma’lumotlar bazasi alohida xavfsiz `api/index.js` serverless funksiyasiga o‘tkazildi va `data/seed.json` dan yuklanadigan In-Memory adapter yaratildi.

### 2) Vercel `500 INTERNAL_FUNCTION_INVOCATION_FAILED`:
- **Sababi:** Vercel default Node 20 runtime’da ishlaydi. Node 20 da `node:sqlite` yo‘q (u faqat Node 22+ da bor). Bundan tashqari serverless rejimida `server.listen(port)` chaqirish taqiqlangan.
- **Yechim:** `api/index.js` da `node:sqlite` ga bog‘liqlik butunlay olib tashlandi, sof JavaScript obyekti va JSON yordamida to‘liq REST API yaratildi, so‘rovlar port ochmasdan `(req, res)` orqali qabul qilinadi.

### 3) Vercel Stateless kontekstida Admin jadvalining bo‘sh qolishi (401 xatosi):
- **Sababi:** Vercel har bir so‘rovda yangi Lambda instansiyasini ochishi mumkin. Server xotirasidagi `Set(tokens)` instansiyalar orasida saqlanmaydi va login qilinganidan so‘ng keyingi so‘rovda token yo‘qolib, `401 Unauthorized` qaytgan.
- **Yechim:** **Stateless HMAC SHA-256 Token** tizimi yaratildi:
  `token = base64(username:expiresAt) + '.' + HMAC_SHA256(payload, secret)`. Har qanday yangi Lambda instansiyasi tokenni xotirasiz, kriptografik imzo orqali tekshiradi va 100% tanidi.

### 4) Qidiruv: O‘zbekcha Kirill va Lotin alifbolari (Dual-Script Transliteration):
- **Imkoniyat:** Operator qidiruvga `balans` deb yozsa ham, `баланс` deb yozsa ham tizim `getSearchVariants()` orqali ikkala alifboda mos keluvchi barcha makroslarni darhol topadi va sariq nishon (`<mark>`) bilan yoritib beradi.

### 5) 3 soniyalik Fast-Copy (Enter Hotkey):
- Operator qidiruv maydonida so‘z yozib, **`Enter`** tugmasini bosishi bilanoq, 1-o‘rindagi eng mos makrosning javobi bir zumda nusxalanadi va ekranda Toast bildirishnomasi chiqadi (sichqonchani ishlatish shart emas).

---

## 5. Ma’lumotlar Bazasi Sxemasi (Database Schema)

```sql
-- Kategoriyalar
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT '📁',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Makroslar
CREATE TABLE macros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  problem_description TEXT NOT NULL,
  operator_action TEXT NOT NULL,
  response_template TEXT NOT NULL,
  language TEXT DEFAULT 'UZ',           -- 'UZ' yoki 'RU'
  keywords TEXT,                        -- vergul bilan kalit so'zlar
  notes TEXT,                           -- faqat operatorlar ko'radigan eslatma
  is_active INTEGER DEFAULT 1,          -- 1: Faol, 0: Nofaol
  usage_count INTEGER DEFAULT 0,        -- Nusxalashlar soni
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
);

-- Admin hisoblari
CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. REST API Spesifikatsiyasi

### A. Ommaviy API (Operatorlar uchun):
- `GET /api/macros` — Faqat faol (`is_active = 1`) makroslar ro‘yxati (usage_count bo‘yicha saralangan).
- `GET /api/categories` — Barcha kategoriyalar va ulardagi faol makroslar soni (`macro_count`).
- `POST /api/macros/:id/use` — Makrosning nusxalanishlar sonini 1 taga oshirish.

### B. Admin API (Himoyalangan - `Authorization: Bearer <token>`):
- `POST /api/admin/login` — Kirish (`{ username, password }`). Natijada HMAC token qaytaradi.
- `GET /api/admin/check` — Sessiyaning yaroqliligini tekshirish.
- `POST /api/admin/logout` — Tizimdan chiqish.
- `GET /api/admin/stats` — Dashboard analitikasi (jami makroslar, faol makroslar, toifalar soni, jami nusxalashlar, top-5 makroslar).
- `GET /api/admin/macros` — Barcha (faol va nofaol) makroslarni to‘liq ro‘yxati.
- `POST /api/admin/macros` — Yangi makros yaratish.
- `PUT /api/admin/macros/:id` — Makrosni tahrirlash.
- `DELETE /api/admin/macros/:id` — Makrosni o‘chirish.
- `POST /api/admin/macros/:id/toggle` — Makrosni faol/nofaol qilish (1 ↔ 0).
- `POST /api/admin/macros/:id/duplicate` — Makrosdan nusxa olish.
- `POST /api/admin/categories` — Yangi kategoriya yaratish.
- `PUT /api/admin/categories/:id` — Kategoriya nomi va iconini o‘zgartirish.
- `DELETE /api/admin/categories/:id` — Bo‘sh kategoriyani o‘chirish (ichida makros bo‘lsa 400 qaytaradi).
- `GET /api/admin/backup` — Ma’lumotlar bazasini to‘liq JSON formatida yuklab olish.
- `POST /api/admin/restore` — JSON backup faylidan bazani qayta tiklash.
- `POST /api/admin/change-password` — Admin parolini xavfsiz yangilash.

---

## 7. Loyihani Ishga Tushirish va Sinash

### Lokal muhitda:
```bash
# Ishga tushirish (port 3001 da ochiladi)
node server.js
```
Brauzerda: `http://localhost:3001`

### Standart hisob ma’lumotlari:
- Foydalanuvchi nomi: `admin`
- Parol: `admin123` *(yoki `ADMIN_PASSWORD` muhit o‘zgaruvchisi orqali sozlanadi)*

### Git va Deployment:
Loyiha ikkala platformaga ham to‘liq moslashtirilgan:
1. **Render.com (Tavsiya etilgan doimiy server):** `Web Service` sifatida ishlaydi, `data/support.db` SQLite fayli umrbod saqlanadi.
2. **Vercel (Serverless):** `vercel.json` rewrites orqali `api/index.js` va ildizdagi statik fayllar bilan birgalikda ishlaydi.

---

## 8. Kelajakdagi AI / Developerlar uchun ko‘rsatmalar:
1. **Og‘ir tashqi kutubxonalar qo‘shmang** (loyihaning asosiy yutug‘i — uning yengilligi va nol-dependency ekanligi).
2. **HTML / CSS / JS ni yangilaganda:** Doimo ham `public/` katalogidagi, ham loyiha ildizidagi (root) fayllarni bir vaqtda yangilang.
3. **Admin autentifikatsiyasini buzmaslik:** Tokenlarni tekshirishda faqat server xotirasiga suyanmang, doimo `api/index.js` dagi kabi stateless HMAC imzo tekshiruvini saqlab qoling.
