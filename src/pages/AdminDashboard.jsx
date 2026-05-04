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
  rejected: { label: "Отклонено", color: "#6b7280", bg: "#f3f4f6" },
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
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
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

  // Фильтрация по всем параметрам
  const getFilteredTasks = () => {
    let filtered = [...tasks];

    // Админ не видит задачи со статусом "на рассмотрении"
    filtered = filtered.filter((t) => t.status !== "review");

    // Фильтр по фирме
    if (selectedFirm) {
      filtered = filtered.filter((t) => t.firmId === selectedFirm);
    }

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

  // Функция для получения названия статуса
  const getStatusLabel = (status) => {
    switch (status) {
      case "new":
        return "🔴 Новые";
      case "in_progress":
        return "🟡 В процессе";
      case "done":
        return "🟢 Готово";
      case "rejected":
        return "🚫 Отклонено";
      default:
        return "Все";
    }
  };

  // Статистика по задачам (админ не видит задачи со статусом "review")
  const adminTasks = tasks.filter((t) => t.status !== "review");
  const stats = {
    total: adminTasks.length,
    new: adminTasks.filter((t) => t.status === "new").length,
    inProgress: adminTasks.filter((t) => t.status === "in_progress").length,
    done: adminTasks.filter((t) => t.status === "done").length,
    rejected: adminTasks.filter((t) => t.status === "rejected").length,
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

  const handleFirmChange = (firmId) => {
    setSelectedFirm(firmId || null);
  };

  // Компонент для отображения таблицы задач по статусу
  const TaskTable = ({ title, tasks, statusKey }) => {
    const getStatusLabel = (status) => {
      switch (status) {
        case "new":
          return "🔴 Новые задачи";
        case "in_progress":
          return "🟡 В процессе";
        case "done":
          return "🟢 Готово";
        case "rejected":
          return "🚫 Отклонено";
        default:
          return title;
      }
    };

    return (
      <div style={{ marginTop: "var(--space-6)" }}>
        <h3
          style={{
            margin: "0 0 var(--space-3) 0",
            fontSize: "var(--font-size-lg)",
            fontWeight: "var(--font-weight-semibold)",
            color:
              statusKey === "rejected"
                ? "var(--color-text-muted)"
                : "var(--color-text-primary)",
          }}
        >
          {getStatusLabel(statusKey)} ({tasks.length})
        </h3>
        {tasks.length === 0 ? (
          <div className="admin-empty" style={{ marginTop: "var(--space-4)" }}>
            <p>Задач в этом состоянии - нет</p>
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
                  {statusKey === "rejected" && (
                    <th className="admin-col-status">Причина отказа</th>
                  )}
                  <th className="admin-col-delete"></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const amount = getTaskAmount(task);
                  const rejectionReason = (() => {
                    if (statusKey !== "rejected") return null;
                    const comments = Array.isArray(task.comments)
                      ? task.comments
                      : [];
                    const rejectionComment = comments.find(
                      (comment) =>
                        (typeof comment === "string" &&
                          comment.includes("Отклонено")) ||
                        (comment.text && comment.text.includes("Отклонено")),
                    );

                    if (rejectionComment) {
                      const reasonText =
                        typeof rejectionComment === "string"
                          ? rejectionComment.replace(
                              /.*Отклонено\.? Причина:\s*/,
                              "",
                            )
                          : rejectionComment.text.replace(
                              /.*Отклонено\.? Причина:\s*/,
                              "",
                            );
                      return reasonText.length > 50
                        ? reasonText.substring(0, 50) + "..."
                        : reasonText;
                    }

                    const rejectedComment = comments.find(
                      (comment) =>
                        (typeof comment === "string" &&
                          comment.includes("Отклонено")) ||
                        (comment.text && comment.text.includes("Отклонено")),
                    );

                    if (rejectedComment) {
                      const text =
                        typeof rejectedComment === "string"
                          ? rejectedComment
                          : rejectedComment.text;
                      return text.length > 50
                        ? text.substring(0, 50) + "..."
                        : text;
                    }

                    return "Причина не указана";
                  })();

                  return (
                    <tr
                      key={task.id}
                      onClick={() => handleViewTask(task)}
                      style={{
                        cursor: "pointer",
                        opacity: statusKey === "rejected" ? 0.7 : 1,
                      }}
                    >
                      <td className="admin-col-id">{task.id}</td>
                      <td className="admin-col-firm">{task.firmName || "—"}</td>
                      <td className="admin-col-employee">
                        {task.employeeName}
                      </td>
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
                      {statusKey === "rejected" && (
                        <td className="admin-col-status">
                          <span
                            className="admin-status-badge"
                            style={{
                              color: STATUS_MAP.rejected.color,
                              backgroundColor: STATUS_MAP.rejected.bg,
                              fontSize: "12px",
                              maxWidth: "200px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              display: "inline-block",
                            }}
                            title={rejectionReason}
                          >
                            {rejectionReason}
                          </span>
                        </td>
                      )}
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
      </div>
    );
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

      {/* Профессиональная панель фильтров для админа */}
      <div
        className="professional-filters"
        style={{ marginTop: "var(--space-6)" }}
      >
        <div className="filters-toolbar">
          {/* Левая часть - основные фильтры */}
          <div className="filters-main">
            <div className="filter-section">
              <div className="filter-section-title">Фирма</div>
              <select
                className="filter-select"
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

            <div className="filter-section">
              <div className="filter-section-title">Статус</div>
              <div className="filter-pills">
                {[
                  { id: "all", label: "Все" },
                  { id: "new", label: "Новые" },
                  { id: "in_progress", label: "В работе" },
                  { id: "done", label: "Готово" },
                  { id: "rejected", label: "Отклонено" },
                ].map((f) => (
                  <button
                    key={f.id}
                    className={`filter-pill ${filter === f.id ? "active" : ""}`}
                    onClick={() => setFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

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
          </div>

          {/* Правая часть - дополнительные опции */}
          <div className="filters-secondary">
            <div className="filter-group">
              <div className="filter-section-title">Тип задачи</div>
              <select
                className="filter-select"
                value={taskTypeFilter}
                onChange={(e) => setTaskTypeFilter(e.target.value)}
              >
                <option value="all">Все типы</option>
                <option value="payment_request">Заявка на оплату</option>
                <option value="invoice">Счёт-фактура</option>
                <option value="other">Прочее</option>
              </select>
            </div>

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

        {/* Индикатор активных фильтров */}
        {(filter !== "all" ||
          priorityFilter !== "all" ||
          taskTypeFilter !== "all" ||
          selectedFirm !== null) && (
          <div className="filters-status">
            <div className="active-filters-info">
              <span className="filters-count">
                {[
                  filter !== "all" ? 1 : 0,
                  priorityFilter !== "all" ? 1 : 0,
                  taskTypeFilter !== "all" ? 1 : 0,
                  selectedFirm !== null ? 1 : 0,
                ].reduce((a, b) => a + b, 0)}{" "}
                фильтров активно
              </span>
              <button
                className="clear-filters-btn"
                onClick={() => {
                  setFilter("all");
                  setPriorityFilter("all");
                  setTaskTypeFilter("all");
                  setSortBy("date");
                  setSelectedFirm(null);
                }}
              >
                Сбросить
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Таблица задач */}
      {displayTasks.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">📭</div>
          <p>
            {filter === "all"
              ? selectedFirm
                ? `Задач у фирмы "${firms.find((f) => f.id === selectedFirm)?.name}" нет`
                : "Задач нет"
              : `Задач со статусом "${getStatusLabel(filter)}" нет`}
          </p>
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
                {filter === "rejected" && (
                  <th className="admin-col-status">Причина отказа</th>
                )}
                <th className="admin-col-delete"></th>
              </tr>
            </thead>
            <tbody>
              {displayTasks.map((task) => {
                const amount = getTaskAmount(task);
                const rejectionReason = (() => {
                  if (filter !== "rejected") return null;
                  const comments = Array.isArray(task.comments)
                    ? task.comments
                    : [];
                  const rejectionComment = comments.find(
                    (comment) =>
                      (typeof comment === "string" &&
                        comment.includes("Отклонено")) ||
                      (comment.text && comment.text.includes("Отклонено")),
                  );

                  if (rejectionComment) {
                    const reasonText =
                      typeof rejectionComment === "string"
                        ? rejectionComment.replace(
                            /.*Отклонено\.? Причина:\s*/,
                            "",
                          )
                        : rejectionComment.text.replace(
                            /.*Отклонено\.? Причина:\s*/,
                            "",
                          );
                    return reasonText.length > 50
                      ? reasonText.substring(0, 50) + "..."
                      : reasonText;
                  }

                  const rejectedComment = comments.find(
                    (comment) =>
                      (typeof comment === "string" &&
                        comment.includes("Отклонено")) ||
                      (comment.text && comment.text.includes("Отклонено")),
                  );

                  if (rejectedComment) {
                    const text =
                      typeof rejectedComment === "string"
                        ? rejectedComment
                        : rejectedComment.text;
                    return text.length > 50
                      ? text.substring(0, 50) + "..."
                      : text;
                  }

                  return "Причина не указана";
                })();

                return (
                  <tr
                    key={task.id}
                    onClick={() => handleViewTask(task)}
                    style={{
                      cursor: "pointer",
                      opacity: filter === "rejected" ? 0.7 : 1,
                    }}
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
                    {filter === "rejected" && (
                      <td className="admin-col-status">
                        <span
                          className="admin-status-badge"
                          style={{
                            color: STATUS_MAP.rejected.color,
                            backgroundColor: STATUS_MAP.rejected.bg,
                            fontSize: "12px",
                            maxWidth: "200px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "inline-block",
                          }}
                          title={rejectionReason}
                        >
                          {rejectionReason}
                        </span>
                      </td>
                    )}
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
