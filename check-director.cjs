const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkDirector() {
  try {
    console.log("Checking director role...");

    // Проверяем все роли в базе
    const rolesResult = await pool.query("SELECT DISTINCT role FROM employees");
    console.log("Available roles:", rolesResult.rows);

    // Проверяем пользователя с ID 2
    const userResult = await pool.query(
      "SELECT id, name, role FROM employees WHERE id = $1",
      ["2"],
    );
    if (userResult.rows.length > 0) {
      console.log("User ID 2:", userResult.rows[0]);
    } else {
      console.log("User ID 2 not found");
    }

    // Проверяем всех пользователей
    const allUsersResult = await pool.query(
      "SELECT id, name, role FROM employees ORDER BY id",
    );
    console.log("All users:");
    allUsersResult.rows.forEach((user) => {
      console.log(`  ID: ${user.id}, Name: ${user.name}, Role: ${user.role}`);
    });
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

checkDirector();
