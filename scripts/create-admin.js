import { query, initDB } from "../backend/db/index.js";

// Скрипт для создания тестового админа
// Использование: node scripts/create-admin.js

async function createAdmin() {
  try {
    await initDB();
    console.log("✅ База данных инициализирована");

    // Создаём тестового админа (пароль: admin123)
    await query(
      `INSERT INTO admins (id, name, email, password)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      ["admin_1", "Администратор", "admin@taskmanager.ru", "admin123"],
    );
    console.log("✅ Админ создан");

    console.log("\n🎉 Администратор готов!");
    console.log("\n📝 Данные для входа:");
    console.log("   Email: admin@taskmanager.ru");
    console.log("   Пароль: admin123");

    process.exit(0);
  } catch (err) {
    console.error("❌ Ошибка:", err);
    process.exit(1);
  }
}

createAdmin();
