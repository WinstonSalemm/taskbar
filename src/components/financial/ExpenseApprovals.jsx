import { useState } from "react";
import { financialAPI } from "../../api";
import "./ExpenseApprovals.css";

export default function ExpenseApprovals({ expenses, user, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    subject: "",
    counterparty: "",
    basis: "",
    amount: "",
    plannedDate: "",
    notes: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await financialAPI.createExpense({
        firmId: user.firmId,
        employeeId: user.id,
        ...formData,
        amount: parseFloat(formData.amount)
      });
      
      setShowForm(false);
      setFormData({
        subject: "",
        counterparty: "",
        basis: "",
        amount: "",
        plannedDate: "",
        notes: ""
      });
      onRefresh();
    } catch (error) {
      console.error("Error creating expense:", error);
    }
  };

  const handleStatusChange = async (expenseId, newStatus) => {
    try {
      await financialAPI.updateExpenseStatus(expenseId, { status: newStatus });
      onRefresh();
    } catch (error) {
      console.error("Error updating expense status:", error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: "#6b7280",
      submitted: "#d97706", 
      review: "#3b82f6",
      approved: "#059669",
      paid: "#059669",
      rejected: "#dc2626"
    };
    return colors[status] || "#6b7280";
  };

  const getStatusLabel = (status) => {
    const labels = {
      draft: "Черновик",
      submitted: "Подана",
      review: "На рассмотрении",
      approved: "Согласована",
      paid: "Оплачена",
      rejected: "Отклонена"
    };
    return labels[status] || status;
  };

  // Фильтрация по статусу для разных ролей
  const filteredExpenses = expenses.filter(expense => {
    if (user?.role === "admin" || user?.role === "director") {
      return true; // Видят все заявки
    } else {
      return expense.employee_id === user.id; // Только свои заявки
    }
  });

  const pendingExpenses = filteredExpenses.filter(e => e.status === "submitted");
  const approvedExpenses = filteredExpenses.filter(e => e.status === "approved");

  return (
    <div className="expense-approvals">
      <div className="expense-header">
        <h3>Заявки на расход</h3>
        
        <button 
          className="btn-primary"
          onClick={() => setShowForm(true)}
        >
          + Новая заявка
        </button>
      </div>

      {/* Форма создания заявки */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h4>Новая заявка на расход</h4>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Предмет расхода"
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  required
                />
                <input
                  type="text"
                  placeholder="Контрагент"
                  value={formData.counterparty}
                  onChange={(e) => setFormData({...formData, counterparty: e.target.value})}
                />
              </div>
              
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Основание"
                  value={formData.basis}
                  onChange={(e) => setFormData({...formData, basis: e.target.value})}
                />
                <input
                  type="number"
                  placeholder="Сумма"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-row">
                <input
                  type="date"
                  placeholder="Планируемая дата"
                  value={formData.plannedDate}
                  onChange={(e) => setFormData({...formData, plannedDate: e.target.value})}
                  required
                />
              </div>
              
              <textarea
                placeholder="Примечания"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
              />
              
              <div className="form-actions">
                <button type="submit" className="btn-primary">Подать заявку</button>
                <button type="button" onClick={() => setShowForm(false)}>Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Критически важные - ожидающие согласования */}
      {(user?.role === "admin" || user?.role === "director") && pendingExpenses.length > 0 && (
        <div className="urgent-section">
          <h4>🚨 Требуют согласования ({pendingExpenses.length})</h4>
          <div className="expense-list urgent">
            {pendingExpenses.map(expense => (
              <div key={expense.id} className="expense-item urgent">
                <div className="expense-info">
                  <div className="expense-subject">{expense.subject}</div>
                  <div className="expense-details">
                    <span>Контрагент: {expense.counterparty || "—"}</span>
                    <span>Основание: {expense.basis || "—"}</span>
                    <span>Дата: {expense.planned_date}</span>
                    <span>Автор: {expense.employee_name}</span>
                  </div>
                </div>
                
                <div className="expense-amount">
                  <div className="amount">{parseFloat(expense.amount).toLocaleString()} сум</div>
                  <div className="status" style={{ color: getStatusColor(expense.status) }}>
                    {getStatusLabel(expense.status)}
                  </div>
                </div>
                
                <div className="expense-actions">
                  <button 
                    className="btn-approve"
                    onClick={() => handleStatusChange(expense.id, "approved")}
                  >
                    ✅ Согласовать
                  </button>
                  <button 
                    className="btn-reject"
                    onClick={() => handleStatusChange(expense.id, "rejected")}
                  >
                    ❌ Отклонить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Согласованные расходы */}
      {approvedExpenses.length > 0 && (
        <div className="approved-section">
          <h4>✅ Согласованные расходы ({approvedExpenses.length})</h4>
          <div className="expense-list">
            {approvedExpenses.map(expense => (
              <div key={expense.id} className="expense-item approved">
                <div className="expense-info">
                  <div className="expense-subject">{expense.subject}</div>
                  <div className="expense-details">
                    <span>Контрагент: {expense.counterparty || "—"}</span>
                    <span>Основание: {expense.basis || "—"}</span>
                    <span>Дата: {expense.planned_date}</span>
                    {expense.employee_name && <span>Автор: {expense.employee_name}</span>}
                  </div>
                </div>
                
                <div className="expense-amount">
                  <div className="amount">{parseFloat(expense.amount).toLocaleString()} сум</div>
                  <div className="status" style={{ color: getStatusColor(expense.status) }}>
                    {getStatusLabel(expense.status)}
                  </div>
                </div>
                
                {(user?.role === "admin" || user?.role === "director") && (
                  <div className="expense-actions">
                    <button 
                      className="btn-paid"
                      onClick={() => handleStatusChange(expense.id, "paid")}
                    >
                      💳 Отметить оплаченным
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Все остальные заявки */}
      <div className="all-expenses">
        <h4>Все заявки ({filteredExpenses.length})</h4>
        <div className="expense-list">
          {filteredExpenses.map(expense => (
            <div key={expense.id} className="expense-item">
              <div className="expense-info">
                <div className="expense-subject">{expense.subject}</div>
                <div className="expense-details">
                  <span>Контрагент: {expense.counterparty || "—"}</span>
                  <span>Основание: {expense.basis || "—"}</span>
                  <span>Дата: {expense.planned_date}</span>
                  {expense.employee_name && <span>Автор: {expense.employee_name}</span>}
                </div>
              </div>
              
              <div className="expense-amount">
                <div className="amount">{parseFloat(expense.amount).toLocaleString()} сум</div>
                <div className="status" style={{ color: getStatusColor(expense.status) }}>
                  {getStatusLabel(expense.status)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Пустое состояние */}
      {filteredExpenses.length === 0 && (
        <div className="empty-state">
          <p>Заявки на расход пока не созданы</p>
          <button onClick={() => setShowForm(true)}>
            Создать первую заявку
          </button>
        </div>
      )}
    </div>
  );
}
