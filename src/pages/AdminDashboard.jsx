import { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { useChat } from "../context/ChatContext";
import { firmsAPI } from "../api";
import TaskChat from "../components/TaskChat";
import TaskDetail from "../components/TaskDetail";
import ConfirmModal from "../components/ConfirmModal";
import "./AdminDashboard.css";

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
            onChange={(e) => setSelectedFirm(e.target.value || null)}
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
      </div>

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
                <th>№</th>
                <th>Фирма</th>
                <th>Сотрудник</th>
                <th>Дата</th>
                <th>Тип</th>
                <th>Описание</th>
                <th>Сумма</th>
                <th>Чат</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => {
                const amount = getTaskAmount(task);
                return (
                  <tr
                    key={task.id}
                    className={!task.seenByAdmin ? "admin-row-unseen" : ""}
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
                    <td
                      className="admin-col-desc admin-col-desc-clickable"
                      onClick={() => handleViewTask(task)}
                    >
                      <span className="admin-desc-text">
                        {getTaskDesc(task) || "—"}
                      </span>
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
                    <td className="admin-col-chat">
                      <button
                        className="admin-chat-btn"
                        onClick={() => setChatTask(task)}
                        title="Открыть чат"
                      >
                        💬
                      </button>
                    </td>
                    <td className="admin-col-status">
                      <select
                        className="admin-status-select"
                        value={task.status}
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
                        onClick={() => setDeleteTask(task)}
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
