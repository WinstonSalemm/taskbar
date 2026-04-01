import { db, initDB, runQuery } from "../backend/db/sqlite.js";

// Скрипт для заполнения тестовыми данными
// Использование: node scripts/seed-data.js

async function seedData() {
  try {
    await initDB();
    console.log("✅ База данных инициализирована");

    // Создаём тестовую фирму
    await runQuery(`
      INSERT OR IGNORE INTO firms (id, name, email)
      VALUES ('firm_1', 'Тестовая фирма', 'test@example.com')
    `);
    console.log("✅ Фирма создана");

    // Создаём тестового сотрудника (пароль: 12345)
    await runQuery(`
      INSERT OR IGNORE INTO employees (id, firm_id, name, password)
      VALUES ('emp_1', 'firm_1', 'Иван Иванов', '12345')
    `);
    console.log("✅ Сотрудник создан");

    // Создаём тестовые задачи
    const tasks = [
      {
        firm_id: "firm_1",
        employee_id: "emp_1",
        task_type: "payment",
        task_data: JSON.stringify({
          description: "Тестовая выплата",
          amount: 10000,
        }),
        status: "new",
        progress: 0,
      },
      {
        firm_id: "firm_1",
        employee_id: "emp_1",
        task_type: "invoice",
        task_data: JSON.stringify({ description: "Счёт №123", amount: 25000 }),
        status: "in_progress",
        progress: 50,
      },
      {
        firm_id: "firm_1",
        employee_id: "emp_1",
        task_type: "document",
        task_data: JSON.stringify({ description: "Документы для проверки" }),
        status: "done",
        progress: 100,
      },
    ];

    for (const task of tasks) {
      await runQuery(
        `
        INSERT INTO tasks (firm_id, employee_id, task_type, task_data, status, progress, comments)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        [
          task.firm_id,
          task.employee_id,
          task.task_type,
          task.task_data,
          task.status,
          task.progress,
          "[]",
        ],
      );
    }
    console.log("✅ Задачи созданы");

    console.log("\n🎉 Тестовые данные готовы!");
    console.log("\n📝 Данные для входа:");
    console.log("   Email: test@example.com");
    console.log("   Пароль: 12345");

    db.close();
  } catch (err) {
    console.error("❌ Ошибка:", err);
  }
}

seedData();
