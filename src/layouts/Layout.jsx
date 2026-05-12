import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useChat } from "../context/ChatContext";
import { useTheme } from "../context/ThemeContext";
import TaskChat from "../components/TaskChat";
import TaskDetail from "../components/TaskDetail";
import NotificationsPanel from "../components/NotificationsPanel";
import { authAPI, notificationsAPI } from "../api";
import { useState, useEffect, useRef, useCallback } from "react";

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { chatTask, setChatTask } = useChat();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatPanelWidth, setChatPanelWidth] = useState(50); // Процент ширины для чата
  const [isResizing, setIsResizing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (user?.id) {
      fetchUnreadCount();
    }
  }, [user?.id]);

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationsAPI.getUnreadCount(user.id);
      setUnreadCount(response.data.unread);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handleMouseMove = useCallback(
    (e) => {
      if (!isResizing || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const mouseX = e.clientX - containerRect.left;

      // Вычисляем процент ширины для чата (минимум 30%, максимум 70%)
      let newWidth = (mouseX / containerWidth) * 100;
      newWidth = Math.max(30, Math.min(70, newWidth));

      setChatPanelWidth(newWidth);
    },
    [isResizing],
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

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
            <span className="header-user-role">
              {user?.role === "director"
                ? "👤‍🎨 Директор"
                : user?.role === "admin"
                  ? "🛡️ Админ"
                  : "👤 Сотрудник"}
            </span>
            <span className="header-user-firm">{user?.firmName}</span>
          </div>
        </div>

        <div className="header-right">
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            ☰
          </button>
          <h1 className="header-title">
            Task <span>Manager</span>
          </h1>
          <div className="header-actions">
            <button
              onClick={() => setShowNotifications(true)}
              className="notification-btn"
              style={{ marginRight: "var(--space-2)" }}
            >
              🔔
              {unreadCount > 0 && (
                <span className="notification-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={toggleTheme}
              className="logout-btn"
              style={{ marginRight: "var(--space-2)" }}
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>
            <button onClick={handleLogout} className="logout-btn">
              Выйти
            </button>
          </div>
        </div>
      </header>

      <nav className={`sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div
          className="mobile-menu-overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
        <div className="sidebar-content">
          <Link
            to="/"
            className={`nav-link ${isActive("/") && location.pathname === "/" ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            📊 Дашборд
          </Link>

          {user?.role !== "admin" && (
            <Link
              to="/tasks"
              className={`nav-link ${isActive("/tasks") ? "active" : ""}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              📝 Создать задачу
            </Link>
          )}

          {(user?.role === "admin" || user?.role === "director") && (
            <Link
              to="/employees"
              className={`nav-link ${isActive("/employees") ? "active" : ""}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              👥 Фирмы
            </Link>
          )}

          {(user?.role === "admin" ||
            user?.role === "director" ||
            user?.role === "firm") && (
            <Link
              to="/financial"
              className={`nav-link ${isActive("/financial") ? "active" : ""}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              💰 Финансы
            </Link>
          )}

          <Link
            to="/files"
            className={`nav-link ${isActive("/files") ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            📁 Файлы
          </Link>
        </div>
      </nav>

      <main className="content">
        <Outlet />
      </main>

      {chatTask && (
        <div className="split-screen-container" ref={containerRef}>
          <div
            className="task-detail-panel"
            style={{
              flex: `0 0 ${100 - chatPanelWidth}%`,
              minWidth: "360px",
            }}
          >
            <TaskDetail
              task={chatTask}
              onClose={() => setChatTask(null)}
              readOnly={true}
              isSplitScreen={true}
            />
          </div>

          <div
            className="resizer"
            onMouseDown={handleMouseDown}
            style={{
              flex: "0 0 4px",
              cursor: isResizing ? "col-resize" : "col-resize",
            }}
          />

          <div
            className="task-chat"
            style={{
              flex: `0 0 ${chatPanelWidth}%`,
              minWidth: "360px",
            }}
          >
            <TaskChat task={chatTask} onClose={() => setChatTask(null)} />
          </div>
        </div>
      )}

      {showNotifications && (
        <NotificationsPanel
          isOpen={showNotifications}
          onClose={() => {
            setShowNotifications(false);
            fetchUnreadCount(); // Refresh unread count when closing
          }}
        />
      )}
    </div>
  );
}
