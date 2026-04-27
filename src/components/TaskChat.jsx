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
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const status = STATUS_MAP[task.status] || STATUS_MAP.new;

  // Отслеживание размера экрана для desktop/mobile
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
    if ((!text && !selectedFile) || sending) return;

    setSending(true);
    setInput("");
    const fileToSend = selectedFile;
    setSelectedFile(null);

    if (socketRef.current?.connected) {
      // Конвертируем файл в base64 для отправки через socket
      let fileData = null;
      if (fileToSend) {
        fileData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              name: fileToSend.name,
              type: fileToSend.type,
              buffer: reader.result,
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(fileToSend);
        });
      }

      socketRef.current.emit("send_message", {
        taskId: task.id,
        authorId: user.id,
        authorName: user.name,
        authorRole: user.role || "employee",
        text,
        file: fileData,
      });
    } else {
      try {
        const formData = new FormData();
        formData.append("authorId", user.id);
        formData.append("authorName", user.name);
        formData.append("authorRole", user.role || "employee");
        formData.append("text", text);
        if (fileToSend) {
          formData.append("file", fileToSend);
        }

        await fetch(`/api/tasks/${task.id}/messages`, {
          method: "POST",
          body: formData,
        });
      } catch (err) {
        console.error("Error sending message:", err);
      }
    }

    setSending(false);
    inputRef.current?.focus();
  };

  // Выбор файла
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // Скриншот (только desktop)
  const handleScreenshot = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: "screen" },
      });
      const videoTrack = stream.getVideoTracks()[0];
      const capture = new ImageCapture(videoTrack);
      const bitmap = await capture.grabFrame();

      // Конвертируем в blob
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);

      canvas.toBlob((blob) => {
        const file = new File([blob], `screenshot-${Date.now()}.png`, {
          type: "image/png",
        });
        setSelectedFile(file);
        stream.getTracks().forEach((track) => track.stop());
      }, "image/png");
    } catch (err) {
      console.error("Screenshot error:", err);
    }
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
                    {msg.file_url && (
                      <a
                        href={msg.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="chat-file-attachment"
                      >
                        📎 {msg.file_name || "Файл"}
                      </a>
                    )}
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
        <div className="chat-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Напишите сообщение..."
            className="chat-input"
            disabled={sending}
          />
          {selectedFile && (
            <div className="chat-file-preview">
              <span className="chat-file-name">{selectedFile.name}</span>
              <button
                type="button"
                className="chat-file-remove"
                onClick={() => setSelectedFile(null)}
              >
                ✕
              </button>
            </div>
          )}
        </div>
        <div className="chat-input-actions">
          <input
            ref={fileInputRef}
            type="file"
            className="chat-file-input"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
          <button
            type="button"
            className="chat-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Прикрепить файл"
          >
            📎
          </button>
          {isDesktop && (
            <button
              type="button"
              className="chat-screenshot-btn"
              onClick={handleScreenshot}
              title="Сделать скриншот"
            >
              📷
            </button>
          )}
          <button
            type="submit"
            className="chat-send-btn"
            disabled={(!input.trim() && !selectedFile) || sending}
          >
            {sending ? "⏳" : "➤"}
          </button>
        </div>
      </form>
    </div>
  );
}
