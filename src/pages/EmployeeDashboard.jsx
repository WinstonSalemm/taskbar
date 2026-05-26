import { useEffect, useState, useMemo, useRef } from "react";
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
  const tableRef = useRef(null);

  const isDirector = user?.role === "director";

  const scrollToTable = () => {
    if (tableRef.current) {
      tableRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

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

  // Получаем задачи для отображения в зависимости от всех фильтров
  const getFilteredTasks = () => {
    let filtered = [...tasks];

    // Фильтр по статусу
    if (filter !== "all") {
      filtered = filtered.filter((t) => t.status === filter);
    }

    // Фильтр по приоритету
    if (priorityFilter !== "all") {
      filtered = filtered.filter((t) => {
        const priority = t.taskData?.priority || "medium";
        return priority === priorityFilter;
      });
    }

    // Фильтр по типу задачи
    if (taskTypeFilter !== "all") {
      filtered = filtered.filter((t) => t.taskType === taskTypeFilter);
    }

    // Сортировка
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date":
          return new Date(b.createdAt) - new Date(a.createdAt);
        case "priority":
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          const aPriority = priorityOrder[a.taskData?.priority || "medium"];
          const bPriority = priorityOrder[b.taskData?.priority || "medium"];
          return bPriority - aPriority;
        case "deadline":
          const aDeadline = a.taskData?.deadline
            ? new Date(a.taskData.deadline)
            : new Date("9999-12-31");
          const bDeadline = b.taskData?.deadline
            ? new Date(b.taskData.deadline)
            : new Date("9999-12-31");
          return aDeadline - bDeadline;
        default:
          return 0;
      }
    });

    return filtered;
  };

  const displayTasks = useMemo(
    () => getFilteredTasks(),
    [tasks, filter, priorityFilter, taskTypeFilter, sortBy],
  );

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
      <div className="admin-dashboard">
        <div className="admin-loading">Загрузка задач...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard">
        <div className="error-message">Ошибка: {error}</div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
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

      <div className="stats-layout">
        <div
          className="total-stats-card"
          onClick={() => {
            setLocalFilter("all");
            scrollToTable();
          }}
          style={{ cursor: "pointer" }}
        >
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Всего задач</div>
        </div>
        <div className="other-stats-grid">
          <div
            className="stat-card new"
            onClick={() => {
              setLocalFilter("new");
              scrollToTable();
            }}
            style={{ cursor: "pointer" }}
          >
            <div className="stat-value">{stats.new}</div>
            <div className="stat-label">Новые</div>
          </div>
          <div
            className="stat-card review"
            onClick={() => {
              setLocalFilter("review");
              scrollToTable();
            }}
            style={{ cursor: "pointer" }}
          >
            <div className="stat-value">{stats.review}</div>
            <div className="stat-label">На рассмотрении</div>
          </div>
          <div
            className="stat-card in-progress"
            onClick={() => {
              setLocalFilter("in_progress");
              scrollToTable();
            }}
            style={{ cursor: "pointer" }}
          >
            <div className="stat-value">{stats.inProgress}</div>
            <div className="stat-label">В работе</div>
          </div>
          <div
            className="stat-card done"
            onClick={() => {
              setLocalFilter("done");
              scrollToTable();
            }}
            style={{ cursor: "pointer" }}
          >
            <div className="stat-value">{stats.done}</div>
            <div className="stat-label">Готово</div>
          </div>
          <div
            className="stat-card rejected"
            onClick={() => {
              setLocalFilter("rejected");
              scrollToTable();
            }}
            style={{ cursor: "pointer" }}
          >
            <div className="stat-value">{stats.rejected}</div>
            <div className="stat-label">Отклонено</div>
          </div>
        </div>
      </div>

      {/* Профессиональная панель фильтров */}
      <div
        className="professional-filters"
        style={{ marginTop: "var(--space-6)" }}
      >
        <div className="filters-unified">
          <div className="filter-group">
            <div className="filter-section-title">Приоритет</div>
            <div className="filter-pills">
              {[
                { id: "all", label: "Все" },
                { id: "high", label: "Высокий" },
                { id: "medium", label: "Средний" },
                { id: "low", label: "Низкий" },
              ].map((f) => (
                <button
                  key={f.id}
                  className={`filter-pill ${priorityFilter === f.id ? "active" : ""}`}
                  onClick={() => setPriorityFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <div className="filter-section-title">Тип задачи</div>
            <div className="filter-pills">
              {[
                { id: "all", label: "Все типы" },
                { id: "payment_request", label: "Заявка на оплату" },
                { id: "invoice", label: "Счёт-фактура" },
                { id: "other", label: "Прочее" },
              ].map((f) => (
                <button
                  key={f.id}
                  className={`filter-pill ${taskTypeFilter === f.id ? "active" : ""}`}
                  onClick={() => setTaskTypeFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <div className="filter-section-title">Сортировка</div>
            <div className="filter-pills">
              {[
                { id: "date", label: "По дате" },
                { id: "priority", label: "По приоритету" },
                { id: "deadline", label: "По дедлайну" },
              ].map((f) => (
                <button
                  key={f.id}
                  className={`filter-pill ${sortBy === f.id ? "active" : ""}`}
                  onClick={() => setSortBy(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Кнопка сброса фильтров */}
      {(priorityFilter !== "all" || taskTypeFilter !== "all") && (
        <div className="filters-reset-container">
          <button
            className="clear-filters-btn"
            onClick={() => {
              setPriorityFilter("all");
              setTaskTypeFilter("all");
              setSortBy("date");
            }}
          >
            Сбросить фильтры
          </button>
        </div>
      )}

      {/* Таблица задач */}
      <div ref={tableRef}>
        {displayTasks.length === 0 ? (
          <div className="empty-state" style={{ marginTop: "var(--space-6)" }}>
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-text">
              {priorityFilter === "all" && taskTypeFilter === "all"
                ? "Задач нет"
                : "Задач по выбранным фильтрам нет"}
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
                  <th className="admin-col-type">Тип</th>
                  <th className="admin-col-deadline">Дедлайн</th>
                  <th className="admin-col-amount">Сумма</th>
                  <th className="admin-col-status">Статус</th>
                  <th className="admin-col-chat">Чат</th>
                  {filter === "rejected" && (
                    <th className="admin-col-status">Причина отказа</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {
                displayTasks.map((task) => {
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
                      className={`${
                        task.status === "rejected" ? "admin-row-rejected" : ""
                      }`}
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
                          style={{
                            color: priorityInfo.color,
                            fontWeight: "500",
                          }}
                        >
                          {priorityInfo.icon} {priorityInfo.label}
                        </span>
                      </td>
                      <td className="admin-col-type">
                        {TYPE_LABELS[task.taskType] || task.taskType}
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
                      <td className="admin-col-amount">
                        {amount ? (
                          <span className="admin-amount">
                            {amount.toLocaleString("ru-RU")} сўм
                          </span>
                        ) : (
                          <span className="admin-empty-cell">—</span>
                        )}
                      </td>
                      <td className="admin-col-status">
                        
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
                            }}
                          >
                            {STATUS_MAP.rejected.label}
                          </span>
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
      </div>

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
    <div className="modal-overlay edit-firm-modal-overlay" onClick={onClose}>
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
