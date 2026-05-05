import { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { useChat } from "../context/ChatContext";
import { firmsAPI, tasksAPI } from "../api";
import TaskDetail from "../components/TaskDetail";
import "./AdminDashboard.css";

const TYPE_LABELS = {
  payment_request: "📄 Заявка на платеж",
  document_approval: "📋 Согласование документа",
  vacation_request: "🏖️ Заявка на отпуск",
  business_trip: "✈️ Командировка",
  sick_leave: "🤒 Больничный",
  other: "📝 Прочее",
};

const STATUS_MAP = {
  new: { label: "🔴 Новый", color: "#dc2626" },
  in_progress: { label: "🟡 В процессе", color: "#d97706" },
  done: { label: "🟢 Готово", color: "#059669" },
  rejected: { label: "🚫 Отклонено", color: "#6b7280" },
  review: { label: "📋 На рассмотрении", color: "#d97706" },
};

const PRIORITY_MAP = {
  low: { label: "🟢 Низкий", color: "#059669" },
  medium: { label: "🟡 Средний", color: "#d97706" },
  high: { label: "🔴 Высокий", color: "#dc2626" },
};

export default function DirectorDashboard() {
  const { user } = useAuthStore();
  const { setViewTask, viewTask, setChatTask } = useChat();
  const [tasks, setTasks] = useState([]);
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFirm, setSelectedFirm] = useState("");

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getPriorityInfo = (priority) => {
    return PRIORITY_MAP[priority] || PRIORITY_MAP.medium;
  };

  const handleApproveTask = async (taskId) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: "done" } : t)),
        );
      }
    } catch (err) {
      console.error("Error approving task:", err);
    }
  };

  const handleRejectTask = async (taskId, reason = "Причина не указана") => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "rejected",
          rejectionReason: reason,
        }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: "rejected" } : t)),
        );
      }
    } catch (err) {
      console.error("Error rejecting task:", err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("🔍 [Director] Loading data for firm:", user.firmId);

        // Директор видит только свою фирму
        const firmsRes = await firmsAPI.getById(user.firmId);
        console.log("📋 [Director] Firm data:", firmsRes.data);
        setFirms([firmsRes.data]);

        // Получаем задачи только своей фирмы
        const tasksRes = await tasksAPI.getByFirm(user.firmId);
        console.log("📝 [Director] Tasks data:", tasksRes.data);
        console.log(
          "📝 [Director] Tasks count:",
          tasksRes.data?.tasks?.length || 0,
        );
        setTasks(tasksRes.data.tasks || []);

        setSelectedFirm(user.firmId);
      } catch (err) {
        console.error("❌ [Director] Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.firmId) {
      fetchData();
    } else {
      console.error("❌ [Director] No firmId for user:", user);
      setLoading(false);
    }
  }, [user?.firmId]);

  // Фильтруем задачи
  const tasksArray = Array.isArray(tasks) ? tasks : [];
  console.log("🔍 [Director] Total tasks loaded:", tasksArray.length);
  const directorTasks = tasksArray.filter((t) => t.status === "review");
  const otherTasks = tasksArray.filter((t) => t.status !== "review");
  console.log("📋 [Director] Review tasks:", directorTasks.length);
  console.log("📝 [Director] Other tasks:", otherTasks.length);

  const directorStats = {
    review: directorTasks.length,
  };

  const stats = {
    total: otherTasks.length,
    new: otherTasks.filter((t) => t.status === "new").length,
    inProgress: otherTasks.filter((t) => t.status === "in_progress").length,
    done: otherTasks.filter((t) => t.status === "done").length,
    rejected: otherTasks.filter((t) => t.status === "rejected").length,
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="admin-loading">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* Общая статистика */}
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
        <div className="admin-stat-card rejected">
          <span className="admin-stat-value">{stats.rejected}</span>
          <span className="admin-stat-label">Отклонено</span>
        </div>
      </div>

      {/* Раздел для директора - задачи на рассмотрении */}
      <div className="director-section">
        <h2 className="director-title">📋 Задачи на рассмотрении</h2>
        <div className="director-stats">
          <div className="admin-stat-card review">
            <span className="admin-stat-value">{directorStats.review}</span>
            <span className="admin-stat-label">На рассмотрении</span>
          </div>
        </div>

        {/* Таблица задач на рассмотрении */}
        {directorTasks.length === 0 ? (
          <div className="admin-empty" style={{ marginTop: "var(--space-4)" }}>
            <div className="admin-empty-icon">📋</div>
            <p>Задач на рассмотрении нет</p>
          </div>
        ) : (
          <div
            className="admin-table-wrapper"
            style={{ marginTop: "var(--space-4)" }}
          >
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="admin-col-id">№</th>
                  <th className="admin-col-employee">Сотрудник</th>
                  <th className="admin-col-date">Дата</th>
                  <th className="admin-col-type">Тип</th>
                  <th className="admin-col-amount">Сумма</th>
                  <th className="admin-col-status">Статус</th>
                  <th className="admin-col-priority">Приоритет</th>
                  <th className="admin-col-deadline">Дедлайн</th>
                  <th className="admin-col-chat">Чат</th>
                  <th className="admin-col-actions">Действия</th>
                </tr>
              </thead>
              <tbody>
                {directorTasks.map((task) => {
                  return (
                    <tr
                      key={task.id}
                      className="admin-row-review"
                      onClick={() => setViewTask(task)}
                      style={{
                        cursor: "pointer",
                        background: "#fef3c7",
                      }}
                    >
                      <td className="admin-col-id">{task.id}</td>
                      <td className="admin-col-employee">
                        {task.employeeName}
                      </td>
                      <td className="admin-col-date">
                        {formatDate(task.createdAt)}
                      </td>
                      <td className="admin-col-type">
                        {TYPE_LABELS[task.taskType]}
                      </td>
                      <td className="admin-col-amount">
                        {task.taskData?.amount
                          ? `${task.taskData.amount} ₽`
                          : "—"}
                      </td>
                      <td className="admin-col-status">
                        <span className="admin-status-badge review-status">
                          📋 На рассмотрении
                        </span>
                      </td>
                      <td className="admin-col-priority">
                        {
                          getPriorityInfo(task.taskData?.priority || "medium")
                            .label
                        }
                      </td>
                      <td className="admin-col-deadline">
                        {task.taskData?.deadline
                          ? formatDate(task.taskData.deadline)
                          : "—"}
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
                      <td className="admin-col-actions">
                        <button
                          className="admin-approve-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApproveTask(task.id);
                          }}
                          title="Подписать"
                        >
                          ✅ Подписать
                        </button>
                        <button
                          className="admin-reject-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            const reason = prompt(
                              "Укажите причину отклонения:",
                            );
                            if (reason !== null) {
                              handleRejectTask(task.id, reason);
                            }
                          }}
                          title="Отклонить"
                        >
                          ❌ Отклонить
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Остальные задачи (только для просмотра, без удаления) */}
      <div
        className="professional-filters"
        style={{ marginTop: "var(--space-6)" }}
      >
        <div className="filters-toolbar">
          <div className="filters-main">
            <div className="filter-section">
              <div className="filter-section-title">Фирма</div>
              <div className="filter-pills">
                {firms.map((firm) => (
                  <button
                    key={firm.id}
                    className={`filter-pill ${selectedFirm === firm.id ? "active" : ""}`}
                    onClick={() => setSelectedFirm(firm.id)}
                  >
                    {firm.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Таблица остальных задач (без кнопки удаления) */}
      {otherTasks.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">📋</div>
          <p>Задач нет</p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="admin-col-id">№</th>
                <th className="admin-col-employee">Сотрудник</th>
                <th className="admin-col-date">Дата</th>
                <th className="admin-col-type">Тип</th>
                <th className="admin-col-amount">Сумма</th>
                <th className="admin-col-status">Статус</th>
                <th className="admin-col-priority">Приоритет</th>
                <th className="admin-col-deadline">Дедлайн</th>
                <th className="admin-col-chat">Чат</th>
                <th className="admin-col-file">Файл</th>
              </tr>
            </thead>
            <tbody>
              {otherTasks.map((task) => (
                <tr
                  key={task.id}
                  className="admin-row"
                  onClick={() => setViewTask(task)}
                  style={{ cursor: "pointer" }}
                >
                  <td className="admin-col-id">{task.id}</td>
                  <td className="admin-col-employee">{task.employeeName}</td>
                  <td className="admin-col-date">
                    {formatDate(task.createdAt)}
                  </td>
                  <td className="admin-col-type">
                    {TYPE_LABELS[task.taskType]}
                  </td>
                  <td className="admin-col-amount">
                    {task.taskData?.amount ? `${task.taskData.amount} ₽` : "—"}
                  </td>
                  <td className="admin-col-status">
                    {task.status === "rejected" ? (
                      <span
                        className="admin-status-badge"
                        style={{
                          background: "#e5e7eb",
                          color: "#6b7280",
                          border: "1px solid #d1d5db",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontStyle: "italic",
                        }}
                      >
                        🚫 Отклонено
                      </span>
                    ) : (
                      <select
                        className="admin-status-select"
                        value={task.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          console.log(
                            "Director can only change status to review",
                          )
                        }
                      >
                        <option value="new">🔴 Новый</option>
                        <option value="in_progress">🟡 В процессе</option>
                        <option value="done">🟢 Готово</option>
                        <option value="rejected">🚫 Отклонено</option>
                      </select>
                    )}
                  </td>
                  <td className="admin-col-priority">
                    {getPriorityInfo(task.taskData?.priority || "medium").label}
                  </td>
                  <td className="admin-col-deadline">
                    {task.taskData?.deadline
                      ? formatDate(task.taskData.deadline)
                      : "—"}
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
                  <td className="admin-col-file">
                    {task.taskData?.files && task.taskData.files.length > 0 ? (
                      <span title={`${task.taskData.files.length} файл(ов)`}>
                        📎 {task.taskData.files.length}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewTask && (
        <TaskDetail
          task={viewTask}
          onClose={() => setViewTask(null)}
          readOnly={true}
        />
      )}
    </div>
  );
}
