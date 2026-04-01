import { initDB, runQuery } from "../backend/db/sqlite.js";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Скрипт для импорта данных из Google Sheets CSV
// Использование: node scripts/import-data.js

async function importData() {
  try {
    await initDB();
    console.log("✅ База данных инициализирована");

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
        // Пропускаем заголовок
        if (firm.test === "test" || firm.id === "id") continue;

        const id = firm.test || firm.id;
        await runQuery(
          `
          INSERT OR REPLACE INTO firms (id, name, email)
          VALUES (?, ?, ?)
        `,
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
        // Пропускаем заголовок
        if (emp.id === "id" || emp.test === "test") continue;

        await runQuery(
          `
          INSERT OR REPLACE INTO employees (id, firm_id, name, password)
          VALUES (?, ?, ?, ?)
        `,
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
        // Пропускаем заголовок
        if (task.id === "id" || task.test === "test") continue;

        await runQuery(
          `
          INSERT OR REPLACE INTO tasks 
          (id, firm_id, employee_id, task_type, task_data, status, created_at, progress, comments)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
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
        // Пропускаем заголовок
        if (att.id === "id" || att.test === "test") continue;

        await runQuery(
          `
          INSERT OR REPLACE INTO attachments 
          (id, task_id, file_name, file_id, file_url, uploaded_by, uploaded_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
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

    console.log("\n🎉 Импорт завершён успешно!");
    console.log("\n🔐 Данные для входа:");
    console.log("   Email: example@gmail.com");
    console.log("   Пароль: 123 (или любой из Employees.csv)");
  } catch (err) {
    console.error("❌ Ошибка импорта:", err);
  }
}

importData();
