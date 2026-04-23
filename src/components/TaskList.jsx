import { useState } from "react";
import TaskForms from "./TaskForms";
import "./TaskList.css";

// Типы задач для клиента
const CLIENT_TASK_TYPES = [
  {
    id: "payment_request",
    icon: "💳",
    title: "Заявка на оплату",
    desc: "Выплата, перевод",
  },
  {
    id: "invoice",
    icon: "📄",
    title: "Счёт-фактура",
    desc: "Выставление счёта",
  },
  {
    id: "other",
    icon: "📌",
    title: "Прочее",
    desc: "Иное",
  },
];

export default function TaskList() {
  const [showForm, setShowForm] = useState(false);
  const [selectedTaskType, setSelectedTaskType] = useState(null);

  const handleTaskTypeSelect = (taskType) => {
    setSelectedTaskType(taskType);
    setShowForm(true);
  };

  return (
    <div className="tasks-module">
      <div className="section-header">
        <h2 className="section-title">Создать задачу</h2>
      </div>

      {/* Выбор типа задачи */}
      <div className="task-types-intro">
        <p className="task-types-intro-text">
          Выберите тип задачи для создания:
        </p>
        <div className="task-types-grid">
          {CLIENT_TASK_TYPES.map((type) => (
            <button
              key={type.id}
              className="task-type-btn-large"
              onClick={() => handleTaskTypeSelect(type.id)}
            >
              <span className="task-type-btn-icon">{type.icon}</span>
              <span className="task-type-btn-title">{type.title}</span>
              <span className="task-type-btn-desc">{type.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {showForm && (
        <TaskForms
          taskType={selectedTaskType}
          onClose={() => {
            setShowForm(false);
            setSelectedTaskType(null);
          }}
        />
      )}
    </div>
  );
}
