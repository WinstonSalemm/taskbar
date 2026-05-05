const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkTasks() {
  try {
    console.log('Checking tasks with review status...');
    const result = await pool.query('SELECT id, status, title FROM tasks WHERE status = $1', ['review']);
    console.log('Tasks with review status:', result.rows);
    
    console.log('\nAll tasks:');
    const allTasks = await pool.query('SELECT id, status, title FROM tasks');
    console.log(allTasks.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkTasks();
