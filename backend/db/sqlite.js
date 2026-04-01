import sqlite3 from 'sqlite3'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.join(__dirname, '../../data/taskmanager.db')

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ SQLite connection error:', err)
  } else {
    console.log('✅ SQLite connected:', dbPath)
  }
})

const initDB = () => {
  return new Promise((resolve, reject) => {
    const schema = `
      CREATE TABLE IF NOT EXISTS firms (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS employees (
        id VARCHAR(50) PRIMARY KEY,
        firm_id VARCHAR(50) REFERENCES firms(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firm_id VARCHAR(50) REFERENCES firms(id) ON DELETE CASCADE,
        employee_id VARCHAR(50) REFERENCES employees(id) ON DELETE SET NULL,
        task_type VARCHAR(50) DEFAULT 'other',
        task_data TEXT DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'new',
        created_at DATE DEFAULT CURRENT_DATE,
        progress INTEGER DEFAULT 0,
        comments TEXT DEFAULT '[]',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_id VARCHAR(255),
        file_url TEXT,
        uploaded_by VARCHAR(255),
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_firm_id ON tasks(firm_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_employee_id ON tasks(employee_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_employees_firm_id ON employees(firm_id);
      CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON attachments(task_id);
    `

    db.exec(schema, (err) => {
      if (err) {
        reject(err)
      } else {
        console.log('✅ Database schema initialized')
        resolve()
      }
    })
  })
}

const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err)
      } else {
        resolve({ rows })
      }
    })
  })
}

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err)
      } else {
        resolve({ lastID: this.lastID, changes: this.changes })
      }
    })
  })
}

export { db, initDB, query, runQuery }
export default db
