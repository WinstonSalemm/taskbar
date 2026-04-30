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
};

const TYPE_LABELS = {
  payment_request: "💳 Заявка на оплату",
  invoice: "📄 Счёт-фактура",
  other: "📌 Прочее",
};

export default function EmployeeDashboard() {
  const { user } = useAuthStore();
  const { setTasks, filteredTasks } = useTaskStore();
  const { setChatTask } = useChat();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setLocalFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [viewTask, setViewTask] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [showEditFirm, setShowEditFirm] = useState(false);
  const [firmData, setFirmData] = useState(null);
  const [displayTasks, setDisplayTasks] = useState([]);

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

  // Применяем фильтрацию и сортировку
  useEffect(() => {
    // Получаем все задачи из store
    const allTasks = filteredTasks;

    // Фильтрация по статусу
    let filtered = allTasks.filter((task) => {
      if (filter === "all") return true;
      return task.status === filter;
    });

    // Фильтрация по приоритету
    if (priorityFilter !== "all") {
      filtered = filtered.filter(
        (task) => (task.priority || "medium") === priorityFilter,
      );
    }

    // Сортировка
    if (sortBy === "priority") {
      filtered = sortTasksByPriority(filtered);
    } else if (sortBy === "deadline") {
      filtered = filtered.sort((a, b) => {
        const aDeadline = a.actualDeadline || a.requestedDeadline;
        const bDeadline = b.actualDeadline || b.requestedDeadline;

        if (!aDeadline && !bDeadline) return 0;
        if (!aDeadline) return 1;
        if (!bDeadline) return -1;

        return new Date(aDeadline) - new Date(bDeadline);
      });
    }

    // Применяем отфильтрованные задачи в локальный state
    setDisplayTasks(filtered);
  }, [priorityFilter, sortBy, filter, filteredTasks]);

  const stats = {
    total: filteredTasks.length,
    new: filteredTasks.filter((t) => t.status === "new").length,
    review: filteredTasks.filter((t) => t.status === "review").length,
    inProgress: filteredTasks.filter((t) => t.status === "in_progress").length,
    done: filteredTasks.filter((t) => t.status === "done").length,
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
      </div>

      {/* Задачи на рассмотрении (для директора) */}
      {isDirector &&
        displayTasks.filter((t) => t.status === "review").length > 0 && (
          <div style={{ marginTop: "var(--space-6)" }}>
            <h3
              style={{
                margin: "0 0 var(--space-3) 0",
                fontSize: "var(--font-size-lg)",
                fontWeight: "var(--font-weight-semibold)",
              }}
            >
              📋 На рассмотрении
            </h3>
            <div className="admin-table-wrapper">
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
                  </tr>
                </thead>
                <tbody>
                  {displayTasks
                    .filter((t) => t.status === "review")
                    .map((task) => {
                      const amount = getTaskAmount(task);
                      const isMyTask = task.employeeId === user.id;
                      const priorityInfo = getPriorityInfo(task.priority);
                      const deadlineStatus = getDeadlineStatus(task);
                      return (
                        <tr
                          key={task.id}
                          onClick={() => setViewTask(task)}
                          style={{ cursor: "pointer" }}
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
                                    onClick={(e) =>
                                      handleDownload(e, task.id, file)
                                    }
                                    disabled={
                                      downloadingId === (file.id || task.id)
                                    }
                                    title={
                                      file.fileName ||
                                      file.file_name ||
                                      "Скачать"
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
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* Фильтры по статусу и приоритету */}
      <div className="admin-filters" style={{ marginTop: "var(--space-4)" }}>
        <div className="admin-status-filters">
          {[
            { id: "all", label: "Все" },
            { id: "new", label: "Новые" },
            { id: "review", label: "На рассмотрении" },
            { id: "in_progress", label: "В процессе" },
            { id: "done", label: "Готово" },
          ].map((f) => (
            <button
              key={f.id}
              className={`admin-status-btn ${filter === f.id ? "active" : ""}`}
              onClick={() => setLocalFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div
          className="admin-priority-filters"
          style={{ marginTop: "var(--space-3)" }}
        >
          <span
            style={{
              marginRight: "var(--space-2)",
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-secondary)",
            }}
          >
            Приоритет:
          </span>
          {[
            { id: "all", label: "Все" },
            { id: "critical", label: "🔴 Критический" },
            { id: "high", label: "🟠 Высокий" },
            { id: "medium", label: "🔵 Средний" },
            { id: "low", label: "🟢 Низкий" },
          ].map((f) => (
            <button
              key={f.id}
              className={`admin-status-btn ${priorityFilter === f.id ? "active" : ""}`}
              onClick={() => setPriorityFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div
          className="admin-sort-filters"
          style={{ marginTop: "var(--space-3)" }}
        >
          <span
            style={{
              marginRight: "var(--space-2)",
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-secondary)",
            }}
          >
            Сортировка:
          </span>
          {[
            { id: "date", label: "По дате" },
            { id: "priority", label: "По приоритету" },
            { id: "deadline", label: "По дедлайну" },
          ].map((f) => (
            <button
              key={f.id}
              className={`admin-status-btn ${sortBy === f.id ? "active" : ""}`}
              onClick={() => setSortBy(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Таблица задач */}
      {displayTasks.length === 0 ? (
        <div className="empty-state" style={{ marginTop: "var(--space-6)" }}>
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-text">Задач нет</div>
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
              </tr>
            </thead>
            <tbody>
              {displayTasks.map((task) => {
                const amount = getTaskAmount(task);
                const isMyTask = task.employeeId === user.id;
                const priorityInfo = getPriorityInfo(task.priority);
                const deadlineStatus = getDeadlineStatus(task);
                return (
                  <tr
                    key={task.id}
                    onClick={() => setViewTask(task)}
                    style={{ cursor: "pointer" }}
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
                      {isDirector && task.status === "new" ? (
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
                      ) : (
                        <span
                          className="admin-status-badge"
                          style={{
                            color: STATUS_MAP[task.status]?.color,
                          }}
                        >
                          {STATUS_MAP[task.status]?.label}
                        </span>
                      )}
                    </td>
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
          readOnly={true}
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
