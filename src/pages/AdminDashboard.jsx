import { useEffect } from 'react'
import { useApi } from '../hooks/useApi'
import { firmsAPI } from '../api'
import { useTaskStore } from '../store/taskStore'
import { Link } from 'react-router-dom'

export default function AdminDashboard() {
  const { data: firms, loading, execute } = useApi(firmsAPI.getAll)
  const { tasks } = useTaskStore()

  useEffect(() => {
    execute()
  }, [])

  if (loading) {
    return <div className="loading">Загрузка...</div>
  }

  return (
    <div className="dashboard">
      <div className="section-header">
        <h2 className="section-title">Все фирмы</h2>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{firms?.length || 0}</div>
          <div className="stat-label">Фирм</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{tasks.length}</div>
          <div className="stat-label">Задач всего</div>
        </div>
      </div>

      <div className="firms-list">
        {firms?.map((firm) => (
          <Link 
            to={`/firms/${firm.id}`} 
            key={firm.id} 
            className="firm-card"
          >
            <div className="firm-header">
              <h3>{firm.name}</h3>
              <span className="firm-email">{firm.email}</span>
            </div>
            <div className="firm-stats">
              <div className="firm-stat">
                <span className="stat-label">Задач</span>
                <span className="stat-value">{firm.taskCount}</span>
              </div>
              <div className="firm-stat">
                <span className="stat-label">Новых</span>
                <span className="stat-value new">{firm.newTaskCount}</span>
              </div>
              <div className="firm-stat">
                <span className="stat-label">Сотрудников</span>
                <span className="stat-value">{firm.employeeCount}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
