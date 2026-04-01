# Task Manager - Multi

Современная SPA система управления задачами для фирм и сотрудников.

## 🚀 Стек технологий

### Frontend

- **React 18** + Vite ⚡
- **React Router v6** - навигация
- **Zustand** - state management (легче Redux)
- **Axios** - API запросы

### Backend

- **Node.js** + Express
- **SQLite** (локально) / **PostgreSQL** (production)
- **Multer** - загрузка файлов
- **JWT** - аутентификация
- **bcryptjs** - хеширование паролей

---

## 📦 Быстрый старт

### 1. Установка зависимостей

```bash
npm install
```

### 2. Создать тестовые данные

```bash
npm run seed
```

### 3. Запуск

```bash
# Frontend + Backend одновременно
npm run dev:all

# Или по отдельности:
npm run dev      # Frontend (порт 3000)
npm run server   # Backend (порт 5000)
```

### 4. Открыть в браузере

```
http://localhost:3000
```

### 🔐 Тестовые данные

- **Email:** `test@example.com`
- **Пароль:** `12345`

---

## 📁 Структура проекта

```
task-manager/
├── src/                        # Frontend (React)
│   ├── components/            # UI компоненты
│   │   ├── TaskList.jsx       # Список задач
│   │   ├── TaskList.css
│   │   └── ...
│   ├── pages/                 # Страницы
│   │   ├── Login.jsx          # Страница входа
│   │   ├── AdminDashboard.jsx # Дашборд админа
│   │   ├── FirmDashboard.jsx  # Дашборд фирмы
│   │   └── EmployeeDashboard.jsx # Дашборд сотрудника
│   ├── store/                 # Zustand store
│   │   ├── authStore.js       # Аутентификация
│   │   └── taskStore.js       # Задачи
│   ├── hooks/                 # Кастомные хуки
│   │   ├── useApi.js
│   │   └── index.js
│   ├── api/                   # API клиенты
│   │   └── index.js
│   ├── layouts/               # Layout компоненты
│   │   └── Layout.jsx
│   ├── App.jsx                # Главный компонент
│   ├── App.css                # Стили компонентов
│   ├── index.css              # Глобальные стили
│   └── main.jsx               # Точка входа React
│
├── backend/
│   ├── routes/                # API endpoints
│   │   ├── auth.js            # /api/auth (login, logout)
│   │   ├── firms.js           # /api/firms
│   │   ├── tasks.js           # /api/tasks
│   │   └── files.js           # /api/files
│   ├── db/
│   │   ├── sqlite.js          # SQLite (локально)
│   │   └── index.js           # PostgreSQL (production)
│   └── server.js              # Express сервер
│
├── scripts/
│   ├── seed-data.js           # Тестовые данные
│   └── import-data.js         # Импорт из CSV
│
├── data/                      # SQLite база (локально)
├── uploads/                   # Загруженные файлы
├── dist/                      # Production сборка
│
├── package.json
├── vite.config.js
├── .env
├── .env.example
├── .gitignore
└── README.md
```

---

## 🛠️ Доступные команды

| Команда           | Описание                    |
| ----------------- | --------------------------- |
| `npm install`     | Установить зависимости      |
| `npm run dev`     | Запустить frontend (Vite)   |
| `npm run server`  | Запустить backend (Express) |
| `npm run dev:all` | Запустить всё одновременно  |
| `npm run build`   | Production сборка           |
| `npm run preview` | Предпросмотр сборки         |
| `npm run seed`    | Создать тестовые данные     |

---

## 🔐 Роли пользователей

| Роль         | Описание                            |
| ------------ | ----------------------------------- |
| **Admin**    | Видит все фирмы, задачи, статистику |
| **Firm**     | Владелец фирмы, управляет задачами  |
| **Employee** | Сотрудник, выполняет задачи         |

---

## 📊 Оптимизация

### Что реализовано:

1. **Code Splitting** - Vite автоматически разбивает код на чанки:
   - `vendor.js` - React, React-DOM, React-Router
   - `api.js` - Axios
   - `store.js` - Zustand
   - `main.js` - основной код

2. **State Management** - Zustand вместо Context API:
   - Быстрее
   - Меньше бойлерплейта
   - Автоматическая персистентность

3. **Database Indexes** - индексы на:
   - `firm_id`
   - `employee_id`
   - `status`

4. **Lazy Loading** - компоненты загружаются по требованию

