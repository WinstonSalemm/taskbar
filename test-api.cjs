const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function testAPI() {
  try {
    console.log("Testing API response format...");

    // Получаем фирмы
    const firmsResult = await pool.query("SELECT id, name FROM firms LIMIT 2");
    console.log("Firms:", firmsResult.rows);

    if (firmsResult.rows.length > 0) {
      const firm = firmsResult.rows[1]; // Берем вторую фирму
      console.log(`\nTesting tasks for firm ${firm.name} (ID: ${firm.id})...`);

      // Имитируем API запрос для задач фирмы
      const tasksResult = await pool.query(
        "SELECT * FROM tasks WHERE firm_id = $1 ORDER BY created_at DESC",
        [firm.id],
      );

      console.log("Raw tasks from DB:", tasksResult.rows.length, "tasks");
      tasksResult.rows.forEach((task) => {
        console.log(
          `  Task ${task.id}: status=${task.status}, type=${task.task_type}`,
        );
      });

      // Форматируем как API
      const formattedTasks = tasksResult.rows.map((task) => ({
        id: task.id,
        firmId: task.firm_id,
        taskType: task.task_type,
        taskData: task.task_data,
        status: task.status,
        createdAt: task.created_at,
      }));

      console.log("\nFormatted tasks (like API):");
      console.log(JSON.stringify(formattedTasks, null, 2));
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

testAPI();
