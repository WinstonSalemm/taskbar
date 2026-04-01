import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useTaskStore = create(
  persist(
    (set, get) => ({
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
          return {
            tasks: newTasks,
            filteredTasks: get().applyFilters(newTasks),
          };
        }),

      setFilter: (filter) => {
        console.log("💾 [TaskStore] Setting filter:", filter);
        set({ currentFilter: filter });
      },

      setTaskType: (type) => {
        console.log("💾 [TaskStore] Setting taskType:", type);
        set({ currentTaskType: type });
      },

      applyFilters: (tasks) => {
        const { currentFilter, currentTaskType } = get();

        let filtered = [...tasks];

        if (currentTaskType) {
          filtered = filtered.filter((t) => t.taskType === currentTaskType);
        }

        if (currentFilter !== "all") {
          filtered = filtered.filter((t) => t.status === currentFilter);
        }

        return filtered;
      },

      resetFilters: () => {
        console.log("💾 [TaskStore] Resetting filters");
        set({ currentFilter: "all", currentTaskType: null });
      },
    }),
    {
      name: "task-storage",
      partialize: (state) => ({
        tasks: state.tasks,
        currentFilter: state.currentFilter,
        currentTaskType: state.currentTaskType,
      }),
    },
  ),
);
