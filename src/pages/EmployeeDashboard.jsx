import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { useTaskStore } from "../store/taskStore";
import { tasksAPI, filesAPI } from "../api";
import TaskDetail from "../components/TaskDetail";
import TaskChat from "../components/TaskChat";
import { useChat } from "../context/ChatContext";

const STATUS_MAP = {
  new: {
    label: "Новый",
    color: "var(--color-danger)",
  },
  in_progress: {
    label: "В процессе",
    color: "var(--color-warning)",
  },
  done: {
    label: "Готово",
    color: "var(--color-success)",
  },
};

const TYPE_LABELS = {
  payment_request: "💳 Заявка на оплату",
  invoice: "📄 Счёт-фактура",
  other: "📌 Прочее",
};

export default function EmployeeDashboard() {
  const { user } = useAuthStore();
  const { setTasks, filteredTasks, setFilter } = useTaskStore();
  const { setChatTask } = useChat();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setLocalFilter] = useState("all");
  const [viewTask, setViewTask] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    console.log("📝 [Dashboard] User:", user);
    console.log("📝 [Dashboard] Firm ID:", user?.firmId);

    if (!user?.firmId) {
      console.error("❌ [Dashboard] No firm ID!");
      return;
    }

    let isMounted = true;

    const loadTasks = async () => {
      try {
        console.log("📝 [Dashboard] Fetching tasks from API...");
        const response = await tasksAPI.getByFirm(user.firmId);
        console.log("✅ [Dashboard] Tasks received:", response.data);

        if (isMounted) {
          setTasks(response.data.tasks || []);
          setLoading(false);
        }
      } catch (err) {
        console.error("❌ [Dashboard] Error fetching tasks:", err);
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    loadTasks();

    // Cleanup
    return () => {
      isMounted = false;
    };
  }, [user?.firmId, setTasks]);

  useEffect(() => {
    setFilter(filter);
  }, [filter, setFilter]);

  const stats = {
    total: filteredTasks.length,
    new: filteredTasks.filter((t) => t.status === "new").length,
    inProgress: filteredTasks.filter((t) => t.status === "in_progress").length,
    done: filteredTasks.filter((t) => t.status === "done").length,
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

  const handleDownload = async (e, taskId, file) => {
    e.stopPropagation();
    setDownloadingId(file.id || taskId);
    try {
      const response = await filesAPI.download(file.id || taskId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", file.fileName || file.file_name || "file");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading file:", err);
      if (file.fileUrl || file.file_url) {
        window.open(file.fileUrl || file.file_url, "_blank");
      }
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading">Загрузка задач...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="error-message">Ошибка: {error}</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="section-header">
        <h2 className="section-title">Задачи фирмы</h2>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Всего задач</div>
        </div>
        <div className="stat-card new">
          <div className="stat-value">{stats.new}</div>
          <div className="stat-label">Новые</div>
        </div>
        <div className="stat-card in-progress">
          <div className="stat-value">{stats.inProgress}</div>
          <div className="stat-label">В работе</div>
        </div>
        <div className="stat-card done">
          <div className="stat-value">{stats.done}</div>
          <div className="stat-label">Готово</div>
        </div>
      </div>

      {/* Фильтры по статусу */}
      <div className="admin-filters" style={{ marginTop: "var(--space-4)" }}>
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
              onClick={() => setLocalFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Таблица задач */}
      {filteredTasks.length === 0 ? (
        <div className="empty-state" style={{ marginTop: "var(--space-6)" }}>
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-text">Задач нет</div>
        </div>
      ) : (
        <div
          className="admin-table-wrapper"
          style={{ marginTop: "var(--space-4)" }}
        >
          <table className="admin-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Сотрудник</th>
                <th>Дата</th>
                <th>Тип</th>
                <th>Сумма</th>
                <th className="admin-col-files">Файлы</th>
                <th>Чат</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => {
                const amount = getTaskAmount(task);
                const isMyTask = task.employeeId === user.id;
                return (
                  <tr
                    key={task.id}
                    onClick={() => setViewTask(task)}
                    style={{ cursor: "pointer" }}
                  >
                    <td className="admin-col-id">{task.id}</td>
                    <td
                      className={`admin-col-employee ${isMyTask ? "my-task-name" : ""}`}
                    >
                      {task.employeeName || "—"}
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
                        <div className="task-files-cell">
                          {task.attachments.map((file, idx) => (
                            <button
                              key={file.id || idx}
                              className="task-file-download-btn"
                              onClick={(e) => handleDownload(e, task.id, file)}
                              disabled={downloadingId === (file.id || task.id)}
                              title={
                                file.fileName || file.file_name || "Скачать"
                              }
                            >
                              {downloadingId === (file.id || task.id)
                                ? "⏳"
                                : "📥"}{" "}
                              {file.fileName ||
                                file.file_name ||
                                `Файл ${idx + 1}`}
                            </button>
                          ))}
                        </div>
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
                      <span
                        className="admin-status-badge"
                        style={{
                          color: STATUS_MAP[task.status]?.color,
                        }}
                      >
                        {STATUS_MAP[task.status]?.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Модалка просмотра задачи */}
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
