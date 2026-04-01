import { useState, useEffect } from "react";
import { useApi } from "../hooks/useApi";
import { firmsAPI } from "../api";
import axios from "axios";
import "./Employees.css";

export default function Employees() {
  const { data: firms, loading, execute } = useApi(firmsAPI.getAll);
  const [selectedFirm, setSelectedFirm] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [refresh, setRefresh] = useState(false);

  useEffect(() => {
    execute();
  }, []);

  const loadEmployees = async (firmId) => {
    try {
      const response = await firmsAPI.getEmployees(firmId);
      setEmployees(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFirmSelect = (firm) => {
    setSelectedFirm(firm);
    loadEmployees(firm.id);
  };

  const handleDeleteEmployee = async (employeeId) => {
    if (!confirm("Удалить сотрудника?")) return;

    try {
      await axios.delete(
        `/api/firms/${selectedFirm.id}/employees/${employeeId}`,
      );
      setRefresh(!refresh);
      loadEmployees(selectedFirm.id);
    } catch (err) {
      alert("Ошибка при удалении");
    }
  };

  return (
    <div className="employees-module">
      <div className="section-header">
        <h2 className="section-title">👥 Сотрудники</h2>
        <button
          className="btn btn-primary"
          onClick={() => setShowAddForm(true)}
          disabled={!selectedFirm}
        >
          + Добавить сотрудника
        </button>
      </div>

      {/* Список фирм */}
      <div className="firms-selector">
        {loading ? (
          <div className="loading">Загрузка...</div>
        ) : (
          firms?.map((firm) => (
            <button
              key={firm.id}
              className={`firm-btn ${selectedFirm?.id === firm.id ? "active" : ""}`}
              onClick={() => handleFirmSelect(firm)}
            >
              <span className="firm-name">{firm.name}</span>
              <span className="firm-count">{firm.employeeCount} сотр.</span>
            </button>
          ))
        )}
      </div>

      {/* Сотрудники выбранной фирмы */}
      {selectedFirm && (
        <div className="employees-list">
          <h3 className="employees-title">Сотрудники: {selectedFirm.name}</h3>

          {employees.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <div className="empty-state-text">Нет сотрудников</div>
            </div>
          ) : (
            <div className="employees-grid">
              {employees.map((emp) => (
                <div key={emp.id} className="employee-card">
                  <div className="employee-avatar">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="employee-info">
                    <div className="employee-name">{emp.name}</div>
                    <div className="employee-id">ID: {emp.id}</div>
                  </div>
                  <button
                    className="btn-icon delete"
                    onClick={() => handleDeleteEmployee(emp.id)}
                    title="Удалить"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!selectedFirm && (
        <div className="empty-state">
          <div className="empty-state-icon">👈</div>
          <div className="empty-state-text">Выберите фирму</div>
        </div>
      )}

      {showAddForm && (
        <AddEmployeeForm
          firm={selectedFirm}
          onClose={() => {
            setShowAddForm(false);
            setRefresh(!refresh);
            if (selectedFirm) loadEmployees(selectedFirm.id);
          }}
        />
      )}
    </div>
  );
}

function AddEmployeeForm({ firm, onClose }) {
  const [formData, setFormData] = useState({
    name: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firm) {
      setError("Сначала выберите фирму");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await axios.post(`/api/firms/${firm.id}/employees`, {
        name: formData.name,
        password: formData.password,
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
          <h3>Добавить сотрудника</h3>
          <button className="btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {firm && (
            <div className="form-group">
              <label>Фирма</label>
              <input
                type="text"
                value={firm.name}
                readOnly
                className="form-input"
              />
            </div>
          )}

          <div className="form-group">
            <label>ФИО *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="form-input"
              placeholder="Иванов Иван Иванович"
              required
            />
          </div>

          <div className="form-group">
            <label>Пароль *</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="form-input"
              placeholder="Придумайте пароль"
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
