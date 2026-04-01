import { db, initDB, runQuery } from "../backend/db/sqlite.js";

// Скрипт для обновления структуры базы данных
// Использование: node scripts/migrate-db.js

async function migrateDB() {
  try {
    await initDB();
    console.log("✅ База данных инициализирована");

    // Обновляем тестовые задачи на новые типы
    console.log("\n🔄 Обновление типов задач...");

    // Заявка на оплату
    await runQuery(`
      UPDATE tasks 
      SET task_type = 'payment_request'
      WHERE task_type = 'payment'
    `);
    console.log("✅ payment → payment_request");

    // Счёт-фактура
    await runQuery(`
      UPDATE tasks 
      SET task_type = 'invoice'
      WHERE task_type = 'invoice'
    `);
    console.log("✅ invoice → invoice (без изменений)");

    // Прочее
    await runQuery(`
      UPDATE tasks 
      SET task_type = 'other'
      WHERE task_type = 'document' OR task_type = 'other'
    `);
    console.log("✅ document/other → other");

    console.log("\n🎉 Миграция завершена успешно!");

    db.close();
  } catch (err) {
    console.error("❌ Ошибка миграции:", err);
  }
}

migrateDB();
