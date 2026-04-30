import { useState, useEffect, useRef } from "react";
import { notificationsAPI } from "../api";
import { useAuthStore } from "../store/authStore";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import "./NotificationsPanel.css";

const SOCKET_URL = process.env.NODE_ENV === "production" 
  ? window.location.origin 
  : "http://localhost:5000";

const formatTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "только что";
  if (diffMins < 60) return `${diffMins} мин назад`;
  if (diffHours < 24) return `${diffHours} ч назад`;
  if (diffDays < 7) return `${diffDays} д назад`;
  return date.toLocaleDateString("ru-RU");
};

const getNotificationIcon = (type) => {
  switch (type) {
    case "task_created":
      return "📋";
    case "task_updated":
      return "✏️";
    case "status_changed":
      return "🔄";
    case "new_message":
      return "💬";
    case "deadline_changed":
      return "⏰";
    case "overdue":
      return "⚠️";
    case "priority_changed":
      return "🔥";
    case "task_completed":
      return "✅";
    default:
      return "📢";
  }
};

const getNotificationColor = (type) => {
  switch (type) {
    case "task_created":
      return "var(--color-primary)";
    case "task_completed":
      return "var(--color-success)";
    case "new_message":
      return "var(--color-info)";
    case "overdue":
      return "var(--color-danger)";
    case "priority_changed":
      return "var(--color-warning)";
    default:
      return "var(--color-text-secondary)";
  }
};

export default function NotificationsPanel({ isOpen, onClose }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const panelRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user?.id) return;

    // Initialize Socket.io connection
    socketRef.current = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    // Join notifications room
    socketRef.current.emit("join_notifications", user.id);

    // Listen for new notifications
    socketRef.current.on("notification_created", (notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    // Initial load
    fetchNotifications();
    fetchUnreadCount();

    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave_notifications", user.id);
        socketRef.current.disconnect();
      }
    };
  }, [user?.id]);

  const fetchNotifications = async (pageNum = 1, append = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const response = await notificationsAPI.getAll(user.id, pageNum, 30);
      const newNotifications = response.data.notifications;
      
      if (append) {
        setNotifications(prev => [...prev, ...newNotifications]);
      } else {
        setNotifications(newNotifications);
      }
      
      setHasMore(pageNum < response.data.totalPages);
      setPage(pageNum);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationsAPI.getUnreadCount(user.id);
      setUnreadCount(response.data.unread);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.is_read) {
      try {
        await notificationsAPI.markAsRead(notification.id, user.id);
        setNotifications(prev =>
          prev.map(n =>
            n.id === notification.id ? { ...n, is_read: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error("Error marking notification as read:", error);
      }
    }

    // Navigate to related task if exists
    if (notification.task_id) {
      navigate(`/tasks/${notification.task_id}`);
      onClose();
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead(user.id);
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const handleDelete = async (e, notificationId) => {
    e.stopPropagation();
    try {
      await notificationsAPI.delete(notificationId, user.id);
      setNotifications(prev =>
        prev.filter(n => n.id !== notificationId)
      );
      if (notifications.find(n => n.id === notificationId && !n.is_read)) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight * 1.5 && hasMore && !loading) {
      fetchNotifications(page + 1, true);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="notifications-overlay" onClick={onClose} />
      <div className="notifications-panel" ref={panelRef}>
        <div className="notifications-header">
          <div className="notifications-title">
            <span>Уведомления</span>
            {unreadCount > 0 && (
              <span className="notifications-badge">{unreadCount}</span>
            )}
          </div>
          <div className="notifications-actions">
            {unreadCount > 0 && (
              <button
                className="mark-all-read-btn"
                onClick={handleMarkAllAsRead}
              >
                Отметить все как прочитанные
              </button>
            )}
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <div
          className="notifications-list"
          onScroll={handleScroll}
        >
          {notifications.length === 0 ? (
            <div className="notifications-empty">
              <div className="empty-icon">📭</div>
              <div className="empty-text">Нет уведомлений</div>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`notification-item ${!notification.is_read ? "unread" : ""}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div
                  className="notification-icon"
                  style={{ color: getNotificationColor(notification.type) }}
                >
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="notification-content">
                  <div className="notification-title">{notification.title}</div>
                  <div className="notification-message">{notification.message}</div>
                  <div className="notification-time">
                    {formatTimeAgo(notification.created_at)}
                  </div>
                </div>
                <button
                  className="notification-delete"
                  onClick={(e) => handleDelete(e, notification.id)}
                >
                  ×
                </button>
              </div>
            ))
          )}
          
          {loading && (
            <div className="notifications-loading">
              <div className="loading-spinner"></div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
