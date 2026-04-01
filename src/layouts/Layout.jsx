import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { authAPI } from '../api'

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    try {
      await authAPI.logout()
    } catch (e) {
      console.error(e)
    }
    logout()
    navigate('/login')
  }

  const isActive = (path) => {
    return location.pathname.startsWith(path)
  }

  return (
    <div className="app-layout">
      <header className="header">
        <div className="header-brand">
          <div className="header-logo">📋</div>
          <h1>Task <span>Manager</span></h1>
        </div>

        <div className="user-info">
          <div className="avatar">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="user-details">
            <span className="user-name">{user?.name}</span>
            <span className="user-firm">{user?.firmName || user?.role}</span>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            Выйти
          </button>
        </div>
      </header>

      <nav className="sidebar">
        <Link 
          to="/" 
          className={`nav-link ${isActive('/') && location.pathname === '/' ? 'active' : ''}`}
        >
          📊 Дашборд
        </Link>
        
        <Link 
          to="/tasks" 
          className={`nav-link ${isActive('/tasks') ? 'active' : ''}`}
        >
          📝 Задачи
        </Link>

        {user?.role === 'admin' && (
          <Link 
            to="/employees" 
            className={`nav-link ${isActive('/employees') ? 'active' : ''}`}
          >
            👥 Сотрудники
          </Link>
        )}

        <Link 
          to="/files" 
          className={`nav-link ${isActive('/files') ? 'active' : ''}`}
        >
          📁 Файлы
        </Link>
      </nav>

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
