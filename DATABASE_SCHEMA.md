# 📊 СТРУКТУРА БАЗЫ ДАННЫХ (обновлённая)

## Таблица `tasks`

```sql
CREATE TABLE tasks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id       VARCHAR(50) REFERENCES firms(id),
  employee_id   VARCHAR(50) REFERENCES employees(id),
  task_type     VARCHAR(50) DEFAULT 'other',  -- payment_request | invoice | other
  task_data     JSONB DEFAULT '{}',           -- Структура зависит от task_type
  status        VARCHAR(50) DEFAULT 'new',    -- new | in_progress | done | review
  created_at    DATE DEFAULT CURRENT_DATE,
  progress      INTEGER DEFAULT 0,
  comments      JSONB DEFAULT '[]',
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 📋 Типы задач и структура `task_data`

### 1. **Заявка на оплату** (`payment_request`)

```json
{
  "date": "2026-04-02",           // Дата создания (автоматически, сегодня)
  "description": "Описание",       // Текст, суть заявки
  "amount": 10000                 // Сумма (число)
}
```

**Поля формы:**
- `date` — дата (автоматически, нельзя изменить)
- `description` — описание (textarea)
- `amount` — сумма (number, только число)
- `file` — документ основания (PDF/скриншот, обязательно)

---

### 2. **Счёт-фактура** (`invoice`)

```json
{
  "date": "2026-04-02",           // Дата создания (автоматически, сегодня)
  "inn": "123456789012",          // ИНН контрагента (только цифры, 10-12 знаков)
  "subject": "Товар/услуга",      // Предмет счёта
  "price": 1000,                  // Цена за единицу (число)
  "quantity": 5,                  // Количество (целое число)
  "total": 5000                   // Итоговая сумма (price * quantity, автоматически)
}
```

**Поля формы:**
- `date` — дата (автоматически, нельзя изменить)
- `inn` — ИНН контрагента (text, только цифры)
- `subject` — предмет (text)
- `price` — цена (number)
- `quantity` — кол-во (number, целое)
- `total` — сумма (автоматически, нельзя изменить)
- `file` — документ основания (PDF/скриншот, обязательно)

---

### 3. **Прочее** (`other`)

```json
{
  "date": "2026-04-02",           // Дата создания (автоматически, сегодня)
  "essence": "Суть задачи",       // Основная суть
  "aspects": "Затронутые аспекты", // Какие аспекты затрагивает
  "notes": "Примечания"           // Дополнительные примечания
}
```

**Поля формы:**
- `date` — дата (автоматически, нельзя изменить)
- `essence` — суть (textarea, обязательно)
- `aspects` — затронутые аспекты (textarea)
- `notes` — примечания (textarea)
- `file` — файл (PDF/скриншот, опционально)

---

## 🎨 Дизайн форм в стиле Excel

Формы выполнены в виде таблицы с разделением на ячейки:

```
┌─────────────────────┬─────────────────────────────┐
│ Дата                │ 2026-04-02 (read-only)      │
├─────────────────────┼─────────────────────────────┤
│ Документ основания  │ [📎 Прикрепить PDF]         │
│                     │ [📸 Скриншот] [🖥️ Экран]    │
├─────────────────────┼─────────────────────────────┤
│ Описание            │ [textarea...]               │
├─────────────────────┼─────────────────────────────┤
│ Сумма               │ [0.00]                      │
└─────────────────────┴─────────────────────────────┘
```

**Стили:**
- Левая колонка (label) — серый фон, uppercase, bold
- Правая колонка (value) — input/textarea
- Границы — тонкие линии как в Excel
- Read-only поля — серый фон, курсор not-allowed

---

## 📁 Прикреплённые файлы

Файлы хранятся в таблице `attachments`:

```sql
CREATE TABLE attachments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id      INTEGER REFERENCES tasks(id),
  file_name    VARCHAR(255),
  file_id      VARCHAR(255),      -- Имя файла на диске
  file_url     TEXT,              -- Путь к файлу
  uploaded_by  VARCHAR(255),
  uploaded_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Типы файлов:**
- `.pdf` — документы
- `.png`, `.jpg`, `.jpeg` — скриншоты/изображения

**Загрузка:**
1. Через input (кнопка "📎 Прикрепить файл")
2. Через буфер обмена (Ctrl+V в режиме скриншота)
3. Через MediaDevices API (кнопка "🖥️ Экран")

---

## 🔄 Миграция данных

Для обновления типов задач в существующей БД:

```bash
npm run migrate
```

**Что делает:**
- `payment` → `payment_request`
- `invoice` → `invoice` (без изменений)
- `document`, `other` → `other`

---

## 🚀 API Endpoints (обновлённые)

### Создание задачи
```
POST /api/tasks
Body: {
  "firmId": "firm_1",
  "employeeId": "emp_1",
  "taskType": "payment_request",  // payment_request | invoice | other
  "taskData": {                   // Структура зависит от taskType
    "date": "2026-04-02",
    "description": "...",
    "amount": 10000
  }
}
```

### Обновление задачи
```
PUT /api/tasks/:id
Body: {
  "taskData": {...},
  "status": "in_progress",
  "progress": 50
}
```

### Загрузка файла
```
POST /api/tasks/:taskId/files
Content-Type: multipart/form-data
FormData: {
  "file": File,
  "uploadedBy": "Имя сотрудника"
}
```

---

## ✅ Валидация

### Заявка на оплату
- `date` — автоматически, сегодня
- `description` — обязательно, текст
- `amount` — обязательно, число > 0
- `file` — обязательно (PDF или изображение)

### Счёт-фактура
- `date` — автоматически, сегодня
- `inn` — обязательно, только цифры (10-12)
- `subject` — обязательно, текст
- `price` — обязательно, число > 0
- `quantity` — обязательно, целое > 0
- `total` — автоматически (price * quantity)
- `file` — обязательно (PDF или изображение)

### Прочее
- `date` — автоматически, сегодня
- `essence` — обязательно, текст
- `aspects` — опционально, текст
- `notes` — опционально, текст
- `file` — опционально (PDF или изображение)

---

**Всё готово! 🚀**