5. **Memoization** - мемоизация через `useMemo` и `useCallback`

### Bundle size после сборки:

```bash
npm run build
```

Проверить размер в папке `dist/`:

- `vendor-*.js` - ~150KB gzipped
- `index-*.js` - ~50KB gzipped

---

## 🔧 API Endpoints

### Auth

| Метод | Endpoint           | Описание               |
| ----- | ------------------ | ---------------------- |
| POST  | `/api/auth/login`  | Вход (email, password) |
| POST  | `/api/auth/logout` | Выход                  |

### Firms

| Метод | Endpoint                   | Описание         |
| ----- | -------------------------- | ---------------- |
| GET   | `/api/firms`               | Все фирмы        |
| GET   | `/api/firms/:id`           | Фирма по ID      |
| GET   | `/api/firms/:id/employees` | Сотрудники фирмы |

### Tasks

| Метод | Endpoint                          | Описание             |
| ----- | --------------------------------- | -------------------- |
| GET   | `/api/tasks/firm/:firmId`         | Задачи фирмы         |
| GET   | `/api/tasks/employee/:employeeId` | Задачи сотрудника    |
| GET   | `/api/tasks/:id`                  | Задача по ID         |
| POST  | `/api/tasks`                      | Создать задачу       |
| PUT   | `/api/tasks/:id`                  | Обновить задачу      |
| POST  | `/api/tasks/:id/comments`         | Добавить комментарий |

### Files

| Метод  | Endpoint                           | Описание       |
| ------ | ---------------------------------- | -------------- |
| POST   | `/api/tasks/:taskId/files`         | Загрузить файл |
| GET    | `/api/tasks/:taskId/files`         | Файлы задачи   |
| GET    | `/api/files/:fileId/download`      | Скачать файл   |
| DELETE | `/api/tasks/:taskId/files/:fileId` | Удалить файл   |

---

## 🚀 Деплой на Railway

### Шаг 1: Git

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/твой-username/task-manager.git
git push -u origin main
```

### Шаг 2: Railway

1. Зайти на [railway.app](https://railway.app)
2. **New Project** → **Deploy from GitHub**
3. Выбрать репозиторий

### Шаг 3: База данных

1. **New** → **Database** → **PostgreSQL**
2. Скопировать `DATABASE_URL`

### Шаг 4: Переменные окружения

| Variable       | Value                |
| -------------- | -------------------- |
| `DATABASE_URL` | из PostgreSQL        |
| `JWT_SECRET`   | любой секретный ключ |
| `NODE_ENV`     | `production`         |
| `PORT`         | `5000`               |

### Шаг 5: Готово!

Railway автоматически задеплоит проект.

---

## 📝 Миграция из Google Sheets

### 1. Экспорт из Google Sheets

- **File** → **Download** → **CSV** для каждого листа:
  - `Firms` → `firms.csv`
  - `Employees` → `employees.csv`
  - `Tasks` → `tasks.csv`

### 2. Поместить в папку `data/`

### 3. Запустить импорт

```bash
npm install csv-parse
node scripts/import-data.js
```

---

## 🎯 Design System

### Цветовая палитра

```css
--color-primary: #367d00 /* Основной зелёный */ --color-primary-dark: #265700
  /* Тёмный зелёный */ --color-success: #059669 /* Успех */
  --color-warning: #d97706 /* Предупреждение */ --color-danger: #dc2626
  /* Ошибка */;
```

### Типографика

- **Font:** Inter
- **Размеры:** 11px, 13px, 14px, 16px, 18px, 20px, 24px
- **Веса:** 400, 500, 600, 700

### Spacing (8px grid)

- `--space-1: 4px`
- `--space-2: 8px`
- `--space-3: 12px`
- `--space-4: 16px`
- `--space-5: 20px`
- `--space-6: 24px`

---

## 🐛 Troubleshooting

### Ошибка SQLite

```
Error: Unable to load binary
```

**Решение:** `npm rebuild sqlite3`

### Ошибка CORS

```
Access to fetch blocked by CORS
```

**Решение:** Проверь что backend и frontend на разных портах

### Ошибка JWT

```
secretOrPrivateKey must have a value
```

**Решение:** Добавь `JWT_SECRET` в `.env`

---

## 📞 Контакты

Вопросы? Пиши!

---

**Разработано для Railway deployment** 🚂  
**SPA + React + Express + SQLite/PostgreSQL**
