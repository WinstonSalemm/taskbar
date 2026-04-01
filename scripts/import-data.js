import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:xrtOLOgzjvXtkEDhmTNIefeIOlBFzOVs@metro.proxy.rlwy.net:43772/railway",
  ssl: { rejectUnauthorized: false },
});

import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Скрипт для импорта данных из Google Sheets CSV в Railway PostgreSQL
// Использование: npm run import

async function importData() {
  try {
    // Инициализация БД
    const schema = `
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
    `;

    await pool.query(schema);
    console.log("✅ PostgreSQL (Railway) инициализирован");

    const dataDir = __dirname;

    // === ИМПОРТ ФИРМ ===
    console.log("\n📦 Импорт фирм...");
    try {
      const firmsFile = path.join(dataDir, "task manager - Firms.csv");
      const firmsData = readFileSync(firmsFile, "utf-8");
      const firms = parse(firmsData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      let firmCount = 0;
      for (const firm of firms) {
        if (firm.test === "test" || firm.id === "id") continue;

        const id = firm.test || firm.id;
        await pool.query(
          "INSERT INTO firms (id, name, email) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
          [id, firm.name, firm.email],
        );
        firmCount++;
      }
      console.log(`✅ Импортировано ${firmCount} фирм`);
    } catch (err) {
      console.log("⚠️  Файл Firms.csv не найден:", err.message);
    }

    // === ИМПОРТ СОТРУДНИКОВ ===
    console.log("\n👥 Импорт сотрудников...");
    try {
      const employeesFile = path.join(dataDir, "task manager - Employees.csv");
      const employeesData = readFileSync(employeesFile, "utf-8");
      const employees = parse(employeesData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      let empCount = 0;
      for (const emp of employees) {
        if (emp.id === "id" || emp.test === "test") continue;

        await pool.query(
          "INSERT INTO employees (id, firm_id, name, password) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING",
          [emp.id, emp.firm_id, emp.name, emp.password],
        );
        empCount++;
      }
      console.log(`✅ Импортировано ${empCount} сотрудников`);
    } catch (err) {
      console.log("⚠️  Файл Employees.csv не найден:", err.message);
    }

    // === ИМПОРТ ЗАДАЧ ===
    console.log("\n📝 Импорт задач...");
    try {
      const tasksFile = path.join(dataDir, "task manager - Tasks.csv");
      const tasksData = readFileSync(tasksFile, "utf-8");
      const tasks = parse(tasksData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      let taskCount = 0;
      for (const task of tasks) {
        if (task.id === "id" || task.test === "test") continue;

        await pool.query(
          `
          INSERT INTO tasks 
          (id, firm_id, employee_id, task_type, task_data, status, created_at, progress, comments)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO NOTHING`,
          [
            task.id,
            task.firm_id,
            task.employee_id,
            task.task_type || "other",
            task.task_data || "{}",
            task.status || "new",
            task.created_at || new Date().toISOString().split("T")[0],
            parseInt(task.progress) || 0,
            task.comments || "[]",
          ],
        );
        taskCount++;
      }
      console.log(`✅ Импортировано ${taskCount} задач`);
    } catch (err) {
      console.log("⚠️  Файл Tasks.csv не найден:", err.message);
    }

    // === ИМПОРТ ФАЙЛОВ (Attachments) ===
    console.log("\n📁 Импорт файлов...");
    try {
      const attachmentsFile = path.join(
        dataDir,
        "task manager - Attachments.csv",
      );
      const attachmentsData = readFileSync(attachmentsFile, "utf-8");
      const attachments = parse(attachmentsData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      let attCount = 0;
      for (const att of attachments) {
        if (att.id === "id" || att.test === "test") continue;

        await pool.query(
          `
          INSERT INTO attachments 
          (id, task_id, file_name, file_id, file_url, uploaded_by, uploaded_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO NOTHING`,
          [
            att.id,
            att.task_id,
            att.file_name,
            att.file_id,
            att.file_url,
            att.uploaded_by,
            att.uploaded_at,
          ],
        );
        attCount++;
      }
      console.log(`✅ Импортировано ${attCount} файлов`);
    } catch (err) {
      console.log("⚠️  Файл Attachments.csv не найден:", err.message);
    }

    console.log("\n🎉 Импорт в Railway PostgreSQL завершён успешно!");
    console.log("\n🔐 Данные для входа:");
    console.log("   Email: example@gmail.com");
    console.log("   Пароль: 123 (или любой из Employees.csv)");

    pool.end();
  } catch (err) {
    console.error("❌ Ошибка импорта:", err);
    pool.end();
  }
}

importData();
