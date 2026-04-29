// Утилиты для работы с приоритетами и дедлайнами

export const PRIORITY_CONFIG = {
  low: {
    label: 'Низкий',
    color: '#6b7280',
    bgColor: '#f3f4f6',
    icon: '🟢'
  },
  medium: {
    label: 'Средний',
    color: '#3b82f6',
    bgColor: '#dbeafe',
    icon: '🔵'
  },
  high: {
    label: 'Высокий',
    color: '#f59e0b',
    bgColor: '#fef3c7',
    icon: '🟠'
  },
  critical: {
    label: 'Критический',
    color: '#ef4444',
    bgColor: '#fee2e2',
    icon: '🔴'
  }
};

export const getPriorityInfo = (priority = 'medium') => {
  return PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
};

// Вычисление статуса дедлайна
export const getDeadlineStatus = (task) => {
  const now = new Date();
  const actualDeadline = task.actualDeadline ? new Date(task.actualDeadline) : null;
  const requestedDeadline = task.requestedDeadline ? new Date(task.requestedDeadline) : null;
  const completedAt = task.completedAt ? new Date(task.completedAt) : null;
  
  // Если задача завершена
  if (task.status === 'done' && completedAt) {
    if (actualDeadline && completedAt > actualDeadline) {
      return {
        status: 'completed_late',
        label: 'Завершено с опозданием',
        color: '#ef4444',
        daysOverdue: Math.ceil((completedAt - actualDeadline) / (1000 * 60 * 60 * 24))
      };
    } else if (actualDeadline && completedAt <= actualDeadline) {
      return {
        status: 'completed_on_time',
        label: 'Завершено вовремя',
        color: '#10b981'
      };
    }
  }
  
  // Если задача не завершена
  if (task.status !== 'done' && actualDeadline) {
    if (now > actualDeadline) {
      const daysOverdue = Math.ceil((now - actualDeadline) / (1000 * 60 * 60 * 24));
      return {
        status: 'overdue',
        label: `Просрочено на ${daysOverdue} дн.`,
        color: '#ef4444',
        daysOverdue
      };
    } else {
      const daysLeft = Math.ceil((actualDeadline - now) / (1000 * 60 * 60 * 24));
      return {
        status: 'on_time',
        label: daysLeft === 0 ? 'Сегодня' : `${daysLeft} дн.`,
        color: daysLeft <= 3 ? '#f59e0b' : '#10b981',
        daysLeft
      };
    }
  }
  
  // Если нет actual_deadline, но есть requested_deadline
  if (task.status !== 'done' && requestedDeadline) {
    const daysLeft = Math.ceil((requestedDeadline - now) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) {
      return {
        status: 'overdue',
        label: `Желаемый срок просрочен`,
        color: '#ef4444'
      };
    } else {
      return {
        status: 'requested',
        label: daysLeft === 0 ? 'Желаемый срок сегодня' : `Желаемый: ${daysLeft} дн.`,
        color: daysLeft <= 3 ? '#f59e0b' : '#6b7280'
      };
    }
  }
  
  return null;
};

// Форматирование даты
export const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
};

// Сортировка задач по приоритету и дедлайну
export const sortTasksByPriority = (tasks) => {
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  
  return tasks.sort((a, b) => {
    // Сначала сортируем по приоритету
    const priorityDiff = priorityOrder[a.priority || 'medium'] - priorityOrder[b.priority || 'medium'];
    if (priorityDiff !== 0) return priorityDiff;
    
    // Затем по статусу дедлайна
    const aDeadlineStatus = getDeadlineStatus(a);
    const bDeadlineStatus = getDeadlineStatus(b);
    
    // Просроченные задачи идут первыми
    if (aDeadlineStatus?.status === 'overdue' && bDeadlineStatus?.status !== 'overdue') return -1;
    if (bDeadlineStatus?.status === 'overdue' && aDeadlineStatus?.status !== 'overdue') return 1;
    
    // Затем по дате создания
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
};
