import { useState } from "react";
import { useTaskStore } from "../store/taskStore";
import { tasksAPI } from "../api";
import { useApi } from "../hooks/useApi";
import "./TaskList.css";

const TASK_TYPES = [
  { id: "payment", icon: "💳", title: "Платёж", desc: "Выплата, перевод" },
  { id: "invoice", icon: "📄", title: "Счёт", desc: "Счёт, акт" },
  { id: "document", icon: "📑", desc: "Документы", title: "Документы" },
  { id: "other", icon: "📌", title: "Другое", desc: "Иное" },
];

const STATUS_FILTERS = [
  { id: "all", label: "Все", icon: "📋" },
  { id: "new", label: "Новые", icon: "🆕" },
  { id: "in_progress", label: "В работе", icon: "⏳" },
  { id: "done", label: "Готово", icon: "✅" },
];

export default function TaskList() {
  const {
    filteredTasks,
    setFilter,
    setTaskType,
    currentFilter,
    currentTaskType,
  } = useTaskStore();
  const [showForm, setShowForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const { execute: deleteTask, loading: deleting } = useApi(tasksAPI.delete);

  const handleDelete = async (taskId, e) => {
    e.stopPropagation();
    if (confirm("Удалить задачу?")) {
      await deleteTask(taskId);
    }
  };

  return (
    <div className="tasks-module">
      <div className="section-header">
        <h2 className="section-title">Задачи</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Создать задачу
        </button>
      </div>

      {/* Фильтр по типам задач */}
      <div className="task-types-grid">
        <div
          className={`task-type-btn ${currentTaskType === null ? "selected" : ""}`}
          onClick={() => setTaskType(null)}
        >
          <div className="task-type-icon">📋</div>
          <div className="task-type-title">Все</div>
          <div className="task-type-desc">Все типы</div>
        </div>
        {TASK_TYPES.map((type) => (
          <div
            key={type.id}
            className={`task-type-btn ${currentTaskType === type.id ? "selected" : ""}`}
            onClick={() => setTaskType(type.id)}
          >
            <div className="task-type-icon">{type.icon}</div>
            <div className="task-type-title">{type.title}</div>
            <div className="task-type-desc">{type.desc}</div>
          </div>
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

      {/* Список задач */}
      {filteredTasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-text">Задач нет</div>
        </div>
      ) : (
        <div className="tasks-list">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className={`task-card status_${task.status}`}
              onClick={() => setSelectedTask(task)}
            >
              <div className="task-header">
                <span className="task-id">#{task.id}</span>
                <div className="task-actions">
                  <button className="btn-icon edit" title="Редактировать">
                    ✏️
                  </button>
                  <button
                    className="btn-icon delete"
                    onClick={(e) => handleDelete(task.id, e)}
                    disabled={deleting}
                    title="Удалить"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="task-title">
                {TASK_TYPES.find((t) => t.id === task.taskType)?.title ||
                  task.taskType}
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

              <div className="progress-section">
                <div className="progress-label">
                  <span>Прогресс</span>
                  <span>{task.progress}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <TaskForm onClose={() => setShowForm(false)} />}

      {selectedTask && (
        <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}

function TaskForm({ onClose }) {
  const [formData, setFormData] = useState({
    taskType: "other",
    description: "",
    amount: "",
    recipient: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Новая задача</h3>
          <button className="btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="task-form">
          <div className="form-group">
            <label>Тип задачи</label>
            <select
              value={formData.taskType}
              onChange={(e) =>
                setFormData({ ...formData, taskType: e.target.value })
              }
              className="task-form-input"
            >
              {TASK_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.title}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Описание</label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="task-form-textarea"
              rows={4}
              required
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Отмена
            </button>
            <button type="submit" className="btn btn-primary">
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TaskDetail({ task, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Задача #{task.id}</h3>
          <button className="btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="task-detail-content">
          <p>
            <strong>Тип:</strong> {task.taskType}
          </p>
          <p>
            <strong>Статус:</strong> {task.status}
          </p>
          <p>
            <strong>Прогресс:</strong> {task.progress}%
          </p>
          <p>
            <strong>Дата:</strong> {task.createdAt}
          </p>
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
