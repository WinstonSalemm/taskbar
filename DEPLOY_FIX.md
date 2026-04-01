# 🚀 ОБНОВЛЕНИЕ НА RAILWAY

## Проблема:
405 Method Not Allowed на `/api/auth/login`

## Причина:
Railway крутит только frontend (статику), backend не запущен.

## Решение:

### 1. Закоммить новые файлы:
```bash
cd "c:\Users\Legion\Desktop\ОБУЧЕНИЕ\программирование обучение\web-dev\task-manager"
git add .
git commit -m "Fix: Railway deployment with Express serving static files"
git push
```

### 2. Проверь Railway переменные:

Зайди на Railway → Project → Variables:
```
DATABASE_URL=postgresql://... (из PostgreSQL)
JWT_SECRET=твой-секретный-ключ-32+символа
NODE_ENV=production
PORT=5000
```

### 3. Проверь Build настройки:

Railway → Project → Settings:
- **Build Command:** `npm install && npm run build`
- **Start Command:** `node backend/server.js`

Или используй `nixpacks.toml` (уже создан).

### 4. Дождись деплоя (~2-5 минут)

Railway автоматически пересоберёт проект.

### 5. Проверь:

```bash
# Health check
curl https://taskbat-git-production.up.railway.app/api/health

# Login
curl -X POST https://taskbat-git-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"example@gmail.com","password":"123"}'
```

---

## 📁 Что изменилось:

1. **railway.json** — конфигурация для Railway
2. **nixpacks.toml** — инструкция сборки
3. **server.js** — Express теперь отдаёт статику (frontend)
4. **API routes** — все на PostgreSQL

---

## ✅ Как это работает:

```
Railway Request
    ↓
Express Server (port 5000)
    ↓
┌─────────────────────────────────┐
│ /api/* → Backend Routes         │
│ /*     → React Static (dist/)   │
└─────────────────────────────────┘
```

Теперь **один сервер** (Express) обслуживает и API, и frontend!

---

## 🔐 Вход:

- Email: `example@gmail.com`
- Пароль: `123`

---

**После пуша Railway пересоберётся и всё заработает! 🚀**
