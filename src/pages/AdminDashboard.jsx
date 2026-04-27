import { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { useChat } from "../context/ChatContext";
import { firmsAPI } from "../api";
import TaskChat from "../components/TaskChat";
import TaskDetail from "../components/TaskDetail";
import ConfirmModal from "../components/ConfirmModal";
import axios from "axios";
import "./AdminDashboard.css";

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

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const { setChatTask } = useChat();
  const [tasks, setTasks] = useState([]);
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedFirm, setSelectedFirm] = useState(null);
  const [deleteTask, setDeleteTask] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [viewTask, setViewTask] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [showEmployees, setShowEmployees] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [newRole, setNewRole] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [tasksRes, firmsRes] = await Promise.all([
          fetch("/api/tasks/all"),
          firmsAPI.getAll(),
        ]);
        if (tasksRes.ok) {
          const data = await tasksRes.json();
          setTasks(data.tasks || []);
        }
        setFirms(firmsRes.data || []);
      } catch (err) {
        console.error("Error loading admin data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const filteredTasks = tasks.filter((t) => {
    if (filter !== "all" && t.status !== filter) return false;
    if (selectedFirm && t.firmId !== selectedFirm) return false;
    return true;
  });

  const stats = {
    total: tasks.length,
    new: tasks.filter((t) => t.status === "new").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "done").length,
  };

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

  const getTaskDesc = (task) => {
    if (task.taskType === "payment_request") return task.taskData?.description;
    if (task.taskType === "invoice") return task.taskData?.subject;
    if (task.taskType === "other") return task.taskData?.essence;
    return "";
  };

  const getTaskAmount = (task) => {
    if (task.taskType === "payment_request") return task.taskData?.amount;
    if (task.taskType === "invoice") return task.taskData?.total;
    return null;
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
      );
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const handleDeleteTask = async () => {
    if (!deleteTask) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${deleteTask.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== deleteTask.id));
      } else {
        const data = await res.json();
        alert(data.message || "Ошибка удаления");
      }
    } catch (err) {
      console.error("Error deleting task:", err);
      alert("Ошибка при удалении задачи");
    } finally {
      setDeleting(false);
      setDeleteTask(null);
    }
  };

  const handleViewTask = async (task) => {
    // Отмечаем как просмотренную
    if (!task.seenByAdmin) {
      await fetch(`/api/tasks/${task.id}/seen`, { method: "PATCH" });
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, seenByAdmin: true } : t)),
      );
    }
    setViewTask(task);
  };

  const loadEmployees = async (firmId) => {
    try {
      const response = await fetch(`/api/firms/${firmId}/employees`);
      const data = await response.json();
      setEmployees(data);
    } catch (err) {
      console.error("Error loading employees:", err);
    }
  };

  const handleFirmChange = (firmId) => {
    setSelectedFirm(firmId || null);
    setShowEmployees(false);
    setEmployees([]);
  };

  const handleShowEmployees = () => {
    if (selectedFirm) {
      setShowEmployees(!showEmployees);
      if (!showEmployees) {
        loadEmployees(selectedFirm);
      }
    }
  };

  const handleRoleChange = async (employeeId) => {
    try {
      await axios.patch(`/api/firms/admin/employees/${employeeId}/role`, {
        role: newRole,
      });
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === employeeId ? { ...emp, role: newRole } : emp,
        ),
      );
      setEditingRole(null);
      setNewRole("");
    } catch (err) {
      console.error("Error updating role:", err);
      alert("Ошибка при изменении роли");
    }
  };

  if (loading) return <div className="admin-loading">Загрузка...</div>;

  return (
    <div className="admin-dashboard">
      {/* Статистика */}
      <div className="admin-stats">
        <div className="admin-stat-card">
          <span className="admin-stat-value">{stats.total}</span>
          <span className="admin-stat-label">Всего задач</span>
        </div>
        <div className="admin-stat-card new">
          <span className="admin-stat-value">{stats.new}</span>
          <span className="admin-stat-label">Новые</span>
        </div>
        <div className="admin-stat-card in-progress">
          <span className="admin-stat-value">{stats.inProgress}</span>
          <span className="admin-stat-label">В процессе</span>
        </div>
        <div className="admin-stat-card done">
          <span className="admin-stat-value">{stats.done}</span>
          <span className="admin-stat-label">Готово</span>
        </div>
      </div>

      {/* Фильтры */}
      <div className="admin-filters">
        <div className="admin-firm-filter">
          <select
            value={selectedFirm || ""}
            onChange={(e) => handleFirmChange(e.target.value || null)}
          >
            <option value="">Все фирмы</option>
            {firms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-status-filters">
          {[
            { id: "all", label: "Все" },
            { id: "new", label: "Новые" },
            { id: "review", label: "На рассмотрении" },
            { id: "in_progress", label: "В процессе" },
            { id: "done", label: "Готово" },
          ].map((f) => (
            <button
              key={f.id}
              className={`admin-status-btn ${filter === f.id ? "active" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {selectedFirm && (
          <button
            className="admin-status-btn"
            onClick={handleShowEmployees}
            style={{ marginLeft: "auto" }}
          >
            {showEmployees
              ? "📋 Скрыть сотрудников"
              : "👥 Показать сотрудников"}
          </button>
        )}
      </div>

      {/* Список сотрудников фирмы */}
      {showEmployees && selectedFirm && (
        <div
          className="admin-employees-section"
          style={{ marginTop: "var(--space-4)" }}
        >
          <h3 style={{ marginBottom: "var(--space-3)" }}>
            Сотрудники: {firms.find((f) => f.id === selectedFirm)?.name}
          </h3>
          {employees.length === 0 ? (
            <div className="admin-empty">
              <p>Сотрудников нет</p>
            </div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Имя</th>
                    <th>Роль</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id}>
                      <td>{emp.id}</td>
                      <td>{emp.name}</td>
                      <td>
                        {editingRole === emp.id ? (
                          <select
                            className="admin-status-select"
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value)}
                          >
                            <option value="employee">Сотрудник</option>
                            <option value="director">Директор</option>
                          </select>
                        ) : (
                          <span
                            className={
                              emp.role === "director"
                                ? "admin-role-director"
                                : "admin-role-employee"
                            }
                          >
                            {emp.role === "director"
                              ? "👑 Директор"
                              : "👤 Сотрудник"}
                          </span>
                        )}
                      </td>
                      <td>
                        {editingRole === emp.id ? (
                          <>
                            <button
                              className="admin-chat-btn"
                              onClick={() => handleRoleChange(emp.id)}
                              style={{ marginRight: "8px" }}
                            >
                              ✅
                            </button>
                            <button
                              className="admin-delete-btn"
                              onClick={() => {
                                setEditingRole(null);
                                setNewRole("");
                              }}
                            >
                              ❌
                            </button>
                          </>
                        ) : (
                          <button
                            className="admin-chat-btn"
                            onClick={() => {
                              setEditingRole(emp.id);
                              setNewRole(emp.role || "employee");
                            }}
                            title="Изменить роль"
                          >
                            ✏️
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Таблица задач */}
      {filteredTasks.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">📭</div>
          <p>Задач нет</p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="admin-col-id">№</th>
                <th className="admin-col-firm">Фирма</th>
                <th className="admin-col-employee">Сотрудник</th>
                <th className="admin-col-date">Дата</th>
                <th className="admin-col-type">Тип</th>
                <th className="admin-col-amount">Сумма</th>
                <th className="admin-col-files">Файлы</th>
                <th className="admin-col-chat">Чат</th>
                <th className="admin-col-status">Статус</th>
                <th className="admin-col-delete"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => {
                const amount = getTaskAmount(task);
                return (
                  <tr
                    key={task.id}
                    className={!task.seenByAdmin ? "admin-row-unseen" : ""}
                    onClick={() => handleViewTask(task)}
                    style={{ cursor: "pointer" }}
                  >
                    <td className="admin-col-id">{task.id}</td>
                    <td className="admin-col-firm">{task.firmName || "—"}</td>
                    <td className="admin-col-employee">{task.employeeName}</td>
                    <td className="admin-col-date">
                      {formatDate(task.createdAt)}
                    </td>
                    <td className="admin-col-type">
                      {TYPE_LABELS[task.taskType] || task.taskType}
                    </td>
                    <td className="admin-col-amount">
                      {amount ? (
                        <span className="admin-amount">
                          {amount.toLocaleString("ru-RU")} сўм
                        </span>
                      ) : (
                        <span className="admin-empty-cell">—</span>
                      )}
                    </td>
                    <td className="admin-col-files">
                      {task.attachments && task.attachments.length > 0 ? (
                        <span className="admin-files-count">
                          📎 {task.attachments.length}
                        </span>
                      ) : (
                        <span className="admin-empty-cell">—</span>
                      )}
                    </td>
                    <td className="admin-col-chat">
                      <button
                        className="admin-chat-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setChatTask(task);
                        }}
                        title="Открыть чат"
                      >
                        💬
                      </button>
                    </td>
                    <td className="admin-col-status">
                      <select
                        className="admin-status-select"
                        value={task.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          handleStatusChange(task.id, e.target.value)
                        }
                      >
                        <option value="new">🔴 Новый</option>
                        <option value="in_progress">🟡 В процессе</option>
                        <option value="done">🟢 Готово</option>
                      </select>
                    </td>
                    <td className="admin-col-delete">
                      <button
                        className="admin-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTask(task);
                        }}
                        title="Удалить задачу"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Модалка подтверждения удаления */}
      {deleteTask && (
        <ConfirmModal
          title="Удалить задачу?"
          message={`Задача #${deleteTask.id} будет удалена вместе со всеми файлами и сообщениями. Это действие нельзя отменить.`}
          onConfirm={handleDeleteTask}
          onCancel={() => setDeleteTask(null)}
          confirmText="Да, удалить"
          cancelText="Отмена"
          loading={deleting}
        />
      )}

      {/* Модалка просмотра задачи */}
      {viewTask && (
        <TaskDetail
          task={viewTask}
          onClose={() => setViewTask(null)}
          onStatusChange={async (newStatus) => {
            await fetch(`/api/tasks/${viewTask.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: newStatus }),
            });
            setTasks((prev) =>
              prev.map((t) =>
                t.id === viewTask.id ? { ...t, status: newStatus } : t,
              ),
            );
            setViewTask((prev) => ({ ...prev, status: newStatus }));
          }}
        />
      )}
    </div>
  );
}
