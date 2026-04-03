import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { authAPI, firmsAPI } from "../api";

export default function Login() {
  const [step, setStep] = useState(1); // 1: email, 2: employee, 3: password
  const [email, setEmail] = useState("");
  const [firm, setFirm] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuthStore();
  const navigate = useNavigate();

  // Шаг 1: Поиск фирмы по email
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Ищем фирму по email через login API (оно вернёт firm)
      const response = await fetch("/api/auth/find-firm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Фирма не найдена");
      }

      setFirm(data.firm);
      setEmployees(data.employees);
      setStep(2);
    } catch (err) {
      setError(err.message || "Ошибка поиска фирмы");
    } finally {
      setLoading(false);
    }
  };

  // Шаг 2: Клик по сотруднику — переход к вводу пароля
  const handleEmployeeClick = (employeeId) => {
    setSelectedEmployeeId(employeeId);
    setError("");
    setStep(3);
  };

  // Шаг 3: Вход с паролем
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await authAPI.loginWithEmployee(
        selectedEmployeeId,
        password,
      );
      const { user, token } = response.data;
      login(user, token);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Неверный пароль");
    } finally {
      setLoading(false);
    }
  };

  // Возврат на шаг назад
  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setError("");
      setPassword("");
    }
  };

  // Сброс всего
  const handleReset = () => {
    setStep(1);
    setEmail("");
    setFirm(null);
    setEmployees([]);
    setSelectedEmployeeId("");
    setPassword("");
    setError("");
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">📋</div>
          <h1>Task Manager</h1>
          <p>
            {step === 1 && "Введите email компании"}
            {step === 2 && "Выберите сотрудника"}
            {step === 3 && "Введите пароль"}
          </p>
        </div>

        {/* Индикатор шагов */}
        <div className="login-steps">
          <div className={`step ${step >= 1 ? "active" : ""}`}>1</div>
          <div className={`step-line ${step > 1 ? "active" : ""}`} />
          <div className={`step ${step >= 2 ? "active" : ""}`}>2</div>
          <div className={`step-line ${step > 2 ? "active" : ""}`} />
          <div className={`step ${step >= 3 ? "active" : ""}`}>3</div>
        </div>

        {/* Шаг 1: Email */}
        {step === 1 && (
          <form onSubmit={handleEmailSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email компании</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="company@example.com"
                required
                disabled={loading}
                autoFocus
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? "Поиск..." : "Продолжить"}
            </button>
          </form>
        )}

        {/* Шаг 2: Список сотрудников */}
        {step === 2 && firm && (
          <div className="login-employees-list">
            <div className="firm-info">
              <strong>{firm.name}</strong>
              <span>{firm.email}</span>
            </div>

            <p className="employees-hint">Выберите сотрудника:</p>

            <div className="employees-grid">
              {employees.map((emp) => (
                <button
                  key={emp.id}
                  className="employee-card"
                  onClick={() => handleEmployeeClick(emp.id)}
                >
                  <div className="employee-avatar">👤</div>
                  <span className="employee-name">{emp.name}</span>
                </button>
              ))}
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="login-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleBack}
                disabled={loading}
              >
                Назад
              </button>
            </div>
          </div>
        )}

        {/* Шаг 3: Пароль */}
        {step === 3 && firm && (
          <form onSubmit={handlePasswordSubmit} className="login-form">
            <div className="firm-info">
              <strong>{firm.name}</strong>
              <span>
                {employees.find((e) => e.id === selectedEmployeeId)?.name}
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="password">Пароль</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                autoFocus
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="login-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleBack}
                disabled={loading}
              >
                Назад
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? "Вход..." : "Войти"}
              </button>
            </div>
          </form>
        )}

        {/* Кнопка сброса */}
        {step > 1 && (
          <button
            className="btn btn-link btn-sm"
            onClick={handleReset}
            disabled={loading}
          >
            Начать заново
          </button>
        )}
      </div>

      <style>{`
        .login-steps {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 20px 0 30px;
        }
        .step {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #e0e0e0;
          color: #666;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
          transition: all 0.3s;
        }
        .step.active {
          background: #4f46e5;
          color: white;
        }
        .step-line {
          width: 60px;
          height: 2px;
          background: #e0e0e0;
          margin: 0 10px;
          transition: background 0.3s;
        }
        .step-line.active {
          background: #4f46e5;
        }
        .firm-info {
          background: #f5f5f5;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          text-align: center;
        }
        .firm-info strong {
          display: block;
          color: #333;
          margin-bottom: 4px;
        }
        .firm-info span {
          font-size: 13px;
          color: #666;
        }
        .employees-hint {
          color: #666;
          margin-bottom: 16px;
          font-size: 14px;
        }
        .employees-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }
        .employee-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 20px 12px;
          background: #f8f9fa;
          border: 2px solid #e0e0e0;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .employee-card:hover {
          background: #e8eaf6;
          border-color: #4f46e5;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15);
        }
        .employee-card:active {
          transform: translateY(0);
        }
        .employee-avatar {
          font-size: 32px;
        }
        .employee-name {
          font-size: 14px;
          font-weight: 500;
          color: #333;
          text-align: center;
        }
        .login-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        .login-actions .btn {
          flex: 1;
        }
        .btn-link {
          background: none;
          border: none;
          color: #4f46e5;
          cursor: pointer;
          text-decoration: underline;
          margin-top: 15px;
        }
        .btn-link:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
