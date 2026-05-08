import { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { useChat } from "../context/ChatContext";
import { firmsAPI, tasksAPI } from "../api";
import { getPriorityInfo } from "../utils/priorityHelpers";
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
  payment_request: "Заявка на оплату",
  invoice: "Счёт-фактура",
  other: "Прочее",
};

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

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
  const [chatTask, setChatTaskState] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log("📡 [AdminDashboard] Loading admin data...");

        // Загружаем фирмы
        const firmsRes = await firmsAPI.getAll();
        const firmsData = firmsRes.data;
        console.log("✅ [AdminDashboard] Firms loaded:", firmsData);
        setFirms(firmsData || []);

        // Для админа загружаем задачи со всех фирм
        const allTasks = [];
        for (const firm of firmsData || []) {
          try {
            const tasksRes = await tasksAPI.getByFirm(firm.id);
            console.log(
              `📡 [AdminDashboard] API response for firm ${firm.name}:`,
              tasksRes,
            );
            const firmTasks = Array.isArray(tasksRes.data.tasks)
              ? tasksRes.data.tasks
              : [];
            console.log(
              `📋 [AdminDashboard] Tasks for firm ${firm.name}:`,
              firmTasks.length,
            );
            allTasks.push(...firmTasks);
          } catch (err) {
            console.warn(
              `⚠️ [AdminDashboard] Failed to load tasks for firm ${firm.name}:`,
              err,
            );
          }
        }

        console.log("✅ [AdminDashboard] All tasks loaded:", allTasks.length);
        setTasks(allTasks);
      } catch (err) {
        console.error("❌ [AdminDashboard] Error loading admin data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Фильтрация по всем параметрам
  const getFilteredTasks = () => {
    let filtered = Array.isArray(tasks) ? [...tasks] : [];

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
  const tasksArray = Array.isArray(tasks) ? tasks : [];
  const adminTasks = tasksArray.filter((t) => t.status !== "review");
  const directorTasks = tasksArray.filter((t) => t.status === "review");

  const stats = {
    total: adminTasks.length,
    new: adminTasks.filter((t) => t.status === "new").length,
    inProgress: adminTasks.filter((t) => t.status === "in_progress").length,
    done: adminTasks.filter((t) => t.status === "done").length,
    rejected: adminTasks.filter((t) => t.status === "rejected").length,
  };

  const directorStats = {
    review: directorTasks.length,
  };

  const handleFirmChange = (firmId) => {
    setSelectedFirm(firmId);
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
        );
      }
    } catch (err) {
      console.error("Error updating task status:", err);
    }
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

  if (loading) return <div className="admin-loading">Загрузка...</div>;

  return (
    <div className="admin-dashboard">
      {/* Статистика */}
      <div className="admin-stats">
        <div className="admin-stat-card">
          <span className="admin-stat-value">{stats.total}</span>
          <span className="admin-stat-label">Всего</span>
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
                </tr>
              </thead>
              <tbody>
                {directorTasks.map((task) => {
                  const comments = task.comments || [];

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
                      <td className="admin-col-deadline">
                        {task.taskData?.deadline
                          ? formatDate(task.taskData.deadline)
                          : "—"}
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
              {displayTasks.map((task) => {
                const comments = task.comments || [];
                const isMyTask =
                  user?.role === "admin" || task.employeeId === user?.id;
                const rejectionReason = (() => {
                  const rejectionComment = comments.find(
                    (comment) =>
                      (typeof comment === "string" &&
                        comment.includes("Отклонено")) ||
                      (comment.text && comment.text.includes("Отклонено")),
                  );

                  if (rejectionComment) {
                    const text =
                      typeof rejectionComment === "string"
                        ? rejectionComment
                        : rejectionComment.text;
                    const reasonText = text.replace(
                      /.*Отклонено\.? Причина:\s*/,
                      "",
                    );
                    return reasonText.length > 50
                      ? reasonText.substring(0, 50) + "..."
                      : reasonText;
                  }

                  return "Причина не указана";
                })();

                return (
                  <tr
                    key={task.id}
                    className={`admin-row-unseen ${
                      task.status === "rejected" ? "admin-row-rejected" : ""
                    }`}
                    onClick={() => setViewTask(task)}
                    style={{
                      cursor: "pointer",
                      opacity: filter === "rejected" ? 0.7 : 1,
                    }}
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
                      {task.taskData?.amount
                        ? `${task.taskData.amount} ₽`
                        : "—"}
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
                            handleStatusChange(task.id, e.target.value)
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
                          setChatTaskState(task);
                          setChatTask(task);
                        }}
                        title="Открыть чат"
                      >
                        💬
                      </button>
                    </td>
                    <td className="admin-col-actions">
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

      {/* Split-screen для чата */}
      {chatTask && (
        <div className="split-screen-container">
          <div
            className="task-detail-panel"
            style={{
              flex: "0 0 50%",
              minWidth: "360px",
            }}
          >
            <TaskDetail
              task={chatTask}
              onClose={() => setChatTaskState(null)}
              readOnly={true}
              isSplitScreen={true}
            />
          </div>

          <div
            className="resizer"
            style={{
              flex: "0 0 4px",
              cursor: "col-resize",
            }}
          />

          <div
            className="task-chat"
            style={{
              flex: "0 0 50%",
              minWidth: "360px",
            }}
          >
            <TaskChat task={chatTask} />
          </div>
        </div>
      )}

      {/* Модалка просмотра задачи */}
      {viewTask && (
        <TaskDetail
          task={viewTask}
          onClose={() => setViewTask(null)}
          onStatusChange={async (newStatus) => {
            await axios.put(`/api/tasks/${viewTask.id}`, {
              status: newStatus,
            });
            // Перезагружаем задачи для всех фирм
            const allTasks = [];
            for (const firm of firms) {
              try {
                const tasksRes = await tasksAPI.getByFirm(firm.id);
                const firmTasks = Array.isArray(tasksRes.data.tasks)
                  ? tasksRes.data.tasks
                  : [];
                allTasks.push(...firmTasks);
              } catch (err) {
                console.warn(
                  `Failed to reload tasks for firm ${firm.name}:`,
                  err,
                );
              }
            }
            setTasks(allTasks);
            setViewTask((prev) => ({ ...prev, status: newStatus }));
          }}
          readOnly={false}
        />
      )}
    </div>
  );
}
