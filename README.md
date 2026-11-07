# ⚡ Support Manual & Macro Manager

Zamonaviy, o‘ta tezkor va yengil ishlaydigan **Support Manual & Macro Manager** veb-ilovasi. Operatorlar mijoz va haydovchilar murojaatlariga 5–10 soniya ichida to‘g‘ri javob topishi va bir bosishda nusxalab yuborishi uchun mo‘ljallangan.

---

## 🌟 Asosiy imkoniyatlar

### 🎧 1. Operator paneli
- **Tezkor qidiruv**: Makros nomi, muammo tavsifi va kalit so‘zlar bo‘yicha bir zumda qidirish.
- **Tezkor tugmalar**: Qidiruvga o‘tish uchun `/` yoki `Ctrl + K`, tozalash uchun `Esc`.
- **Kategoriyalar**: Har bir toifada mavjud makroslar soni dinamik ko‘rsatiladi.
- **Bir marta bosishda nusxalash (COPY)**: Tayyor javob matnini nusxalash va tasdiqlovchi Toast bildirishnomasi.
- **Sevimlilar (⭐)**: Ko‘p ishlatiladigan makroslarni saqlab qo‘yish.
- **Oxirgi foydalanilganlar (🕒)**: Yaqinda ishlatilgan makroslar ro‘yxati.
- **Ko‘p tillilik**: O‘zbekcha (UZ) va Ruscha (RU) javoblar filtratsiyasi.
- **Mavzular**: Qorong‘i (Dark mode) va Yorug‘ (Light mode) ko‘rinishlar.

### ⚙️ 2. Admin paneli
- **Xavfsiz kirish**: Autentifikatsiya va token asosidagi sessiya.
- **Dashboard**: Jami makroslar, faol makroslar, kategoriyalar va eng ko‘p ishlatilgan javoblar tahlili.
- **To‘liq CRUD**: Yangi makros qo‘shish, tahrirlash, o‘chirish, nusxasini olish va vaqtincha to‘xtatib turish.
- **Kategoriyalar boshqaruvi**: Yangi bo‘limlar yaratish va tahrirlash.
- **Zero Rebuild**: Admin kiritgan o‘zgarishlar darhol operatorlar ekranida aks etadi.

---

## 🛠️ Texnologiyalar (Zero-Dependency)
- **Backend**: Node.js built-in `http`, `crypto`, `fs`.
- **Database**: Node.js built-in `node:sqlite` (SQLite ma’lumotlar bazasi). Hech qanday tashqi npm paketlar talab qilinmaydi!
- **Frontend**: Vanilla ES6+ JavaScript, CSS Variables bilan ishlab chiqilgan maxsus dizayn tizimi.

---

## 🚀 Ishga tushirish

1. Ushbu repository'ni klonlang:
   ```bash
   git clone <repo_url>
   cd "rafiq store"
   ```

2. Serverni ishga tushiring:
   ```bash
   node server.js
   # yoki
   npm start
   ```

3. Brauzerda oching:
   ```text
   http://localhost:3001
   ```


