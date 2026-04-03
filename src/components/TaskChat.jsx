import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuthStore } from "../store/authStore";
import "./TaskChat.css";

const STATUS_MAP = {
  new: { label: "Новый", color: "#dc2626", bg: "#fee2e2" },
  in_progress: { label: "В процессе", color: "#d97706", bg: "#fef3c7" },
  done: { label: "Готово", color: "#059669", bg: "#d1fae5" },
  review: { label: "На проверке", color: "#d97706", bg: "#fef3c7" },
};

const TYPE_LABELS = {
  payment_request: "💳 Заявка на оплату",
  invoice: "📄 Счёт-фактура",
  other: "📌 Прочее",
};

export default function TaskChat({ task, onClose }) {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const inputRef = useRef(null);

  const status = STATUS_MAP[task.status] || STATUS_MAP.new;

  // Загрузка сообщений
  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Error loading messages:", err);
    } finally {
      setLoading(false);
    }
  }, [task.id]);

  // Инициализация Socket.io
  useEffect(() => {
    socketRef.current = io("/", {
      transports: ["websocket", "polling"],
    });

    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log("🔌 Socket connected:", socket.id);
      socket.emit("join_task", task.id);
    });

    socket.on("new_message", (message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    socket.on("message_error", (err) => {
      console.error("Message error:", err);
      setSending(false);
    });

    socket.on("disconnect", () => {
      console.log("🔌 Socket disconnected");
    });

    loadMessages();

    // Загружаем счётчик непрочитанных и отмечаем как прочитанные
    const loadUnread = async () => {
      try {
        const res = await fetch(
          `/api/tasks/${task.id}/messages/unread?viewerId=${user.id}`,
        );
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unread);
        }
      } catch (err) {
        console.error("Error loading unread:", err);
      }
    };
    loadUnread();

    // Отмечаем как прочитанные при открытии
    fetch(`/api/tasks/${task.id}/messages/seen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viewerId: user.id }),
    }).then(() => setUnreadCount(0));

    return () => {
      socket.emit("leave_task", task.id);
      socket.off("new_message");
      socket.off("message_error");
      socket.disconnect();
    };
  }, [task.id, loadMessages]);

  // Автоскролл вниз
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Отправка сообщения
  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput("");

    if (socketRef.current?.connected) {
      socketRef.current.emit("send_message", {
        taskId: task.id,
        authorId: user.id,
        authorName: user.name,
        authorRole: user.role || "employee",
        text,
      });
    } else {
      try {
        await fetch(`/api/tasks/${task.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authorId: user.id,
            authorName: user.name,
            authorRole: user.role || "employee",
            text,
          }),
        });
      } catch (err) {
        console.error("Error sending message:", err);
      }
    }

    setSending(false);
    inputRef.current?.focus();
  };

  const formatTime = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getDescription = () => {
    if (task.taskType === "payment_request") return task.taskData?.description;
    if (task.taskType === "invoice") return task.taskData?.subject;
    if (task.taskType === "other") return task.taskData?.essence;
    return "";
  };

  const getAmount = () => {
    if (task.taskType === "payment_request") return task.taskData?.amount;
    if (task.taskType === "invoice") return task.taskData?.total;
    return null;
  };

  const amount = getAmount();

  return (
    <div className="chat-panel">
      {/* Шапка — инфа о задаче */}
      <div className="chat-header">
        <div className="chat-header-top">
          <h3 className="chat-title">
            {TYPE_LABELS[task.taskType] || task.taskType} #{task.id}
          </h3>
          <button className="chat-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="chat-task-info">
          {getDescription() && (
            <p className="chat-task-desc">{getDescription()}</p>
          )}
          <div className="chat-task-meta">
            <span className="chat-task-date">
              📅 {formatDate(task.createdAt)}
            </span>
            {amount && (
              <span className="chat-task-amount">
                {amount.toLocaleString("ru-RU")} сўм
              </span>
            )}
            <span
              className="chat-task-status"
              style={{ color: status.color, backgroundColor: status.bg }}
            >
              {status.label}
            </span>
          </div>
        </div>
      </div>

      {/* Сообщения */}
      <div className="chat-messages">
        {loading ? (
          <div className="chat-loading">Загрузка сообщений...</div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">💬</div>
            <p>Нет сообщений</p>
            <span>Начните обсуждение задачи</span>
          </div>
        ) : (
          <div className="chat-messages-list">
            {messages.map((msg) => {
              const isMine =
                msg.author_id === user.id || msg.author_name === user.name;
              return (
                <div
                  key={msg.id}
                  className={`chat-message ${isMine ? "mine" : "theirs"}`}
                >
                  <div className="chat-msg-bubble">
                    <div className="chat-msg-header">
                      <span className="chat-msg-author">
                        {msg.author_name}
                        {msg.author_role === "admin" && (
                          <span className="chat-msg-role">админ</span>
                        )}
                      </span>
                      <span className="chat-msg-time">
                        {formatTime(msg.created_at || msg.createdAt)}
                      </span>
                    </div>
                    <p className="chat-msg-text">{msg.text}</p>
                    {isMine && (
                      <span
                        className={`chat-msg-seen ${msg.seen_by_recipient ? "seen" : ""}`}
                      >
                        {msg.seen_by_recipient ? "✓✓" : "✓"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Ввод */}
      <form className="chat-input-area" onSubmit={handleSend}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Напишите сообщение..."
          className="chat-input"
          disabled={sending}
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={!input.trim() || sending}
        >
          {sending ? "⏳" : "➤"}
        </button>
      </form>
    </div>
  );
}
