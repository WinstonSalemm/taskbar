import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useChat } from "../context/ChatContext";
import TaskChat from "../components/TaskChat";
import { authAPI } from "../api";

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { chatTask, setChatTask } = useChat();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (e) {
      console.error(e);
    }
    logout();
    navigate("/login");
  };

  const isActive = (path) => {
    return location.pathname.startsWith(path);
  };

  return (
    <div className={`app-layout ${chatTask ? "with-chat" : ""}`}>
      <header className="header">
        <div className="header-left">
          <div className="header-user-avatar">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="header-user-info">
            <span className="header-user-name">{user?.name}</span>
            <span className="header-user-firm">
              {user?.firmName || user?.role}
            </span>
          </div>
        </div>

        <div className="header-right">
          <h1 className="header-title">
            Task <span>Manager</span>
          </h1>
          <button onClick={handleLogout} className="logout-btn">
            Выйти
          </button>
        </div>
      </header>

      <nav className="sidebar">
        <Link
          to="/"
          className={`nav-link ${isActive("/") && location.pathname === "/" ? "active" : ""}`}
        >
          📊 Дашборд
        </Link>

        {user?.role !== "admin" && (
          <Link
            to="/tasks"
            className={`nav-link ${isActive("/tasks") ? "active" : ""}`}
          >
            📝 Задачи
          </Link>
        )}

        {user?.role === "admin" && (
          <Link
            to="/employees"
            className={`nav-link ${isActive("/employees") ? "active" : ""}`}
          >
            👥 Фирмы
          </Link>
        )}

        <Link
          to="/files"
          className={`nav-link ${isActive("/files") ? "active" : ""}`}
        >
          📁 Файлы
        </Link>
      </nav>

      <main className="content">
        <Outlet />
      </main>

      {chatTask && (
        <TaskChat task={chatTask} onClose={() => setChatTask(null)} />
      )}
    </div>
  );
}
