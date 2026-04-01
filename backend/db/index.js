import pkg from "pg";
const { Pool } = pkg;

// Всегда используем PostgreSQL с SSL (для Railway)
console.log("🔮 Connecting to PostgreSQL (Railway) with SSL...");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on("connect", () => {
  console.log("✅ PostgreSQL (Railway) connected with SSL");
});

pool.on("error", (err) => {
  console.error("❌ Unexpected database error:", err);
  console.error(
    "Connection string:",
    process.env.DATABASE_URL ? "exists" : "NOT FOUND",
  );
  process.exit(-1);
});

export const query = async (text, params) => {
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (err) {
    console.error("❌ Database query error:", err.message);
    throw err;
  }
};

export const runQuery = async (text, params) => {
  try {
    const result = await pool.query(text, params);
    return { lastID: result.rows[0]?.id, changes: result.rowCount };
  } catch (err) {
    console.error("❌ Database runQuery error:", err.message);
    throw err;
  }
};

export const initDB = async () => {
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
    CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(task_type);
    CREATE INDEX IF NOT EXISTS idx_employees_firm_id ON employees(firm_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON attachments(task_id);
  `;

  try {
    await query(schema);
    console.log("✅ Database schema initialized (Railway PostgreSQL)");
  } catch (err) {
    console.error("❌ Database initialization error:", err.message);
    throw err;
  }
};

export default pool;
