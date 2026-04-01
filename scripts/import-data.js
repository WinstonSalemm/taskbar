import { Client } from 'pg'
import { readFileSync } from 'fs'
import { parse } from 'csv-parse/sync'
import dotenv from 'dotenv'

dotenv.config()

// Скрипт для импорта данных из CSV в PostgreSQL
// Использование: node scripts/import-data.js

async function importData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  })

  try {
    await client.connect()
    console.log('✅ Подключено к базе данных')

    // Импорт фирм
    console.log('📦 Импорт фирм...')
    const firmsData = readFileSync('data/firms.csv', 'utf-8')
    const firms = parse(firmsData, { columns: true, skip_empty_lines: true })
    
    for (const firm of firms) {
      await client.query(
        `INSERT INTO firms (id, name, email)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [firm.id, firm.name, firm.email]
      )
    }
    console.log(`✅ Импортировано ${firms.length} фирм`)

    // Импорт сотрудников
    console.log('👥 Импорт сотрудников...')
    const employeesData = readFileSync('data/employees.csv', 'utf-8')
    const employees = parse(employeesData, { columns: true, skip_empty_lines: true })
    
    for (const emp of employees) {
      await client.query(
        `INSERT INTO employees (id, firm_id, name, password)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [emp.id, emp.firm_id, emp.name, emp.password]
      )
    }
    console.log(`✅ Импортировано ${employees.length} сотрудников`)

    // Импорт задач
    console.log('📝 Импорт задач...')
    const tasksData = readFileSync('data/tasks.csv', 'utf-8')
    const tasks = parse(tasksData, { columns: true, skip_empty_lines: true })
    
    for (const task of tasks) {
      await client.query(
        `INSERT INTO tasks (id, firm_id, employee_id, task_type, task_data, status, created_at, progress, comments)
         VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          task.id,
          task.firm_id,
          task.employee_id,
          task.task_type,
          task.task_data || '{}',
          task.status || 'new',
          task.created_at,
          task.progress || 0,
          task.comments || '[]'
        ]
      )
    }
    console.log(`✅ Импортировано ${tasks.length} задач`)

    console.log('\n🎉 Импорт завершён успешно!')
  } catch (err) {
    console.error('❌ Ошибка импорта:', err)
  } finally {
    await client.end()
  }
}

importData()
