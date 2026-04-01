import { create } from 'zustand'

export const useTaskStore = create((set, get) => ({
  tasks: [],
  filteredTasks: [],
  loading: false,
  error: null,
  currentFilter: 'all',
  currentTaskType: null,

  setTasks: (tasks) => set({ 
    tasks, 
    filteredTasks: get().applyFilters(tasks) 
  }),

  addTask: (task) => set((state) => {
    const newTasks = [...state.tasks, task]
    return { 
      tasks: newTasks,
      filteredTasks: get().applyFilters(newTasks)
    }
  }),

  updateTask: (taskId, updates) => set((state) => {
    const newTasks = state.tasks.map(t => 
      t.id === taskId ? { ...t, ...updates } : t
    )
    return {
      tasks: newTasks,
      filteredTasks: get().applyFilters(newTasks)
    }
  }),

  deleteTask: (taskId) => set((state) => {
    const newTasks = state.tasks.filter(t => t.id !== taskId)
    return {
      tasks: newTasks,
      filteredTasks: get().applyFilters(newTasks)
    }
  }),

  setFilter: (filter) => set({ currentFilter: filter }),
  setTaskType: (type) => set({ currentTaskType: type }),

  applyFilters: (tasks) => {
    const { currentFilter, currentTaskType } = get()
    
    let filtered = [...tasks]
    
    if (currentTaskType) {
      filtered = filtered.filter(t => t.taskType === currentTaskType)
    }
    
    if (currentFilter !== 'all') {
      filtered = filtered.filter(t => t.status === currentFilter)
    }
    
    return filtered
  },

  resetFilters: () => set({ currentFilter: 'all', currentTaskType: null }),
}))
