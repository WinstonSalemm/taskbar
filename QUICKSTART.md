# 🚀 БЫСТРЫЙ СТАРТ

## Установка и запуск (локально)

### 1. Установка зависимостей
```bash
npm install
```

### 2. Запуск
```bash
# Frontend + Backend одновременно
npm run dev:all

# Или по отдельности:
npm run dev      # Только frontend (порт 3000)
npm run server   # Только backend (порт 5000)
```

### 3. Открыть в браузере
```
http://localhost:3000
```

---

## 📦 Деплой на Railway

### Шаг 1: Создать Git репозиторий

```bash
# В папке task-manager
git init
git add .
git commit -m "Initial commit: Task Manager React + Express"

# Создать репо на GitHub и запушить
git remote add origin https://github.com/твой-username/task-manager.git
git push -u origin main
```

### Шаг 2: Подключить Railway

1. Зайти на [railway.app](https://railway.app)
2. Войти через GitHub
3. **New Project** → **Deploy from GitHub repo**
4. Выбрать репозиторий `task-manager`

### Шаг 3: Добавить базу данных

1. В проекте Railway: **New** → **Database** → **PostgreSQL**
2. Дождаться создания БД
3. Нажать на PostgreSQL → **Variables**
4. Скопировать значение `DATABASE_URL`

### Шаг 4: Настроить переменные окружения

В Railway в твоём сервисе добавить:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | (скопировать из PostgreSQL) |
| `JWT_SECRET` | любой секретный ключ (мин. 32 символа) |
| `NODE_ENV` | `production` |
| `PORT` | `5000` |

### Шаг 5: Деплой готов!

Railway автоматически задеплоит проект.

---

## 📊 Миграция данных из Google Sheets

### 1. Экспорт данных из Google Sheets

1. Открыть Google Sheet
2. **File** → **Download** → **CSV** для каждого листа:
   - `Firms` → `firms.csv`
   - `Employees` → `employees.csv`
   - `Tasks` → `tasks.csv`

### 2. Подготовить CSV файлы

Создать папку `data/` в корне проекта и поместить туда CSV файлы.

### 3. Запустить скрипт импорта

```bash
# Установить дополнительную зависимость
npm install csv-parse

# Запустить импорт
node scripts/import-data.js
```

---

## 🔧 Структура проекта

```
task-manager/
├── src/                    # Frontend (React)
│   ├── components/        # UI компоненты
│   │   ├── TaskList.jsx   # Список задач
│   │   └── TaskList.css
│   ├── pages/             # Страницы
│   │   ├── Login.jsx
│   │   ├── AdminDashboard.jsx
│   │   ├── FirmDashboard.jsx
│   │   └── EmployeeDashboard.jsx
│   ├── store/             # Zustand store
│   │   ├── authStore.js   # Аутентификация
│   │   └── taskStore.js   # Задачи
│   ├── hooks/             # Кастомные хуки
│   │   ├── useApi.js
│   │   └── index.js
│   ├── api/               # API клиенты
│   │   └── index.js
│   ├── layouts/           # Layout компоненты
│   │   └── Layout.jsx
│   ├── App.jsx            # Главный компонент
│   ├── App.css            # Стили компонентов
│   ├── index.css          # Глобальные стили
│   └── main.jsx           # Точка входа React
├── backend/
│   ├── routes/            # API endpoints
│   │   ├── auth.js        # /api/auth
│   │   ├── firms.js       # /api/firms
│   │   ├── tasks.js       # /api/tasks
│   │   └── files.js       # /api/files
│   ├── db/
│   │   └── index.js       # PostgreSQL подключение
│   └── server.js          # Express сервер
├── scripts/
│   └── import-data.js     # Скрипт импорта из CSV
├── uploads/               # Загруженные файлы
├── package.json
├── vite.config.js
└── README.md
```

---

## 🎯 Оптимизация

### Что уже сделано:

1. **Code Splitting** - Vite автоматически разбивает код на чанки
2. **Lazy Loading** - компоненты загружаются по требованию
3. **State Management** - Zustand (быстрее Redux)
4. **API кэширование** - можно добавить React Query
5. **Database Indexes** - индексы на `firm_id`, `employee_id`, `status`
6. **Memoization** - мемоизация через `useMemo` и `useCallback`

### Bundle size после сборки:
```bash
npm run build
```

Проверить размер в папке `dist/`:
- `vendor-*.js` - React, React-DOM (~150KB gzipped)
- `index-*.js` - основной код (~50KB gzipped)

---

## 🔐 Тестовые данные

Для тестирования можно создать фирму и сотрудника через SQL:

```sql
-- Создать фирму
INSERT INTO firms (id, name, email) 
VALUES ('firm_1', 'Тестовая фирма', 'test@example.com');

-- Создать сотрудника (пароль: 12345)
INSERT INTO employees (id, firm_id, name, password) 
VALUES ('emp_1', 'firm_1', 'Иван Иванов', '12345');
```

Войти можно с email: `test@example.com` и паролем: `12345`

---

## 🐛 Troubleshooting

### Ошибка подключения к БД
```
Error: connect ECONNREFUSED
```
**Решение:** Проверь `DATABASE_URL` в `.env`

### Ошибка CORS
```
Access to fetch at '...' has been blocked by CORS policy
```
**Решение:** Проверь, что backend и frontend на разных портах и CORS настроен

### Ошибка JWT
```
JsonWebTokenError: secretOrPrivateKey must have a value
```
**Решение:** Добавь `JWT_SECRET` в `.env`

---

## 📞 Контакты

Вопросы? Пиши!
