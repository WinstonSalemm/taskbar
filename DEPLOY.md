# 🚀 ДЕПЛОЙ НА RAILWAY

## ⚠️ ВАЖНО: Безопасность

Ты только что показал пароль от базы в чате! **Срочно смени его!**

1. Зайди на [Railway](https://railway.app)
2. Project → PostgreSQL → Settings → Reset Password
3. Обновить `.env` с новым паролем

---

## 📦 Шаг 1: Git репозиторий

```bash
cd task-manager

# Инициализация
git init
git add .
git commit -m "Initial commit: Task Manager React + Express + PostgreSQL"

# Создать репо на GitHub и запушить
git remote add origin https://github.com/ТВОЙ-USERNAME/task-manager.git
git push -u origin main
```

---

## 🚂 Шаг 2: Деплой на Railway

### 2.1. Создать проект

1. Зайти на [railway.app](https://railway.app)
2. Войти через GitHub
3. **New Project** → **Deploy from GitHub repo**
4. Выбрать репозиторий `task-manager`

### 2.2. Добавить PostgreSQL

1. В проекте: **New** → **Database** → **PostgreSQL**
2. Дождаться создания (~30 сек)
3. Нажать на PostgreSQL → **Variables**
4. **Скопировать** `DATABASE_URL`

### 2.3. Настроить переменные окружения

В Railway в твоём сервисе добавить:

```
DATABASE_URL=postgresql://postgres:... (из PostgreSQL)
JWT_SECRET=твой-секретный-ключ-минимум-32-символа
NODE_ENV=production
PORT=5000
```

### 2.4. Настроить Build

В Railway в настройках сервиса:

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
npm run server
```

---

## 🌐 Шаг 3: Настроить CORS

Обнови `backend/server.js` для production CORS:

```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}))
```

---

## 📁 Шаг 4: Файлы (опционально)

Для загрузки файлов нужно настроить volumes в Railway:

1. В проекте Railway: **New** → **Volume**
2. Путь: `/app/uploads`
3. Размер: 1GB

Или используй S3 (AWS, Cloudflare R2).

---

## 🔧 Шаг 5: Миграция БД

Создай SQL файл для инициализации таблицы:

**Файл:** `scripts/init-db.sql`

```sql
CREATE TABLE IF NOT EXISTS firms (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
  id VARCHAR(50) PRIMARY KEY,
  firm_id VARCHAR(50) REFERENCES firms(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  firm_id VARCHAR(50) REFERENCES firms(id) ON DELETE CASCADE,
  employee_id VARCHAR(50) REFERENCES employees(id) ON DELETE SET NULL,
  task_type VARCHAR(50) DEFAULT 'other',
  task_data JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'new',
  created_at DATE DEFAULT CURRENT_DATE,
  progress INTEGER DEFAULT 0,
  comments JSONB DEFAULT '[]',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attachments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_id VARCHAR(255),
  file_url TEXT,
  uploaded_by VARCHAR(255),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_firm_id ON tasks(firm_id);
CREATE INDEX IF NOT EXISTS idx_tasks_employee_id ON tasks(employee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_employees_firm_id ON employees(firm_id);
CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON attachments(task_id);
```

Запусти SQL через Railway:
- PostgreSQL → **Connect** → **psql**
- Вставь SQL и выполни

---

## 🎯 Шаг 6: Проверка

### 6.1. Backend

Открой `https://твой-домен.railway.app/api/health`

Должно вернуться:
```json
{"status":"ok","timestamp":"..."}
```

### 6.2. Frontend

Открой `https://твой-домен.railway.app`

Войди с тестовыми данными:
- Email: `example@gmail.com`
- Пароль: `123`

---

## 🐛 Troubleshooting

### Ошибка: "Cannot find module '../db/index.js'"

**Решение:** Проверь пути импортов в роутах

### Ошибка: "Database is not initialized"

**Решение:** Выполни SQL скрипт инициализации

### Ошибка: "CORS policy"

**Решение:** Добавь FRONTEND_URL в CORS настройки

### Ошибка: "JWT_SECRET must have a value"

**Решение:** Добавь переменную в Railway

---

## 📊 Импорт данных из Google Sheets

1. Скачай CSV из Google Sheets
2. Загрузи в Railway через CLI:
   ```bash
   railway run node scripts/import-data.js
   ```

Или локально:
```bash
DATABASE_URL=postgresql://... npm run import
```

---

## 🔐 Смена пароля БД (СРОЧНО!)

1. Railway → PostgreSQL → Settings
2. **Reset Password**
3. Скопировать новый `DATABASE_URL`
4. Обновить в `.env` и Railway Variables

---

## ✅ Чеклист

- [ ] Git репозиторий создан
- [ ] Railway проект создан
- [ ] PostgreSQL добавлен
- [ ] Переменные окружения настроены
- [ ] Build/Start команды настроены
- [ ] SQL таблицы созданы
- [ ] CORS настроен
- [ ] **Пароль БД сменён**
- [ ] Health check работает
- [ ] Frontend открывается
- [ ] Вход работает

---

**Готово! 🚀**

Твой домен: `https://твой-проект.railway.app`
