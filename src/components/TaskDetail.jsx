import { useState } from "react";
import "./TaskDetail.css";

const STATUS_MAP = {
  new: { label: "Новый", color: "#dc2626", bg: "#fee2e2" },
  in_progress: { label: "В процессе", color: "#d97706", bg: "#fef3c7" },
  done: { label: "Готово", color: "#059669", bg: "#d1fae5" },
};

const TYPE_LABELS = {
  payment_request: "💳 Заявка на оплату",
  invoice: "📄 Счёт-фактура",
  other: "📌 Прочее",
};

export default function TaskDetail({ task, onClose, onStatusChange }) {
  const [status, setStatus] = useState(task.status);

  const statusInfo = STATUS_MAP[status] || STATUS_MAP.new;

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
  const description = getDescription();

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    if (onStatusChange) onStatusChange(newStatus);
  };

  return (
    <div className="td-overlay" onClick={onClose}>
      <div className="td-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="td-header">
          <button className="td-close" onClick={onClose}>✕</button>
          <div className="td-header-info">
            <h3>{TYPE_LABELS[task.taskType] || task.taskType}</h3>
            <span className="td-task-id">Задача #{task.id}</span>
            {task.firmName && (
              <span className="td-firm-name">{task.firmName}</span>
            )}
            {task.employeeName && (
              <span className="td-employee-name">{task.employeeName}</span>
            )}
          </div>
          <div className="td-status-section">
            <span className="td-status-label">Статус:</span>
            <select
              className="td-status-select"
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              <option value="new">🔴 Новый</option>
              <option value="in_progress">🟡 В процессе</option>
              <option value="done">🟢 Готово</option>
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="td-content">
          {description && (
            <div className="td-section">
              <div className="td-section-label">Описание</div>
              <p className="td-description">{description}</p>
            </div>
          )}

          <div className="td-meta-grid">
            <div className="td-meta-item">
              <span className="td-meta-icon">📅</span>
              <div className="td-meta-info">
                <span className="td-meta-label">Дата</span>
                <span className="td-meta-value">
                  {task.taskData?.date
                    ? formatDate(task.taskData.date)
                    : formatDate(task.createdAt)}
                </span>
              </div>
            </div>

            {amount && (
              <div className="td-meta-item">
                <span className="td-meta-icon">💰</span>
                <div className="td-meta-info">
                  <span className="td-meta-label">Сумма</span>
                  <span className="td-meta-value td-amount">
                    {amount.toLocaleString("ru-RU")} сўм
                  </span>
                </div>
              </div>
            )}
          </div>

          {task.taskType === "invoice" && (
            <div className="td-section">
              <div className="td-section-label">Детали счёта</div>
              <div className="td-fields">
                {task.taskData?.inn && (
                  <div className="td-field">
                    <span className="td-field-label">ИНН</span>
                    <span className="td-field-value">{task.taskData.inn}</span>
                  </div>
                )}
                {task.taskData?.price && task.taskData?.quantity && (
                  <div className="td-field">
                    <span className="td-field-label">Цена / Кол-во</span>
                    <span className="td-field-value">
                      {task.taskData.price} / {task.taskData.quantity}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {task.taskType === "other" && (
            <div className="td-section">
              <div className="td-section-label">Детали</div>
              <div className="td-fields">
                {task.taskData?.aspects && (
                  <div className="td-field">
                    <span className="td-field-label">Аспекты</span>
                    <span className="td-field-value">{task.taskData.aspects}</span>
                  </div>
                )}
                {task.taskData?.notes && (
                  <div className="td-field">
                    <span className="td-field-label">Примечания</span>
                    <span className="td-field-value">{task.taskData.notes}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="td-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
