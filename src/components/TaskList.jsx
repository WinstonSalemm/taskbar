import { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { useTaskStore } from "../store/taskStore";
import { tasksAPI } from "../api";
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

export default function TaskList() {
  const { user } = useAuthStore();
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
  const [taskFiles, setTaskFiles] = useState({}); // Файлы для каждой задачи

  // Загружаем задачи при монтировании компонента
  useEffect(() => {
    if (!user?.id) {
      console.log("⏳ [TaskList] No user ID yet");
      return;
    }

    let isMounted = true;

    const loadTasks = async () => {
      console.log("📝 [TaskList] Fetching tasks for employee:", user.id);
      try {
        const response = await tasksAPI.getByEmployee(user.id);
        console.log("✅ [TaskList] Tasks loaded:", response.data.length);

        if (isMounted) {
          setTasks(response.data || []);
          setLoading(false);
        }
      } catch (err) {
        console.error("❌ [TaskList] Error loading tasks:", err);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadTasks();

    return () => {
      isMounted = false;
    };
  }, [user?.id, setTasks]);

  // Загружаем файлы для задачи при клике
  const loadTaskFiles = async (taskId) => {
    if (taskFiles[taskId]) {
      // Файлы уже загружены
      return taskFiles[taskId];
    }

    try {
      const response = await tasksAPI.getById(taskId);
      const attachments = response.data.attachments || [];
      setTaskFiles((prev) => ({ ...prev, [taskId]: attachments }));
      return attachments;
    } catch (err) {
      console.error("❌ [TaskList] Error loading files:", err);
      return [];
    }
  };

  const handleTaskClick = async (task) => {
    // Загружаем файлы перед открытием
    const attachments = await loadTaskFiles(task.id);
    setSelectedTask({ ...task, attachments });
  };

  const handleTaskTypeSelect = (taskType) => {
    setSelectedTaskType(taskType);
    setShowForm(true);
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

          {/* Список задач */}
          {filteredTasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-text">Задач нет</div>
              <div className="empty-state-sub">
                Выберите тип задачи выше, чтобы создать новую
              </div>
            </div>
          ) : (
            <div className="tasks-list">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className={`task-card status_${task.status}`}
                  onClick={() => handleTaskClick(task)}
                >
                  <div className="task-header">
                    <span className="task-id">#{task.id}</span>
                  </div>

                  <div className="task-type-label">
                    {task.taskType === "payment_request" &&
                      "💳 Заявка на оплату"}
                    {task.taskType === "invoice" && "📄 Счёт-фактура"}
                    {task.taskType === "other" && "📌 Прочее"}
                  </div>

                  <div className="task-desc-preview">
                    {task.taskType === "payment_request" &&
                      task.taskData?.description}
                    {task.taskType === "invoice" && task.taskData?.subject}
                    {task.taskType === "other" && task.taskData?.essence}
                  </div>

                  <div className="task-meta">
                    <span className="task-date">📅 {task.createdAt}</span>
                    <span className={`status-badge status_${task.status}`}>
                      {task.status === "new" && "Новая"}
                      {task.status === "in_progress" && "В работе"}
                      {task.status === "done" && "Готово"}
                      {task.status === "review" && "На проверке"}
                    </span>
                  </div>

                  {task.taskType === "payment_request" &&
                    task.taskData?.amount && (
                      <div className="task-amount">
                        Сумма:{" "}
                        <strong>
                          {task.taskData.amount.toLocaleString("ru-RU")} ₽
                        </strong>
                      </div>
                    )}

                  {task.taskType === "invoice" && task.taskData?.total && (
                    <div className="task-amount">
                      Сумма:{" "}
                      <strong>
                        {task.taskData.total.toLocaleString("ru-RU")} ₽
                      </strong>
                    </div>
                  )}

                  {/* Прикреплённые файлы */}
                  {task.attachments && task.attachments.length > 0 && (
                    <div className="task-attachments">
                      <span className="attachments-label">📎 Файлы:</span>
                      <span className="attachments-count">
                        {task.attachments.length} шт.
                      </span>
                    </div>
                  )}
                </div>
              ))}
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
              {task.taskData?.date || task.createdAt}
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

          {/* Статус и прогресс */}
          <div className="detail-row">
            <span className="detail-label">Статус:</span>
            <span className={`status-badge status_${task.status}`}>
              {task.status === "new" && "Новая"}
              {task.status === "in_progress" && "В работе"}
              {task.status === "done" && "Готово"}
              {task.status === "review" && "На проверке"}
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Прогресс:</span>
            <div className="detail-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${task.progress}%` }}
                />
              </div>
              <span className="progress-percent">{task.progress}%</span>
            </div>
          </div>

          {/* Файлы */}
          {task.attachments && task.attachments.length > 0 && (
            <div className="detail-files">
              <div className="detail-label">
                Файлы ({task.attachments.length}):
              </div>
              <div className="files-list">
                {task.attachments.map((file, index) => {
                  console.log(`📁 File ${index}:`, file);
                  return (
                    <div key={index} className="file-item-detail">
                      <span className="file-item-icon">
                        {file.fileName?.endsWith(".pdf") ? "📄" : "🖼️"}
                      </span>
                      <span className="file-item-name">
                        {file.fileName || "Файл"}
                      </span>
                      <a
                        href={
                          file.fileUrl ||
                          `/api/files/${file.fileId || file.file_id}/download`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-secondary"
                      >
                        Скачать
                      </a>
                    </div>
                  );
                })}
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
