import { useState } from "react";
import { filesAPI } from "../api";
import {
  getPriorityInfo,
  getDeadlineStatus,
  formatDate,
} from "../utils/priorityHelpers";
import "./TaskDetail.css";

const STATUS_MAP = {
  new: { label: "Новый", color: "#dc2626", bg: "#fee2e2" },
  review: { label: "На рассмотрении", color: "#d97706", bg: "#fef3c7" },
  in_progress: { label: "В процессе", color: "#d97706", bg: "#fef3c7" },
  done: { label: "Готово", color: "#059669", bg: "#d1fae5" },
};

const TYPE_LABELS = {
  payment_request: "💳 Заявка на оплату",
  invoice: "📄 Счёт-фактура",
  other: "📌 Прочее",
};

export default function TaskDetail({
  task,
  onClose,
  onStatusChange,
  readOnly = false,
}) {
  const [status, setStatus] = useState(task.status);

  const statusInfo = STATUS_MAP[status] || STATUS_MAP.new;
  const priorityInfo = getPriorityInfo(task.priority);
  const deadlineStatus = getDeadlineStatus(task);

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
          <button className="td-close" onClick={onClose}>
            ✕
          </button>
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
            {readOnly ? (
              <span
                className="td-status-badge"
                style={{
                  color: statusInfo.color,
                  backgroundColor: statusInfo.bg,
                }}
              >
                {statusInfo.label}
              </span>
            ) : (
              <select
                className="td-status-select"
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
              >
                <option value="new">🔴 Новый</option>
                <option value="in_progress">🟡 В процессе</option>
                <option value="done">🟢 Готово</option>
              </select>
            )}
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
                <span className="td-meta-label">Дата создания</span>
                <span className="td-meta-value">
                  {formatDate(task.createdAt)}
                </span>
              </div>
            </div>

            <div className="td-meta-item">
              <span className="td-meta-icon">{priorityInfo.icon}</span>
              <div className="td-meta-info">
                <span className="td-meta-label">Приоритет</span>
                <span
                  className="td-meta-value"
                  style={{
                    color: priorityInfo.color,
                    fontWeight: "600",
                  }}
                >
                  {priorityInfo.label}
                </span>
              </div>
            </div>

            {deadlineStatus && (
              <div className="td-meta-item">
                <span className="td-meta-icon">⏰</span>
                <div className="td-meta-info">
                  <span className="td-meta-label">Дедлайн</span>
                  <span
                    className="td-meta-value"
                    style={{
                      color: deadlineStatus.color,
                      fontWeight: "600",
                    }}
                  >
                    {deadlineStatus.label}
                  </span>
                </div>
              </div>
            )}

            {task.progress !== undefined && task.progress !== null && (
              <div className="td-meta-item">
                <span className="td-meta-icon">📊</span>
                <div className="td-meta-info">
                  <span className="td-meta-label">Прогресс</span>
                  <span className="td-meta-value">{task.progress}%</span>
                </div>
              </div>
            )}

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

            {task.priorityReason && (
              <div className="td-meta-item" style={{ gridColumn: "1 / -1" }}>
                <span className="td-meta-icon">📝</span>
                <div className="td-meta-info">
                  <span className="td-meta-label">Причина приоритета</span>
                  <span className="td-meta-value">{task.priorityReason}</span>
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
                    <span className="td-field-value">
                      {task.taskData.aspects}
                    </span>
                  </div>
                )}
                {task.taskData?.notes && (
                  <div className="td-field">
                    <span className="td-field-label">Примечания</span>
                    <span className="td-field-value">
                      {task.taskData.notes}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Файлы */}
          {task.attachments && task.attachments.length > 0 && (
            <div className="td-section">
              <div className="td-section-label">
                Файлы ({task.attachments.length})
              </div>
              <div className="td-files-list">
                {task.attachments.map((file, index) => (
                  <div key={file.id || index} className="td-file-item">
                    <span className="td-file-icon">
                      {file.fileName?.endsWith(".pdf") ? "📄" : "🖼️"}
                    </span>
                    <span className="td-file-name" title={file.fileName}>
                      {file.fileName || "Файл"}
                    </span>
                    <button
                      className="td-file-download-btn"
                      onClick={async () => {
                        try {
                          const response = await filesAPI.download(file.id);
                          const url = window.URL.createObjectURL(
                            new Blob([response.data]),
                          );
                          const link = document.createElement("a");
                          link.href = url;
                          link.setAttribute(
                            "download",
                            file.fileName || "file",
                          );
                          document.body.appendChild(link);
                          link.click();
                          link.remove();
                          window.URL.revokeObjectURL(url);
                        } catch (err) {
                          if (file.fileUrl) {
                            window.open(file.fileUrl, "_blank");
                          }
                        }
                      }}
                      title="Скачать"
                    >
                      ⬇️
                    </button>
                  </div>
                ))}
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
