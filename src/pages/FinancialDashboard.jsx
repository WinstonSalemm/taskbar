import { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { financialAPI } from "../api";
import CashflowOverview from "../components/financial/CashflowOverview";
import ForecastWorkspace from "../components/financial/ForecastWorkspace";
import ExpenseApprovals from "../components/financial/ExpenseApprovals";
import ReconciliationCenter from "../components/financial/ReconciliationCenter";
import "./FinancialDashboard.css";

export default function FinancialDashboard() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState("cashflow");
  const [data, setData] = useState({
    cashflow: [],
    forecasts: [],
    expenses: [],
    reconciliation: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.firmId) {
      loadFinancialData();
    }
  }, [user]);

  const loadFinancialData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 2);

      const [cashflowRes, forecastsRes, expensesRes] = await Promise.all([
        financialAPI.getCashflow(user.firmId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]),
        financialAPI.getForecast(user.firmId, null, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]),
        financialAPI.getExpenses(user.firmId, null, null)
      ]);

      setData({
        cashflow: cashflowRes.data.cashflow || [],
        forecasts: forecastsRes.data.forecast || [],
        expenses: expensesRes.data.expenses || []
      });
    } catch (error) {
      console.error("Error loading financial data:", error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: "cashflow", label: "💰 Cashflow", roles: ["admin", "director"] },
    { id: "forecast", label: "📈 Прогнозы", roles: ["admin", "director", "firm"] },
    { id: "expenses", label: "💳 Расходы", roles: ["admin", "director", "firm"] },
    { id: "reconciliation", label: "🔍 Сверка", roles: ["admin", "director"] }
  ];

  const availableTabs = tabs.filter(tab => tab.roles.includes(user?.role));

  return (
    <div className="financial-dashboard">
      <div className="financial-header">
        <h2>Финансовый рабочий стол</h2>
        <div className="financial-tabs">
          {availableTabs.map(tab => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="financial-content">
        {loading ? (
          <div className="loading">Загрузка финансовых данных...</div>
        ) : (
          <>
            {activeTab === "cashflow" && (
              <CashflowOverview 
                data={data.cashflow} 
                onRefresh={loadFinancialData}
              />
            )}
            
            {activeTab === "forecast" && (
              <ForecastWorkspace 
                forecasts={data.forecasts}
                user={user}
                onRefresh={loadFinancialData}
              />
            )}
            
            {activeTab === "expenses" && (
              <ExpenseApprovals 
                expenses={data.expenses}
                user={user}
                onRefresh={loadFinancialData}
              />
            )}
            
            {activeTab === "reconciliation" && (
              <ReconciliationCenter 
                user={user}
                onRefresh={loadFinancialData}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
