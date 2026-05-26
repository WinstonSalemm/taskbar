import { useState, useMemo } from "react";
import { getPriorityInfo } from "../utils/priorityHelpers";
import "./TaskDetail.css";

const TYPE_LABELS = {
  payment_request: "Заявка на оплату",
  invoice: "Счёт-фактура",
  other: "Прочее",
};

const STATUS_MAP = {
  new: { label: "Новая", tone: "neutral" },
  review: { label: "На рассмотрении", tone: "soft" },
  in_progress: { label: "В процессе", tone: "soft" },
  done: { label: "Готово", tone: "strong" },
  rejected: { label: "Отклонено", tone: "muted" },
};

function formatDate(dateStr) {
  if (!dateStr) return "—";

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return String(dateStr);

  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("ru-RU")} сум`;
}

function getDeadlineStatus(deadline) {
  if (!deadline) return null;

  const today = new Date();
  const deadlineDate = new Date(deadline);
  const diffDays = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: `Просрочено на ${Math.abs(diffDays)} дн.`,
      tone: "overdue",
    };
  }

  if (diffDays <= 3) {
    return {
      label: `Осталось ${diffDays} дн.`,
      tone: "soon",
    };
  }

  return {
    label: `Осталось ${diffDays} дн.`,
    tone: "planned",
  };
}

function buildTaskRows(task) {
  const taskData = task.taskData || {};
  const rows = [];

  const pushRow = (label, value, options = {}) => {
    if (value === null || value === undefined || value === "") return;
    rows.push({
      label,
      value: String(value),
      wide: options.wide || String(value).length > 64,
    });
  };

  if (task.taskType === "payment_request") {
    pushRow("Сумма", formatMoney(taskData.amount));
    pushRow("Описание заявки", taskData.description, { wide: true });
  }

  if (task.taskType === "invoice") {
    pushRow("ИНН", taskData.inn);
    pushRow("Предмет", taskData.subject, { wide: true });
    pushRow("Цена", formatMoney(taskData.price));
    pushRow("Количество", taskData.quantity);
    pushRow("Итого", formatMoney(taskData.total));
  }

  if (task.taskType === "other") {
    pushRow("Суть", taskData.essence, { wide: true });
    pushRow("Аспекты", taskData.aspects, { wide: true });
    pushRow("Примечания", taskData.notes, { wide: true });
  }

  const hiddenKeys = new Set([
    "amount",
    "description",
    "inn",
    "subject",
    "price",
    "quantity",
    "total",
    "essence",
    "aspects",
    "notes",
    "priority",
    "deadline",
  ]);

  const genericLabels = {
    date: "Дата",
    recipient: "Получатель",
    requested_deadline: "Запрошенный срок",
    priority_reason: "Причина приоритета",
  };

  Object.entries(taskData).forEach(([key, value]) => {
    if (
      hiddenKeys.has(key) ||
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return;
    }

    const preparedValue = key === "date" ? formatDate(value) : value;
    pushRow(genericLabels[key] || key, preparedValue, {
      wide: typeof preparedValue === "string" && preparedValue.length > 48,
    });
  });

  return rows;
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
  const priorityInfo = getPriorityInfo(
    task.priority || task.taskData?.priority || "medium",
  );
  const deadlineStatus = getDeadlineStatus(task.taskData?.deadline);
  const detailRows = buildTaskRows(task);
  const attachments = Array.isArray(task.attachments) ? task.attachments : [];
  const comments = Array.isArray(task.comments) ? task.comments : [];

  const getDescription = () => {
    if (task.taskType === "payment_request") return task.taskData?.description;
    if (task.taskType === "invoice") return task.taskData?.subject;
    return task.taskData?.essence || task.taskData?.description || "—";
  };

  const getAmount = () => {
    if (task.taskType === "payment_request") return task.taskData?.amount;
    if (task.taskType === "invoice") {
      return (
        task.taskData?.total ||
        (task.taskData?.price || 0) * (task.taskData?.quantity || 0)
      );
    }
    return null;
  };

  const amount = getAmount();

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    if (onStatusChange) onStatusChange(newStatus);
  };

  const overviewCards = [
    {
      label: "Создал задачу",
      value:
        task.employeeName ||
        task.employee_name ||
        task.employeeId ||
        task.employee_id ||
        "—",
    },
    { label: "Создана", value: formatDate(task.createdAt) },
  ];

  const content = (
    <>
      <div className="td-header">
        <div className="td-header-copy">
          <span className="td-kicker">Task #{task.id}</span>
          <h3 className="td-title">
            {TYPE_LABELS[task.taskType] || task.taskType}
          </h3>
        </div>

        <div className="td-header-aside">
          <span className={`td-chip td-chip-${statusInfo.tone}`}>
            {statusInfo.label}
          </span>
          <span
            style={{
              color: priorityInfo.color,
              fontWeight: "500",
            }}
          >
            {priorityInfo.icon} {priorityInfo.label}
          </span>
          {deadlineStatus && (
            <span className={`td-chip td-chip-${deadlineStatus.tone}`}>
              {deadlineStatus.label}
            </span>
          )}
        </div>
      </div>

      <div className="td-content">
        <div className="td-overview-grid">
          {overviewCards.map((item) => (
            <div key={item.label} className="td-overview-card">
              <span className="td-overview-label">{item.label}</span>
              <span
                className={`td-overview-value ${item.strong ? "is-strong" : ""}`}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {detailRows.length > 0 && (
          <div className="td-section">
            <div className="td-section-label">Детали задачи</div>
            <div className="td-details-grid">
              {detailRows.map((row, index) => (
                <div
                  key={`${row.label}-${index}`}
                  className={`td-detail-card ${row.wide ? "td-detail-card-wide" : ""}`}
                >
                  <span className="td-detail-label">{row.label}</span>
                  <span className="td-detail-value">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {status === "rejected" && task.rejectionReason && (
          <div className="td-section">
            <div className="td-section-label">Причина отказа</div>
            <div className="td-rejection-reason">
              <span className="td-rejection-text">{task.rejectionReason}</span>
            </div>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="td-section">
            <div className="td-section-label">Файлы</div>
            <div className="td-files">
              {attachments.map((file, idx) => {
                const fileName =
                  file.fileName || file.file_name || `Файл ${idx + 1}`;
                const fileUrl = file.fileUrl || file.file_url;

                return (
                  <div key={file.id || idx} className="td-file">
                    <div className="td-file-meta">
                      <span className="td-file-kicker">Вложение {idx + 1}</span>
                      <span className="td-file-name">{fileName}</span>
                    </div>
                    <button
                      className="td-file-download"
                      onClick={() => {
                        if (fileUrl) window.open(fileUrl, "_blank");
                      }}
                    >
                      Open
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {comments.length > 0 && (
          <div className="td-section">
            <div className="td-section-label">Комментарии</div>
            <div className="td-comments">
              {comments.map((comment, idx) => (
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

        {!readOnly && !isSplitScreen && onStatusChange && (
          <div className="td-section">
            <div className="td-section-label">Статус</div>
            <div className="td-status-row">
              <select
                className="td-status-select"
                value={status}
                onChange={(event) => handleStatusChange(event.target.value)}
              >
                <option value="new">Новая</option>
                <option value="review">На рассмотрении</option>
                <option value="in_progress">В процессе</option>
                <option value="done">Готово</option>
                <option value="rejected">Отклонено</option>
              </select>
            </div>
          </div>
        )}

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

  if (isSplitScreen) {
    return content;
  }

  return (
    <div className="td-overlay" onClick={onClose}>
      <div className="td-modal" onClick={(event) => event.stopPropagation()}>
        {content}
      </div>
    </div>
  );
}
