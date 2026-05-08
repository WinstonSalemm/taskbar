import { useState, useMemo } from "react";
import "./CashflowOverview.css";

export default function CashflowOverview({ data, onRefresh }) {
  const [viewMode, setViewMode] = useState("table"); // table, chart
  
  // Агрегация данных как в Excel
  const aggregatedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Группируем по дням и считаем остатки
    let runningBalance = 588565821.44; // Начальный остаток из Excel
    
    return data.map(day => {
      const income = parseFloat(day.actual_income || day.forecast_income || 0);
      const expense = parseFloat(day.actual_expense || day.forecast_expense || 0);
      
      runningBalance = runningBalance + income - expense;
      
      return {
        date: day.date,
        income,
        expense,
        balance: runningBalance,
        forecastIncome: parseFloat(day.forecast_income || 0),
        forecastExpense: parseFloat(day.forecast_expense || 0)
      };
    });
  }, [data]);

  // Итоги за период
  const totals = useMemo(() => {
    return aggregatedData.reduce((acc, day) => ({
      totalIncome: acc.totalIncome + day.income,
      totalExpense: acc.totalExpense + day.expense,
      totalForecastIncome: acc.totalForecastIncome + day.forecastIncome,
      totalForecastExpense: acc.totalForecastExpense + day.forecastExpense
    }), {
      totalIncome: 0,
      totalExpense: 0,
      totalForecastIncome: 0,
      totalForecastExpense: 0
    });
  }, [aggregatedData]);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit'
    });
  };

  return (
    <div className="cashflow-overview">
      <div className="cashflow-header">
        <h3>Обзор движения средств</h3>
        
        <div className="view-controls">
          <div className="view-toggle">
            <button 
              className={viewMode === "table" ? "active" : ""}
              onClick={() => setViewMode("table")}
            >
              📊 Таблица
            </button>
            <button 
              className={viewMode === "chart" ? "active" : ""}
              onClick={() => setViewMode("chart")}
            >
              📈 График
            </button>
          </div>
          
          <button onClick={onRefresh} className="refresh-btn">
            🔄 Обновить
          </button>
        </div>
      </div>

      {/* Итоги как в Excel */}
      <div className="cashflow-summary">
        <div className="summary-row opening">
          <span>СН (Начальный остаток):</span>
          <span>588,565,821.44 сум</span>
        </div>
        
        <div className="summary-row income">
          <span>ПОСТУПЛЕНИЯ:</span>
          <span>{totals.totalIncome.toLocaleString()} сум</span>
        </div>
        
        <div className="summary-row expense">
          <span>РАСХОД:</span>
          <span>{totals.totalExpense.toLocaleString()} сум</span>
        </div>
        
        <div className="summary-row closing">
          <span>СК (Конечный остаток):</span>
          <span>
            {(588565821.44 + totals.totalIncome - totals.totalExpense).toLocaleString()} сум
          </span>
        </div>
      </div>

      {/* Таблица движения средств */}
      {viewMode === "table" && (
        <div className="cashflow-table-container">
          <table className="cashflow-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Поступления</th>
                <th>Расходы</th>
                <th>Остаток</th>
                <th>Прогноз поступлений</th>
                <th>Прогноз расходов</th>
                <th>Отклонение</th>
              </tr>
            </thead>
            <tbody>
              {aggregatedData.map((day, index) => {
                const deviation = day.income - day.forecastIncome;
                return (
                  <tr key={index}>
                    <td>{formatDate(day.date)}</td>
                    <td className="income">
                      {day.income > 0 ? day.income.toLocaleString() : "-"}
                    </td>
                    <td className="expense">
                      {day.expense > 0 ? day.expense.toLocaleString() : "-"}
                    </td>
                    <td className="balance">
                      {day.balance.toLocaleString()}
                    </td>
                    <td className="forecast">
                      {day.forecastIncome > 0 ? day.forecastIncome.toLocaleString() : "-"}
                    </td>
                    <td className="forecast">
                      {day.forecastExpense > 0 ? day.forecastExpense.toLocaleString() : "-"}
                    </td>
                    <td className={`deviation ${deviation >= 0 ? "positive" : "negative"}`}>
                      {deviation !== 0 ? `${deviation >= 0 ? "+" : ""}${deviation.toLocaleString()}` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* График */}
      {viewMode === "chart" && (
        <div className="cashflow-chart">
          <div className="chart-placeholder">
            <p>📈 График движения средств</p>
            <p>Здесь будет интерактивный график остатков по дням</p>
            {/* TODO: Интегрировать Chart.js или Recharts */}
          </div>
        </div>
      )}

      {/* Ключевые метрики */}
      <div className="cashflow-metrics">
        <div className="metric-card">
          <h4>Средний дневной доход</h4>
          <div className="metric-value">
            {aggregatedData.length > 0 
              ? Math.round(totals.totalIncome / aggregatedData.length).toLocaleString()
              : 0
            } сум
          </div>
        </div>
        
        <div className="metric-card">
          <h4>Средний дневной расход</h4>
          <div className="metric-value">
            {aggregatedData.length > 0 
              ? Math.round(totals.totalExpense / aggregatedData.length).toLocaleString()
              : 0
            } сум
          </div>
        </div>
        
        <div className="metric-card">
          <h4>Точность прогнозов</h4>
          <div className="metric-value">
            {totals.totalForecastIncome > 0 
              ? Math.round((totals.totalIncome / totals.totalForecastIncome) * 100)
              : 0
            }%
          </div>
        </div>
      </div>
    </div>
  );
}
