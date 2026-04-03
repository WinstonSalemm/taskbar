import { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { useTaskStore } from "../store/taskStore";
import { useChat } from "../context/ChatContext";
import { tasksAPI, filesAPI } from "../api";
import TaskForms from "./TaskForms";
import "./TaskList.css";

// Типы задач для клиента
const CLIENT_TASK_TYPES = [
  {
    id: "payment_request",
    icon: "💳",
    title: "Заявка на оплату",
    desc: "Выплата, перевод",
  },
  {
    id: "invoice",
    icon: "📄",
    title: "Счёт-фактура",
    desc: "Выставление счёта",
  },
  {
    id: "other",
    icon: "📌",
    title: "Прочее",
    desc: "Иное",
  },
];

const STATUS_FILTERS = [
  { id: "all", label: "Все", icon: "📋" },
  { id: "new", label: "Новые", icon: "🆕" },
  { id: "in_progress", label: "В работе", icon: "⏳" },
  { id: "done", label: "Готово", icon: "✅" },
];

// Маппинг статусов
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

export default function TaskList() {
  const { user } = useAuthStore();
  const { setChatTask } = useChat();
  const {
    filteredTasks,
    setFilter,
    setTaskType,
    setTasks,
    currentFilter,
    currentTaskType,
  } = useTaskStore();

  const [showForm, setShowForm] = useState(false);
  const [selectedTaskType, setSelectedTaskType] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [taskFiles, setTaskFiles] = useState({});
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;

    const loadTasks = async () => {
      try {
        const response = await tasksAPI.getByEmployee(user.id);
        if (isMounted) {
          setTasks(response.data || []);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error loading tasks:", err);
        if (isMounted) setLoading(false);
      }
    };

    loadTasks();
    return () => {
      isMounted = false;
    };
  }, [user?.id, setTasks]);

  const loadTaskFiles = async (taskId) => {
    if (taskFiles[taskId]) return taskFiles[taskId];
    try {
      const response = await tasksAPI.getById(taskId);
      const attachments = response.data.attachments || [];
      setTaskFiles((prev) => ({ ...prev, [taskId]: attachments }));
      return attachments;
    } catch {
      return [];
    }
  };

  const handleTaskClick = async (task) => {
    // Файлы уже загружены с бэкенда, но если нужно — подгрузим
    const attachments = task.attachments || (await loadTaskFiles(task.id));
    setSelectedTask({ ...task, attachments });
  };

  const handleTaskTypeSelect = (taskType) => {
    setSelectedTaskType(taskType);
    setShowForm(true);
  };

  // Скачивание файла
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
      // Fallback: открываем ссылку напрямую
      if (file.fileUrl || file.file_url) {
        window.open(file.fileUrl || file.file_url, "_blank");
      }
    } finally {
      setDownloadingId(null);
    }
  };

  // Получаем описание задачи одной строкой
  const getTaskDescription = (task) => {
    if (task.taskType === "payment_request")
      return task.taskData?.description || "—";
    if (task.taskType === "invoice") return task.taskData?.subject || "—";
    if (task.taskType === "other") return task.taskData?.essence || "—";
    return "—";
  };

  // Получаем сумму
  const getTaskAmount = (task) => {
    if (task.taskType === "payment_request") return task.taskData?.amount;
    if (task.taskType === "invoice") return task.taskData?.total;
    return null;
  };

  // Форматируем дату
  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
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

  return (
    <div className="tasks-module">
      <div className="section-header">
        <h2 className="section-title">Задачи</h2>
      </div>

      {loading ? (
        <div className="loading">Загрузка задач...</div>
      ) : (
        <>
          {/* Выбор типа задачи */}
          <div className="task-types-intro">
            <p className="task-types-intro-text">
              Выберите тип задачи для создания:
            </p>
            <div className="task-types-grid">
              {CLIENT_TASK_TYPES.map((type) => (
                <button
                  key={type.id}
                  className="task-type-btn-large"
                  onClick={() => handleTaskTypeSelect(type.id)}
                >
                  <span className="task-type-btn-icon">{type.icon}</span>
                  <span className="task-type-btn-title">{type.title}</span>
                  <span className="task-type-btn-desc">{type.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Фильтр по типу задачи */}
          <div className="task-type-filters">
            <button
              className={`task-type-filter-btn ${currentTaskType === null ? "active" : ""}`}
              onClick={() => setTaskType(null)}
            >
              Все типы
            </button>
            {CLIENT_TASK_TYPES.map((type) => (
              <button
                key={type.id}
                className={`task-type-filter-btn ${currentTaskType === type.id ? "active" : ""}`}
                onClick={() => setTaskType(type.id)}
              >
                {type.icon} {type.title}
              </button>
            ))}
          </div>

          {/* Фильтр по статусу */}
          <div className="task-filters">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.id}
                className={`task-filter-btn ${filter.id} ${currentFilter === filter.id ? "active" : ""}`}
                onClick={() => setFilter(filter.id)}
              >
                <span>{filter.icon}</span>
                {filter.label}
              </button>
            ))}
          </div>

          {/* Таблица задач */}
          {filteredTasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-text">Задач нет</div>
              <div className="empty-state-sub">
                Выберите тип задачи выше, чтобы создать новую
              </div>
            </div>
          ) : (
            <div className="task-table-wrapper">
              <table className="task-table">
                <thead>
                  <tr>
                    <th className="col-id">№</th>
                    <th className="col-date">Дата</th>
                    <th className="col-type">Тип</th>
                    <th className="col-desc">Описание</th>
                    <th className="col-amount">Сумма</th>
                    <th className="col-files">Файлы</th>
                    <th className="col-chat">Чат</th>
                    <th className="col-status">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => {
                    const status = STATUS_MAP[task.status] || STATUS_MAP.new;
                    const amount = getTaskAmount(task);
                    const files = task.attachments || [];
                    const hasFiles = files.length > 0;
                    return (
                      <tr
                        key={task.id}
                        className="task-table-row"
                        onClick={() => handleTaskClick(task)}
                      >
                        <td className="col-id">{task.id}</td>
                        <td className="col-date">
                          {formatDate(task.createdAt)}
                        </td>
                        <td className="col-type">
                          <span className="task-table-type">
                            {TYPE_LABELS[task.taskType] || task.taskType}
                          </span>
                        </td>
                        <td className="col-desc">
                          <span className="task-table-desc">
                            {getTaskDescription(task)}
                          </span>
                        </td>
                        <td className="col-amount">
                          {amount ? (
                            <span className="task-table-amount">
                              {amount.toLocaleString("ru-RU")} ₽
                            </span>
                          ) : (
                            <span className="task-table-empty">—</span>
                          )}
                        </td>
                        <td className="col-files">
                          {hasFiles ? (
                            <div className="task-files-cell">
                              {files.map((file, idx) => (
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
                            <span className="task-files-empty">
                              файл не прикреплён
                            </span>
                          )}
                        </td>
                        <td className="col-chat">
                          <button
                            className="task-chat-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setChatTask(task);
                            }}
                            title="Открыть чат"
                          >
                            💬
                          </button>
                        </td>
                        <td className="col-status">
                          <span
                            className="task-table-status-badge"
                            style={{
                              color: status.color,
                              backgroundColor: status.bg,
                            }}
                          >
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showForm && (
        <TaskForms
          taskType={selectedTaskType}
          onClose={() => {
            setShowForm(false);
            setSelectedTaskType(null);
          }}
        />
      )}

      {selectedTask && (
        <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}

function TaskDetail({ task, onClose }) {
  const STATUS_MAP_DETAIL = {
    new: { label: "Новый", color: "#dc2626", bg: "#fee2e2" },
    in_progress: { label: "В процессе", color: "#d97706", bg: "#fef3c7" },
    done: { label: "Готово", color: "#059669", bg: "#d1fae5" },
    review: { label: "На проверке", color: "#d97706", bg: "#fef3c7" },
  };

  const status = STATUS_MAP_DETAIL[task.status] || STATUS_MAP_DETAIL.new;

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            {task.taskType === "payment_request" && "💳 Заявка на оплату"}
            {task.taskType === "invoice" && "📄 Счёт-фактура"}
            {task.taskType === "other" && "📌 Прочее"}
          </h3>
          <button className="btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="task-detail-content">
          {/* Дата */}
          <div className="detail-row">
            <span className="detail-label">Дата:</span>
            <span className="detail-value">
              {task.taskData?.date
                ? formatDate(task.taskData.date)
                : formatDate(task.createdAt)}
            </span>
          </div>

          {/* Для заявки на оплату */}
          {task.taskType === "payment_request" && (
            <>
              <div className="detail-row">
                <span className="detail-label">Описание:</span>
                <span className="detail-value">
                  {task.taskData?.description}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Сумма:</span>
                <span className="detail-value amount">
                  {task.taskData?.amount?.toLocaleString("ru-RU")} ₽
                </span>
              </div>
            </>
          )}

          {/* Для счёта-фактуры */}
          {task.taskType === "invoice" && (
            <>
              <div className="detail-row">
                <span className="detail-label">ИНН:</span>
                <span className="detail-value">{task.taskData?.inn}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Предмет:</span>
                <span className="detail-value">{task.taskData?.subject}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Цена / Кол-во:</span>
                <span className="detail-value">
                  {task.taskData?.price} / {task.taskData?.quantity}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Сумма:</span>
                <span className="detail-value amount">
                  {task.taskData?.total?.toLocaleString("ru-RU")} ₽
                </span>
              </div>
            </>
          )}

          {/* Для прочего */}
          {task.taskType === "other" && (
            <>
              <div className="detail-row">
                <span className="detail-label">Суть:</span>
                <span className="detail-value">{task.taskData?.essence}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Аспекты:</span>
                <span className="detail-value">{task.taskData?.aspects}</span>
              </div>
              {task.taskData?.notes && (
                <div className="detail-row">
                  <span className="detail-label">Примечания:</span>
                  <span className="detail-value">{task.taskData?.notes}</span>
                </div>
              )}
            </>
          )}

          {/* Статус */}
          <div className="detail-row">
            <span className="detail-label">Статус:</span>
            <span
              className="task-table-status-badge"
              style={{ color: status.color, backgroundColor: status.bg }}
            >
              {status.label}
            </span>
          </div>

          {/* Файлы */}
          {task.attachments && task.attachments.length > 0 && (
            <div className="detail-files">
              <div className="detail-label">
                Файлы ({task.attachments.length}):
              </div>
              <div className="files-list">
                {task.attachments.map((file, index) => (
                  <div key={index} className="file-item-detail">
                    <span className="file-item-icon">
                      {file.fileName?.endsWith(".pdf") ? "📄" : "🖼️"}
                    </span>
                    <span className="file-item-name">
                      {file.fileName || "Файл"}
                    </span>
                    {file.fileUrl?.includes("drive.google.com") ? (
                      <a
                        href={file.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-secondary"
                      >
                        📄 Google Drive
                      </a>
                    ) : file.file_url?.includes("drive.google.com") ? (
                      <a
                        href={file.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-secondary"
                      >
                        📄 Google Drive
                      </a>
                    ) : (
                      <a
                        href={file.fileUrl || file.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-secondary"
                      >
                        ⬇️ Скачать
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
