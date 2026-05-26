import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "../store/authStore";
import { useChat } from "../context/ChatContext";
import { firmsAPI, tasksAPI } from "../api";
import { getPriorityInfo } from "../utils/priorityHelpers";
import TaskDetail from "../components/TaskDetail";
import "./AdminDashboard.css";

const TYPE_LABELS = {
  payment_request: "Заявка на платеж",
  document_approval: "Согласование документа",
  vacation_request: "Заявка на отпуск",
  business_trip: "Командировка",
  sick_leave: "Больничный",
  other: "Прочее",
};

const STATUS_MAP = {
  new: { label: "Новый", color: "#dc2626" },
  in_progress: { label: "В процессе", color: "#d97706" },
  done: { label: "Готово", color: "#059669" },
  rejected: { label: "Отклонено", color: "#6b7280" },
  review: { label: "На рассмотрении", color: "#d97706" },
};

export default function DirectorDashboard() {
  const { user } = useAuthStore();
  const { setChatTask } = useChat();
  const [viewTask, setViewTask] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFirm, setSelectedFirm] = useState("");
  const [filter, setFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const tableRef = useRef(null);

  const scrollToTable = () => {
    if (tableRef.current) {
      tableRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const handleApproveTask = async (taskId) => {
    try {
      console.log("🔍 [Director] Approving task:", taskId);

      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });

      console.log("📡 [Director] Approve response status:", res.status);

      if (res.ok) {
        const data = await res.json();
        console.log("⚫ [Director] Task approved:", data);
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: "done" } : t)),
        );
      } else {
        const errorData = await res.json();
        console.error("⚫ [Director] Approve error:", errorData);
        alert(
          `Ошибка при подписании: ${errorData.message || "Неизвестная ошибка"}`,
        );
      }
    } catch (err) {
      console.error("⚫ [Director] Network error:", err);
      alert("Ошибка сети при подписании документа");
    }
  };

  const handleRejectTask = async (taskId, reason = "Причина не указана") => {
    try {
      console.log("🔍 [Director] Rejecting task:", taskId, "reason:", reason);

      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "rejected",
          rejectionReason: reason,
        }),
      });

      console.log("📡 [Director] Reject response status:", res.status);

      if (res.ok) {
        const data = await res.json();
        console.log("⚫ [Director] Task rejected:", data);
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: "rejected" } : t)),
        );
      } else {
        const errorData = await res.json();
        console.error("⚫ [Director] Reject error:", errorData);
        alert(
          `Ошибка при отклонении: ${errorData.message || "Неизвестная ошибка"}`,
        );
      }
    } catch (err) {
      console.error("⚫ [Director] Network error:", err);
      alert("Ошибка сети при отклонении документа");
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!isMounted || !user?.firmId) return;

      try {
        console.log("⚫ [Director] Loading data for firm:", user.firmId);

        // Директор видит только свою фирму
        const firmsRes = await firmsAPI.getById(user.firmId);
        if (!isMounted) return;
        console.log("⚫ [Director] Firm data:", firmsRes.data);
        setFirms([firmsRes.data]);

        // Получаем задачи только своей фирмы
        const tasksRes = await tasksAPI.getByFirm(user.firmId);
        if (!isMounted) return;
        console.log("⚫ [Director] Tasks data:", tasksRes.data);
        console.log(
          "⚫ [Director] Tasks count:",
          tasksRes.data?.tasks?.length || 0,
        );
        setTasks(tasksRes.data.tasks || []);

        setSelectedFirm(user.firmId);
      } catch (err) {
        if (isMounted) {
          console.error("⚫ [Director] Error fetching data:", err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (user?.firmId) {
      fetchData();
    } else {
      console.error("⚫ [Director] No firmId for user:", user);
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [user?.firmId]);

  // Фильтруем и сортируем задачи
  const getFilteredTasks = () => {
    let filtered = Array.isArray(tasks) ? [...tasks] : [];

    // Фильтр по типу (review для директора, остальные для основной таблицы)
    // Здесь разделяем на две группы

    // Фильтр по статусу
    if (filter !== "all") {
      filtered = filtered.filter((t) => t.status === filter);
    }

    // Фильтр по приоритету
    if (priorityFilter !== "all") {
      filtered = filtered.filter((t) => {
        const priority = t.taskData?.priority || "medium";
        return priority === priorityFilter;
      });
    }

    // Фильтр по типу задачи
    if (taskTypeFilter !== "all") {
      filtered = filtered.filter((t) => t.taskType === taskTypeFilter);
    }

    // Сортировка
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date":
          return new Date(b.createdAt) - new Date(a.createdAt);
        case "priority":
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          const aPriority = priorityOrder[a.taskData?.priority || "medium"];
          const bPriority = priorityOrder[b.taskData?.priority || "medium"];
          return bPriority - aPriority;
        case "deadline":
          const aDeadline = a.taskData?.deadline
            ? new Date(a.taskData.deadline)
            : new Date("9999-12-31");
          const bDeadline = b.taskData?.deadline
            ? new Date(b.taskData.deadline)
            : new Date("9999-12-31");
          return aDeadline - bDeadline;
        default:
          return 0;
      }
    });

    return filtered;
  };

  const displayTasks = getFilteredTasks();

  // Фильтруем задачи
  const tasksArray = Array.isArray(tasks) ? tasks : [];
  console.log("⚫ [Director] Total tasks loaded:", tasksArray.length);
  const directorTasks = tasksArray.filter((t) => t.status === "review");
  const otherTasks = tasksArray.filter((t) => t.status !== "review");
  console.log("⚫ [Director] Review tasks:", directorTasks.length);
  console.log("⚫ [Director] Other tasks:", otherTasks.length);

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
        <div
          className="admin-stat-card"
          onClick={() => {
            setFilter("all");
            scrollToTable();
          }}
          style={{ cursor: "pointer" }}
        >
          <span className="admin-stat-value">{stats.total}</span>
          <span className="admin-stat-label">Всего задач</span>
        </div>
        <div
          className="admin-stat-card new"
          onClick={() => {
            setFilter("new");
            scrollToTable();
          }}
          style={{ cursor: "pointer" }}
        >
          <span className="admin-stat-value">{stats.new}</span>
          <span className="admin-stat-label">Новые</span>
        </div>
        <div
          className="admin-stat-card in-progress"
          onClick={() => {
            setFilter("in_progress");
            scrollToTable();
          }}
          style={{ cursor: "pointer" }}
        >
          <span className="admin-stat-value">{stats.inProgress}</span>
          <span className="admin-stat-label">В процессе</span>
        </div>
        <div
          className="admin-stat-card done"
          onClick={() => {
            setFilter("done");
            scrollToTable();
          }}
          style={{ cursor: "pointer" }}
        >
          <span className="admin-stat-value">{stats.done}</span>
          <span className="admin-stat-label">Готово</span>
        </div>
        <div
          className="admin-stat-card rejected"
          onClick={() => {
            setFilter("rejected");
            scrollToTable();
          }}
          style={{ cursor: "pointer" }}
        >
          <span className="admin-stat-value">{stats.rejected}</span>
          <span className="admin-stat-label">Отклонено</span>
        </div>
      </div>

      {/* Раздел для директора - задачи на рассмотрении */}
      <div className="director-section">
        <div className="section-header">
          <h2 className="section-title">📋 Задачи на рассмотрении</h2>
          <div className="section-stats">
            <div className="stat-item">
              <span className="stat-value">{directorStats.review}</span>
              <span className="stat-label">Ожидают решения</span>
            </div>
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
                  <th className="admin-col-priority">Приоритет</th>
                  <th className="admin-col-type">Тип</th>
                  <th className="admin-col-deadline">Дедлайн</th>
                  <th className="admin-col-amount">Сумма</th>
                  <th className="admin-col-status">Статус</th>
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
                    >
                      <td className="admin-col-id">{task.id}</td>
                      <td className="admin-col-employee">
                        {task.employeeName}
                      </td>
                      <td className="admin-col-date">
                        {formatDate(task.createdAt)}
                      </td>
                      <td className="admin-col-priority">
                        <span
                          style={{
                            color: getPriorityInfo(
                              task.taskData?.priority || "medium",
                            ).color,
                            fontWeight: "500",
                          }}
                        >
                          {
                            getPriorityInfo(task.taskData?.priority || "medium")
                              .label
                          }
                        </span>
                      </td>
                      <td className="admin-col-type">
                        {TYPE_LABELS[task.taskType]}
                      </td>
                      <td className="admin-col-deadline">
                        {task.taskData?.deadline
                          ? formatDate(task.taskData.deadline)
                          : "—"}
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

      {/* Панель фильтров для остальных задач */}
      <div
        className="professional-filters"
        style={{ marginTop: "var(--space-6)" }}
      >
        <div className="filters-toolbar">
          <div className="filters-main">
            <div className="filter-section">
              <div className="filter-section-title">Приоритет</div>
              <div className="filter-pills">
                {[
                  { id: "all", label: "Все" },
                  { id: "high", label: "Высокий" },
                  { id: "medium", label: "Средний" },
                  { id: "low", label: "Низкий" },
                ].map((f) => (
                  <button
                    key={f.id}
                    className={`filter-pill ${priorityFilter === f.id ? "active" : ""}`}
                    onClick={() => setPriorityFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-section">
              <div className="filter-section-title">Тип задачи</div>
              <div className="filter-pills">
                {[
                  { id: "all", label: "Все типы" },
                  { id: "payment_request", label: "Заявка на оплату" },
                  { id: "invoice", label: "Счёт-фактура" },
                  { id: "other", label: "Прочее" },
                ].map((f) => (
                  <button
                    key={f.id}
                    className={`filter-pill ${taskTypeFilter === f.id ? "active" : ""}`}
                    onClick={() => setTaskTypeFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="filters-secondary">
            <div className="filter-group">
              <div className="filter-section-title">Сортировка</div>
              <select
                className="filter-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="date">По дате</option>
                <option value="priority">По приоритету</option>
                <option value="deadline">По дедлайну</option>
              </select>
            </div>
          </div>
        </div>

        {(priorityFilter !== "all" || taskTypeFilter !== "all") && (
          <div className="filters-status">
            <div className="active-filters-info">
              <span className="filters-count">
                {[
                  priorityFilter !== "all" ? 1 : 0,
                  taskTypeFilter !== "all" ? 1 : 0,
                ].reduce((a, b) => a + b, 0)}{" "}
                фильтров активно
              </span>
              <button
                className="clear-filters-btn"
                onClick={() => {
                  setPriorityFilter("all");
                  setTaskTypeFilter("all");
                  setSortBy("date");
                }}
              >
                Сбросить
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Таблица остальных задач (без кнопки удаления) */}
      {displayTasks.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">📋</div>
          <p>Задач нет</p>
        </div>
      ) : (
        <div className="admin-table-wrapper" ref={tableRef}>
          <table className="admin-table">
            <thead>
              <tr>
                <th className="admin-col-id">№</th>
                <th className="admin-col-employee">Сотрудник</th>
                <th className="admin-col-date">Дата</th>
                <th className="admin-col-priority">Приоритет</th>
                <th className="admin-col-type">Тип</th>
                <th className="admin-col-deadline">Дедлайн</th>
                <th className="admin-col-amount">Сумма</th>
                <th className="admin-col-status">Статус</th>
                <th className="admin-col-chat">Чат</th>
              </tr>
            </thead>
            <tbody>
              {displayTasks.map((task) => (
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
                  <td className="admin-col-priority">
                    <span
                      style={{
                        color: getPriorityInfo(
                          task.taskData?.priority || "medium",
                        ).color,
                        fontWeight: "500",
                      }}
                    >
                      {
                        getPriorityInfo(task.taskData?.priority || "medium")
                          .label
                      }
                    </span>
                  </td>
                  <td className="admin-col-type">
                    {TYPE_LABELS[task.taskType]}
                  </td>
                  <td className="admin-col-deadline">
                    {task.taskData?.deadline
                      ? formatDate(task.taskData.deadline)
                      : "—"}
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
