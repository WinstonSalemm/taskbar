import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { useTaskStore } from "../store/taskStore";
import { tasksAPI, filesAPI } from "../api";
import TaskDetail from "../components/TaskDetail";
import TaskChat from "../components/TaskChat";
import { useChat } from "../context/ChatContext";
import axios from "axios";
import {
  getPriorityInfo,
  getDeadlineStatus,
  formatDate,
  sortTasksByPriority,
} from "../utils/priorityHelpers";
import "./AdminDashboard.css"; // Используем те же стили для таблиц

const STATUS_MAP = {
  new: {
    label: "Новая",
    color: "var(--color-danger)",
  },
  review: {
    label: "На рассмотрении",
    color: "var(--color-warning)",
  },
  in_progress: {
    label: "В процессе",
    color: "var(--color-info)",
  },
  done: {
    label: "Готово",
    color: "var(--color-success)",
  },
  rejected: {
    label: "Отклонено",
    color: "#6b7280",
  },
};

const TYPE_LABELS = {
  payment_request: "💳 Заявка на оплату",
  invoice: "📄 Счёт-фактура",
  other: "📌 Прочее",
};

export default function EmployeeDashboard() {
  const { user } = useAuthStore();
  const { setTasks, tasks, filteredTasks } = useTaskStore();
  const { setChatTask } = useChat();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setLocalFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [viewTask, setViewTask] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [showEditFirm, setShowEditFirm] = useState(false);
  const [firmData, setFirmData] = useState(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [rejectTask, setRejectTask] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const isDirector = user?.role === "director";

  useEffect(() => {
    console.log("📝 [Dashboard] User:", user);
    console.log("📝 [Dashboard] Firm ID:", user?.firmId);

    if (!user?.firmId) {
      console.error("❌ [Dashboard] No firm ID!");
      return;
    }

    let isMounted = true;

    const loadTasks = async () => {
      try {
        console.log("📝 [Dashboard] Fetching tasks from API...");
        const response = await tasksAPI.getByFirm(user.firmId);
        console.log("✅ [Dashboard] Tasks received:", response.data);

        if (isMounted) {
          setTasks(response.data.tasks || []);
          setLoading(false);
        }
      } catch (err) {
        console.error("❌ [Dashboard] Error fetching tasks:", err);
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    const loadFirmData = async () => {
      try {
        const response = await axios.get(`/api/firms/${user.firmId}`);
        if (isMounted) {
          setFirmData(response.data);
        }
      } catch (err) {
        console.error("Error loading firm data:", err);
      }
    };

    loadTasks();
    if (isDirector) {
      loadFirmData();
    }

    // Cleanup
    return () => {
      isMounted = false;
    };
  }, [user?.firmId, setTasks]);

  // Фильтрация по статусам
  const statusFilter = filter;

  // Получаем задачи для отображения в зависимости от фильтра
  const getFilteredTasks = () => {
    let filtered = [...tasks];

    // Фильтр по статусу
    if (statusFilter !== "all") {
      filtered = filtered.filter((t) => t.status === statusFilter);
    }

    return filtered;
  };

  const displayTasks = getFilteredTasks();

  // Функция для получения названия статуса
  const getStatusLabel = (status) => {
    switch (status) {
      case "review":
        return "📋 На рассмотрении";
      case "new":
        return "🔴 Новые";
      case "in_progress":
        return "🟡 В процессе";
      case "done":
        return "🟢 Готово";
      case "rejected":
        return "🚫 Отклонено";
      default:
        return "Все";
    }
  };

  // Статистика по статусам
  const stats = {
    total: tasks.length,
    review: tasks.filter((t) => t.status === "review").length,
    new: tasks.filter((t) => t.status === "new").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "done").length,
    rejected: tasks.filter((t) => t.status === "rejected").length,
  };

  const handleConfirmPayment = async (task) => {
    try {
      await axios.put(`/api/tasks/${task.id}`, {
        status: "in_progress",
      });
      // Обновляем список задач
      const response = await tasksAPI.getByFirm(user.firmId);
      setTasks(response.data.tasks || []);
    } catch (err) {
      console.error("Error confirming payment:", err);
      alert("Ошибка при подтверждении заявки");
    }
  };

  const handleRejectTask = (task) => {
    console.log("🔴 [Reject] Кнопка отклонения нажата", task);
    console.log("🔴 [Reject] Текущий rejectTask:", rejectTask);
    setRejectTask(task);
    setRejectionReason("");
    console.log(
      "🔴 [Reject] После setRejectTask, должно открыться модальное окно",
    );
  };

  const confirmRejectTask = async () => {
    if (!rejectionReason.trim()) {
      alert("Пожалуйста, укажите причину отказа");
      return;
    }

    try {
      await axios.put(`/api/tasks/${rejectTask.id}`, {
        status: "rejected",
        comments: rejectTask.comments
          ? `${rejectTask.comments}\n\nОтклонено. Причина: ${rejectionReason}`
          : `Отклонено. Причина: ${rejectionReason}`,
      });
      // Обновляем список задач
      const response = await tasksAPI.getByFirm(user.firmId);
      setTasks(response.data.tasks || []);
      setRejectTask(null);
      setRejectionReason("");
    } catch (err) {
      console.error("Error rejecting task:", err);
      alert("Ошибка при отклонении задачи");
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

  const getTaskDesc = (task) => {
    if (task.taskType === "payment_request") return task.taskData?.description;
    if (task.taskType === "invoice") return task.taskData?.subject;
    if (task.taskType === "other") return task.taskData?.essence;
    return "";
  };

  const getTaskAmount = (task) => {
    if (task.taskType === "payment_request") return task.taskData?.amount;
    if (task.taskType === "invoice") return task.taskData?.total;
    return null;
  };

  const handleDownload = async (e, taskId, file) => {
    e.stopPropagation();
    setDownloadingId(file.id || taskId);
    try {
      const response = await filesAPI.download(file.id || taskId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", file.fileName || file.file_name || "file");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading file:", err);
      if (file.fileUrl || file.file_url) {
        window.open(file.fileUrl || file.file_url, "_blank");
      }
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading">Загрузка задач...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="error-message">Ошибка: {error}</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="section-header">
        <div>
          <h2 className="section-title">Задачи фирмы</h2>
          {isDirector && (
            <div
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-warning)",
                marginTop: "4px",
              }}
            >
              👑 Режим директора
            </div>
          )}
        </div>
        {isDirector && firmData && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowEditFirm(true)}
          >
            ✏️ Редактировать фирму
          </button>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Всего задач</div>
        </div>
        <div className="stat-card new">
          <div className="stat-value">{stats.new}</div>
          <div className="stat-label">Новые</div>
        </div>
        <div className="stat-card review">
          <div className="stat-value">{stats.review}</div>
          <div className="stat-label">На рассмотрении</div>
        </div>
        <div className="stat-card in-progress">
          <div className="stat-value">{stats.inProgress}</div>
          <div className="stat-label">В работе</div>
        </div>
        <div className="stat-card done">
          <div className="stat-value">{stats.done}</div>
          <div className="stat-label">Готово</div>
        </div>
        <div className="stat-card rejected">
          <div className="stat-value">{stats.rejected}</div>
          <div className="stat-label">Отклонено</div>
        </div>
      </div>

      {/* Фильтры по статусам */}
      <div
        className="filters-container"
        style={{ marginTop: "var(--space-4)" }}
      >
        <div className="filter-section">
          <div className="filter-label">Статус</div>
          <div className="filter-buttons">
            {[
              { id: "all", label: "Все" },
              { id: "review", label: "📋 На рассмотрении" },
              { id: "new", label: "🔴 Новые" },
              { id: "in_progress", label: "🟡 В процессе" },
              { id: "done", label: "🟢 Готово" },
              { id: "rejected", label: "🚫 Отклонено" },
            ].map((f) => (
              <button
                key={f.id}
                className={`filter-btn ${filter === f.id ? "active" : ""}`}
                onClick={() => setLocalFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Таблица задач */}
      {displayTasks.length === 0 ? (
        <div className="empty-state" style={{ marginTop: "var(--space-6)" }}>
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-text">
            {filter === "all"
              ? "Задач нет"
              : `Задач со статусом "${getStatusLabel(filter)}" нет`}
          </div>
        </div>
      ) : (
        <div
          className="admin-table-wrapper"
          style={{ marginTop: "var(--space-4)" }}
        >
          <table className="admin-table">
            <thead>
              <tr>
                <th className="admin-col-id">№</th>
                <th className="admin-col-employee">Сотрудник</th>
                <th className="admin-col-date">Дата</th>
                <th className="admin-col-priority">Приоритет</th>
                <th className="admin-col-deadline">Дедлайн</th>
                <th className="admin-col-type">Тип</th>
                <th className="admin-col-amount">Сумма</th>
                <th className="admin-col-files">Файлы</th>
                <th className="admin-col-chat">Чат</th>
                <th className="admin-col-status">Статус</th>
                {filter === "rejected" && (
                  <th className="admin-col-status">Причина отказа</th>
                )}
              </tr>
            </thead>
            <tbody>
              {displayTasks.map((task) => {
                const amount = getTaskAmount(task);
                const isMyTask = task.employeeId === user.id;
                const priorityInfo = getPriorityInfo(task.priority);
                const deadlineStatus = getDeadlineStatus(task);
                const rejectionReason = (() => {
                  if (filter !== "rejected") return null;
                  const comments = Array.isArray(task.comments)
                    ? task.comments
                    : [];
                  const rejectionComment = comments.find(
                    (comment) =>
                      (typeof comment === "string" &&
                        comment.includes("Отклонено")) ||
                      (comment.text && comment.text.includes("Отклонено")),
                  );

                  if (rejectionComment) {
                    const reasonText =
                      typeof rejectionComment === "string"
                        ? rejectionComment.replace(
                            /.*Отклонено\.? Причина:\s*/,
                            "",
                          )
                        : rejectionComment.text.replace(
                            /.*Отклонено\.? Причина:\s*/,
                            "",
                          );
                    return reasonText.length > 50
                      ? reasonText.substring(0, 50) + "..."
                      : reasonText;
                  }

                  const rejectedComment = comments.find(
                    (comment) =>
                      (typeof comment === "string" &&
                        comment.includes("Отклонено")) ||
                      (comment.text && comment.text.includes("Отклонено")),
                  );

                  if (rejectedComment) {
                    const text =
                      typeof rejectedComment === "string"
                        ? rejectedComment
                        : rejectedComment.text;
                    return text.length > 50
                      ? text.substring(0, 50) + "..."
                      : text;
                  }

                  return "Причина не указана";
                })();

                return (
                  <tr
                    key={task.id}
                    onClick={() => setViewTask(task)}
                    style={{
                      cursor: "pointer",
                      opacity: filter === "rejected" ? 0.7 : 1,
                    }}
                  >
                    <td className="admin-col-id">{task.id}</td>
                    <td
                      className={`admin-col-employee ${isMyTask ? "my-task-name" : "other-task-name"}`}
                    >
                      {task.employeeName || "—"}
                    </td>
                    <td className="admin-col-date">
                      {formatDate(task.createdAt)}
                    </td>
                    <td className="admin-col-priority">
                      <span
                        className="priority-badge"
                        style={{
                          backgroundColor: priorityInfo.bgColor,
                          color: priorityInfo.color,
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: "500",
                        }}
                      >
                        {priorityInfo.icon} {priorityInfo.label}
                      </span>
                    </td>
                    <td className="admin-col-deadline">
                      {deadlineStatus && (
                        <span
                          className="deadline-badge"
                          style={{
                            color: deadlineStatus.color,
                            fontSize: "12px",
                            fontWeight: "500",
                          }}
                        >
                          {deadlineStatus.label}
                        </span>
                      )}
                    </td>
                    <td className="admin-col-type">
                      {TYPE_LABELS[task.taskType] || task.taskType}
                    </td>
                    <td className="admin-col-amount">
                      {amount ? (
                        <span className="admin-amount">
                          {amount.toLocaleString("ru-RU")} сўм
                        </span>
                      ) : (
                        <span className="admin-empty-cell">—</span>
                      )}
                    </td>
                    <td className="admin-col-files">
                      {task.attachments && task.attachments.length > 0 ? (
                        <div className="task-files-cell">
                          {task.attachments.map((file, idx) => (
                            <button
                              key={file.id || idx}
                              className="task-file-download-btn"
                              onClick={(e) => handleDownload(e, task.id, file)}
                              disabled={downloadingId === (file.id || task.id)}
                              title={
                                file.fileName || file.file_name || "Скачать"
                              }
                            >
                              {downloadingId === (file.id || task.id)
                                ? "⏳"
                                : "📥"}{" "}
                              {file.fileName ||
                                file.file_name ||
                                `Файл ${idx + 1}`}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="admin-empty-cell">—</span>
                      )}
                    </td>
                    <td className="admin-col-chat">
                      <button
                        className="admin-chat-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setChatTask(task);
                        }}
                        title="Открыть чат"
                      >
                        💬
                      </button>
                    </td>
                    <td className="admin-col-status">
                      {filter === "review" && isDirector && (
                        <div style={{ display: "flex", gap: "var(--space-1)" }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirmPayment(task);
                            }}
                            title="Подписать задачу"
                          >
                            ✍️ Подписать
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRejectTask(task);
                            }}
                            title="Отклонить задачу"
                          >
                            ❌ Отклонить
                          </button>
                        </div>
                      )}
                      {filter !== "review" && filter !== "rejected" && (
                        <span
                          className="admin-status-badge"
                          style={{
                            color: STATUS_MAP[task.status]?.color,
                          }}
                        >
                          {STATUS_MAP[task.status]?.label}
                        </span>
                      )}
                      {filter === "rejected" && (
                        <span
                          className="admin-status-badge"
                          style={{
                            color: STATUS_MAP.rejected.color,
                            backgroundColor: STATUS_MAP.rejected.bg,
                            fontSize: "12px",
                            maxWidth: "200px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "inline-block",
                          }}
                          title={rejectionReason}
                        >
                          {rejectionReason}
                        </span>
                      )}
                    </td>
                    {filter === "rejected" && (
                      <td className="admin-col-status">
                        <span
                          className="admin-status-badge"
                          style={{
                            color: STATUS_MAP.rejected.color,
                            backgroundColor: STATUS_MAP.rejected.bg,
                            fontSize: "12px",
                            maxWidth: "200px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "inline-block",
                          }}
                          title={rejectionReason}
                        >
                          {rejectionReason}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Модалка просмотра задачи */}
      {viewTask && (
        <TaskDetail
          task={viewTask}
          onClose={() => setViewTask(null)}
          onStatusChange={async (newStatus) => {
            await axios.put(`/api/tasks/${viewTask.id}`, {
              status: newStatus,
            });
            const response = await tasksAPI.getByFirm(user.firmId);
            setTasks(response.data.tasks || []);
            setViewTask((prev) => ({ ...prev, status: newStatus }));
          }}
          readOnly={!isDirector}
        />
      )}

      {/* Модалка редактирования фирмы для директора */}
      {showEditFirm && firmData && (
        <EditFirmModal
          firm={firmData}
          onClose={() => setShowEditFirm(false)}
          onSave={(updatedFirm) => setFirmData(updatedFirm)}
        />
      )}

      {/* Rejection Reason Modal */}
      {rejectTask && (
        <div
          className="modal-overlay"
          onClick={() => setRejectTask(null)}
          style={{ zIndex: 2000 }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "500px", zIndex: 2001 }}
          >
            <div className="modal-header">
              <h3>Отклонить задачу #{rejectTask.id}</h3>
              <button className="btn-icon" onClick={() => setRejectTask(null)}>
                ✕
              </button>
            </div>

            <div className="form-group">
              <label>Причина отказа *</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="form-input"
                placeholder="Укажите причину отклонения задачи..."
                rows={4}
                required
                autoFocus
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRejectTask(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmRejectTask}
              >
                Отклонить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditFirmModal({ firm, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: firm.name,
    email: firm.email,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await axios.patch(`/api/firms/${firm.id}`, {
        name: formData.name.trim(),
        email: formData.email.trim(),
      });
      onSave(response.data.firm || { ...firm, ...formData });
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message || "Ошибка при редактировании фирмы",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content edit-firm-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Редактировать фирму</h3>
          <button className="btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Название *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="form-input"
              placeholder="ООО «Компания»"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="form-input"
              placeholder="company@example.com"
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
