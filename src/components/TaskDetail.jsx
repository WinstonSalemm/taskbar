import { useState } from "react";
import { getPriorityInfo } from "../utils/priorityHelpers";
import "./TaskDetail.css";

const TYPE_LABELS = {
  payment_request: "Заявка на оплату",
  invoice: "Счёт-фактура",
  other: "Прочее",
};

const STATUS_MAP = {
  new: {
    label: "Новая",
    color: "var(--color-danger)",
    bg: "var(--color-danger-bg)",
  },
  review: {
    label: "На рассмотрении",
    color: "var(--color-warning)",
    bg: "var(--color-warning-bg)",
  },
  in_progress: {
    label: "В процессе",
    color: "var(--color-warning)",
    bg: "var(--color-warning-bg)",
  },
  done: {
    label: "Готово",
    color: "var(--color-success)",
    bg: "var(--color-success-bg)",
  },
  rejected: {
    label: "Отклонено",
    color: "var(--color-text-muted)",
    bg: "var(--color-bg)",
  },
};

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getDeadlineStatus(deadline) {
  if (!deadline) return null;
  const today = new Date();
  const deadlineDate = new Date(deadline);
  const diffDays = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: `Просрочено на ${Math.abs(diffDays)} дн.`,
      color: "var(--color-danger)",
    };
  } else if (diffDays <= 3) {
    return { label: `Осталось ${diffDays} дн.`, color: "var(--color-warning)" };
  } else {
    return { label: `Осталось ${diffDays} дн.`, color: "var(--color-success)" };
  }
}

export default function TaskDetail({
  task,
  onClose,
  onStatusChange,
  readOnly = false,
  isSplitScreen = false,
}) {
  const [status, setStatus] = useState(task.status);

  const statusInfo = STATUS_MAP[status] || STATUS_MAP.new;
  const priorityInfo = getPriorityInfo(task.taskData?.priority || "medium");
  const deadlineStatus = getDeadlineStatus(task.taskData?.deadline);

  const getDescription = () => {
    if (task.taskType === "payment_request") return task.taskData?.description;
    if (task.taskType === "invoice") return task.taskData?.subject;
    return task.taskData?.description || "—";
  };

  const getAmount = () => {
    if (task.taskType === "payment_request") return task.taskData?.amount;
    if (task.taskType === "invoice")
      return (task.taskData?.price || 0) * (task.taskData?.quantity || 0);
    return null;
  };

  const amount = getAmount();
  const description = getDescription();

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    if (onStatusChange) onStatusChange(newStatus);
  };

  const content = (
    <>
      {/* Header */}
      <div className="td-header">
        {!isSplitScreen && (
          <button className="td-close" onClick={onClose}>
            ✕
          </button>
        )}
        <h3 className="td-title">
          {TYPE_LABELS[task.taskType]} #{task.id}
        </h3>
        <span
          className="td-status-badge"
          style={{
            backgroundColor: statusInfo.bg,
            color: statusInfo.color,
          }}
        >
          {statusInfo.label}
        </span>
      </div>

      {/* Content */}
      <div className="td-content">
        {description && (
          <div className="td-section">
            <div className="td-section-label">Описание</div>
            <p className="td-description">{description}</p>
          </div>
        )}

        {/* Причина отказа */}
        {status === "rejected" && task.rejectionReason && (
          <div className="td-section">
            <div className="td-section-label">Причина отказа</div>
            <div className="td-rejection-reason">
              <span className="td-rejection-icon">❌</span>
              <span className="td-rejection-text">{task.rejectionReason}</span>
            </div>
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
            <div className="td-meta-info">
              <span className="td-meta-label">Приоритет</span>
              <span
                className="td-status-badge"
                style={{
                  color: priorityInfo.color,
                  backgroundColor: priorityInfo.bgColor,
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
                  className="td-status-badge"
                  style={{
                    color: deadlineStatus.color,
                  }}
                >
                  {deadlineStatus.label}
                </span>
              </div>
            </div>
          )}

          {amount && (
            <div className="td-meta-item">
              <span className="td-meta-icon">💰</span>
              <div className="td-meta-info">
                <span className="td-meta-label">Сумма</span>
                <span className="td-meta-value">
                  {amount.toLocaleString("ru-RU")} сўм
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Файлы */}
        {task.attachments && task.attachments.length > 0 && (
          <div className="td-section">
            <div className="td-section-label">Файлы</div>
            <div className="td-files">
              {task.attachments.map((file, idx) => (
                <div key={file.id || idx} className="td-file">
                  <span className="td-file-name">
                    📎 {file.fileName || `Файл ${idx + 1}`}
                  </span>
                  <button
                    className="td-file-download"
                    onClick={() => {
                      if (file.fileUrl) {
                        window.open(file.fileUrl, "_blank");
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

        {/* Комментарии */}
        {task.comments && task.comments.length > 0 && (
          <div className="td-section">
            <div className="td-section-label">Комментарии</div>
            <div className="td-comments">
              {task.comments.map((comment, idx) => (
                <div key={idx} className="td-comment">
                  <span className="td-comment-author">
                    {comment.author || "Система"}
                  </span>
                  <span className="td-comment-text">
                    {typeof comment === "string" ? comment : comment.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {!isSplitScreen && (
          <div className="td-actions">
            <button className="btn btn-secondary" onClick={onClose}>
              Закрыть
            </button>
          </div>
        )}
      </div>
    </>
  );

  // В зависимости от режима отображения
  if (isSplitScreen) {
    return content;
  }

  return (
    <div className="td-overlay" onClick={onClose}>
      <div className="td-modal" onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </div>
  );
}
