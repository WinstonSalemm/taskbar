import { create } from "zustand";

// Чистая функция фильтрации — принимает конкретные значения
function applyFiltersDirect(tasks, filter, taskType) {
  let filtered = [...tasks];

  if (taskType) {
    filtered = filtered.filter((t) => t.taskType === taskType);
  }

  if (filter !== "all") {
    filtered = filtered.filter((t) => t.status === filter);
  }

  return filtered;
}

export const useTaskStore = create((set, get) => ({
  tasks: [],
  filteredTasks: [],
  loading: false,
  error: null,
  currentFilter: "all",
  currentTaskType: null,

  setTasks: (tasks) => {
    console.log("💾 [TaskStore] Setting tasks:", tasks.length);
    set({
      tasks,
      filteredTasks: get().applyFilters(tasks),
    });
  },

  addTask: (task) =>
    set((state) => {
      const newTasks = [...state.tasks, task];
      console.log("💾 [TaskStore] Added task, total:", newTasks.length);
      return {
        tasks: newTasks,
        filteredTasks: get().applyFilters(newTasks),
      };
    }),

  updateTask: (taskId, updates) =>
    set((state) => {
      const newTasks = state.tasks.map((t) =>
        t.id === taskId ? { ...t, ...updates } : t,
      );
      return {
        tasks: newTasks,
        filteredTasks: get().applyFilters(newTasks),
      };
    }),

  deleteTask: (taskId) =>
    set((state) => {
      const newTasks = state.tasks.filter((t) => t.id !== taskId);
      console.log("💾 [TaskStore] Deleted task, total:", newTasks.length);
      return {
        tasks: newTasks,
        filteredTasks: get().applyFilters(newTasks),
      };
    }),

  setFilter: (filter) => {
    console.log("💾 [TaskStore] Setting filter:", filter);
    set((state) => {
      const filtered = applyFiltersDirect(
        state.tasks,
        filter,
        state.currentTaskType,
      );
      return {
        currentFilter: filter,
        filteredTasks: filtered,
      };
    });
  },

  setTaskType: (type) => {
    console.log("💾 [TaskStore] Setting taskType:", type);
    set((state) => {
      const filtered = applyFiltersDirect(
        state.tasks,
        state.currentFilter,
        type,
      );
      return {
        currentTaskType: type,
        filteredTasks: filtered,
      };
    });
  },

  applyFilters: (tasks) => {
    const { currentFilter, currentTaskType } = get();
    return applyFiltersDirect(tasks, currentFilter, currentTaskType);
  },

  resetFilters: () => {
    console.log("💾 [TaskStore] Resetting filters");
    set((state) => ({
      currentFilter: "all",
      currentTaskType: null,
      filteredTasks: applyFiltersDirect(state.tasks, "all", null),
    }));
  },

  // Хелпер для ручной перезагрузки задач
  reloadTasks: async (employeeId) => {
    console.log("🔄 [TaskStore] Reloading tasks for employee:", employeeId);
    try {
      const { tasksAPI } = await import("../api/index.js");
      const response = await tasksAPI.getByEmployee(employeeId);
      set({
        tasks: response.data,
        filteredTasks: get().applyFilters(response.data),
      });
      console.log("✅ [TaskStore] Tasks reloaded:", response.data.length);
    } catch (err) {
      console.error("❌ [TaskStore] Reload failed:", err);
      throw err;
    }
  },
}));
