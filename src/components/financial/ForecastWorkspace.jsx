import { useState, useEffect } from "react";
import { financialAPI } from "../../api";
import "./ForecastWorkspace.css";

export default function ForecastWorkspace({ forecasts, user, onRefresh }) {
  const [activeEmployee, setActiveEmployee] = useState("all");
  const [employees, setEmployees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    customerName: "",
    customerInn: "",
    contractNumber: "",
    paymentType: "оплата",
    amount: "",
    expectedDate: "",
    notes: ""
  });

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      // Получаем сотрудников с правами на прогноз
      const response = await financialAPI.getForecastEmployees(user.firmId);
      setEmployees(response.data.employees || []);
    } catch (error) {
      console.error("Error loading employees:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await financialAPI.createForecast({
        firmId: user.firmId,
        employeeId: user.id,
        ...formData,
        amount: parseFloat(formData.amount)
      });
      
      setShowForm(false);
      setFormData({
        customerName: "",
        customerInn: "",
        contractNumber: "",
        paymentType: "оплата",
        amount: "",
        expectedDate: "",
        notes: ""
      });
      onRefresh();
    } catch (error) {
      console.error("Error creating forecast:", error);
    }
  };

  const filteredForecasts = activeEmployee === "all" 
    ? forecasts 
    : forecasts.filter(f => f.employee_id === activeEmployee);

  // Группировка по сотрудникам для динамического отображения
  const forecastsByEmployee = forecasts.reduce((acc, forecast) => {
    if (!acc[forecast.employee_id]) {
      acc[forecast.employee_id] = {
        employee: forecast.employee_name,
        forecasts: [],
        total: 0
      };
    }
    acc[forecast.employee_id].forecasts.push(forecast);
    acc[forecast.employee_id].total += parseFloat(forecast.amount) || 0;
    return acc;
  }, {});

  return (
    <div className="forecast-workspace">
      <div className="forecast-header">
        <h3>Прогнозы поступлений</h3>
        
        {/* Динамический фильтр по сотрудникам */}
        <div className="employee-filter">
          <select 
            value={activeEmployee} 
            onChange={(e) => setActiveEmployee(e.target.value)}
          >
            <option value="all">Все сотрудники</option>
            {Object.values(forecastsByEmployee).map(group => (
              <option key={group.employee} value={group.employee}>
                {group.employee} ({group.forecasts.length} прогнозов)
              </option>
            ))}
          </select>
        </div>

        {(user?.role === "admin" || user?.role === "director") && (
          <button 
            className="btn-primary"
            onClick={() => setShowForm(true)}
          >
            + Добавить прогноз
          </button>
        )}
      </div>

      {/* Форма добавления прогноза */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h4>Новый прогноз поступлений</h4>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Компания покупатель"
                  value={formData.customerName}
                  onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                  required
                />
                <input
                  type="text"
                  placeholder="ИНН"
                  value={formData.customerInn}
                  onChange={(e) => setFormData({...formData, customerInn: e.target.value})}
                />
              </div>
              
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Контракт"
                  value={formData.contractNumber}
                  onChange={(e) => setFormData({...formData, contractNumber: e.target.value})}
                />
                <select
                  value={formData.paymentType}
                  onChange={(e) => setFormData({...formData, paymentType: e.target.value})}
                >
                  <option value="предоплата">Предоплата</option>
                  <option value="оплата">Оплата</option>
                </select>
              </div>
              
              <div className="form-row">
                <input
                  type="number"
                  placeholder="Сумма"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  required
                />
                <input
                  type="date"
                  value={formData.expectedDate}
                  onChange={(e) => setFormData({...formData, expectedDate: e.target.value})}
                  required
                />
              </div>
              
              <textarea
                placeholder="Примечания"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
              />
              
              <div className="form-actions">
                <button type="submit" className="btn-primary">Сохранить</button>
                <button type="button" onClick={() => setShowForm(false)}>Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Динамическое отображение по сотрудникам */}
      <div className="forecast-sections">
        {Object.entries(forecastsByEmployee).map(([employeeId, group]) => (
          <div key={employeeId} className="forecast-section">
            <div className="section-header">
              <h4>{group.employee}</h4>
              <div className="section-total">
                Итого: {group.total.toLocaleString()} сум
              </div>
            </div>
            
            <div className="forecast-list">
              {group.forecasts.map(forecast => (
                <div key={forecast.id} className={`forecast-item ${forecast.status}`}>
                  <div className="forecast-info">
                    <div className="forecast-customer">{forecast.customer_name}</div>
                    <div className="forecast-details">
                      {forecast.customer_inn && <span>ИНН: {forecast.customer_inn}</span>}
                      {forecast.contract_number && <span>Договор: {forecast.contract_number}</span>}
                      <span>Тип: {forecast.payment_type}</span>
                    </div>
                  </div>
                  
                  <div className="forecast-amount">
                    <div className="amount">{parseFloat(forecast.amount).toLocaleString()} сум</div>
                    <div className="date">{forecast.expected_date}</div>
                    <div className="status">{forecast.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Если нет прогнозов */}
      {Object.keys(forecastsByEmployee).length === 0 && (
        <div className="empty-state">
          <p>Прогнозы пока не добавлены</p>
          {(user?.role === "admin" || user?.role === "director") && (
            <button onClick={() => setShowForm(true)}>
              Создать первый прогноз
            </button>
          )}
        </div>
      )}
    </div>
  );
}
