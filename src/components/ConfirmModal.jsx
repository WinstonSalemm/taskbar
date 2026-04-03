import "./ConfirmModal.css";

export default function ConfirmModal({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Да",
  cancelText = "Отмена",
  loading = false,
}) {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div
        className="confirm-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-icon">⚠️</div>
        <h3 className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Удаление..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
