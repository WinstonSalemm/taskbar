import { useState, useEffect } from "react";
import axios from "axios";
import { firmsAPI } from "../api";
import ConfirmModal from "../components/ConfirmModal";
import "./Employees.css";

export default function Employees() {
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddFirm, setShowAddFirm] = useState(false);
  const [deleteFirm, setDeleteFirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadFirms();
  }, []);

  const loadFirms = async () => {
    try {
      const res = await firmsAPI.getAll();
      setFirms(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFirm = async () => {
    if (!deleteFirm) return;
    setDeleting(true);
    try {
      // Удаляем все задачи фирмы (каскад удалит файлы и сообщения)
      await axios.delete(`/api/firms/${deleteFirm.id}`);
      setFirms((prev) => prev.filter((f) => f.id !== deleteFirm.id));
    } catch (err) {
      console.error("Error deleting firm:", err);
      alert("Ошибка при удалении фирмы");
    } finally {
      setDeleting(false);
      setDeleteFirm(null);
    }
  };

  if (loading)
    return (
      <div className="employees-module">
        <div className="loading">Загрузка...</div>
      </div>
    );

  return (
    <div className="employees-module">
      <div className="section-header">
        <h2 className="section-title">🏢 Фирмы</h2>
        <button
          className="btn btn-primary"
          onClick={() => setShowAddFirm(true)}
        >
          + Добавить фирму
        </button>
      </div>

      {firms.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏢</div>
          <div className="empty-state-text">Нет фирм</div>
        </div>
      ) : (
        <div className="firms-grid">
          {firms.map((firm) => (
            <div key={firm.id} className="firm-card">
              <div className="firm-card-header">
                <h3 className="firm-card-name">{firm.name}</h3>
                <button
                  className="firm-delete-btn"
                  onClick={() => setDeleteFirm(firm)}
                  title="Удалить фирму"
                >
                  🗑️
                </button>
              </div>
              <div className="firm-card-info">
                <span className="firm-card-email">{firm.email}</span>
                <div className="firm-card-stats">
                  <span>👥 {firm.employeeCount || 0} сотр.</span>
                  <span>📋 {firm.taskCount || 0} задач</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddFirm && (
        <AddFirmForm
          onClose={() => {
            setShowAddFirm(false);
            loadFirms();
          }}
        />
      )}

      {deleteFirm && (
        <ConfirmModal
          title="Удалить фирму?"
          message={`Фирма "${deleteFirm.name}" будет удалена вместе со всеми задачами, файлами и сотрудниками. Это действие нельзя отменить.`}
          onConfirm={handleDeleteFirm}
          onCancel={() => setDeleteFirm(null)}
          confirmText="Да, удалить"
          cancelText="Отмена"
          loading={deleting}
        />
      )}
    </div>
  );
}

function AddFirmForm({ onClose }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await axios.post("/api/firms", {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Ошибка при добавлении");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Добавить фирму</h3>
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
              {loading ? "Добавление..." : "Добавить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
