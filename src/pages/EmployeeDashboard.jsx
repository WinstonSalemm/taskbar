import { useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { useApi } from "../hooks/useApi";
import { tasksAPI } from "../api";
import { useTaskStore } from "../store/taskStore";

export default function EmployeeDashboard() {
  const { user } = useAuthStore();
  const { setTasks, filteredTasks } = useTaskStore();
  const { data, execute } = useApi(() => tasksAPI.getByEmployee(user?.id));

  useEffect(() => {
    console.log("📝 [Dashboard] User:", user);
    console.log("📝 [Dashboard] Employee ID:", user?.id);

    if (!user?.id) {
      console.error("❌ [Dashboard] No employee ID!");
      return;
    }

    console.log("📝 [Dashboard] Fetching tasks from API...");
    execute()
      .then((res) => {
        console.log("✅ [Dashboard] Tasks received:", res);
        setTasks(res || []);
      })
      .catch((err) => {
        console.error("❌ [Dashboard] Error fetching tasks:", err);
      });
  }, [user?.id]); // Перезагружать при смене user

  const stats = {
    total: filteredTasks.length,
    new: filteredTasks.filter((t) => t.status === "new").length,
    inProgress: filteredTasks.filter((t) => t.status === "in_progress").length,
    done: filteredTasks.filter((t) => t.status === "done").length,
  };

  return (
    <div className="dashboard">
      <div className="section-header">
        <h2 className="section-title">Мои задачи</h2>
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
    </div>
  );
}
