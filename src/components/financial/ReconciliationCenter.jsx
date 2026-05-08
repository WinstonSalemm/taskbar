import { useState, useEffect } from "react";
import { financialAPI } from "../../api";
import "./ReconciliationCenter.css";

export default function ReconciliationCenter({ user, onRefresh }) {
  const [statements, setStatements] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedStatement, setSelectedStatement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);

  useEffect(() => {
    loadStatements();
  }, []);

  const loadStatements = async () => {
    try {
      const response = await financialAPI.getBankStatements(user.firmId);
      setStatements(response.data.statements || []);
    } catch (error) {
      console.error("Error loading statements:", error);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadFile(file);
    setLoading(true);

    try {
      // TODO: Implement Excel parsing and upload
      // const formData = new FormData();
      // formData.append('file', file);
      // formData.append('firmId', user.firmId);
      
      // await financialAPI.uploadBankStatement(formData);
      
      alert('Функция загрузки выписок в разработке');
      setShowUpload(false);
      setUploadFile(null);
      loadStatements();
    } catch (error) {
      console.error("Error uploading statement:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async (statementId) => {
    try {
      const response = await financialAPI.getReconciliationSuggestions(user.firmId, statementId);
      setSuggestions(response.data.suggestions || []);
    } catch (error) {
      console.error("Error loading suggestions:", error);
    }
  };

  const confirmMatch = async (statementId, forecastId, expenseId) => {
    try {
      await financialAPI.confirmReconciliation({
        statementId,
        forecastId,
        expenseId
      });
      
      setSuggestions([]);
      setSelectedStatement(null);
      loadStatements();
      onRefresh();
    } catch (error) {
      console.error("Error confirming reconciliation:", error);
    }
  };

  const unmatchedStatements = statements.filter(s => s.reconciliation_status === 'unmatched');
  const matchedStatements = statements.filter(s => s.reconciliation_status === 'matched');

  return (
    <div className="reconciliation-center">
      <div className="reconciliation-header">
        <h3>Сверка с банковскими выписками</h3>
        
        <button 
          className="btn-primary"
          onClick={() => setShowUpload(true)}
        >
          📁 Загрузить выписку
        </button>
      </div>

      {/* Загрузка выписки */}
      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h4>Загрузка банковской выписки</h4>
            <div className="upload-area">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                disabled={loading}
              />
              {loading && <div className="loading">Обработка файла...</div>}
            </div>
            
            <div className="upload-info">
              <p>Поддерживаемые форматы:</p>
              <ul>
                <li>Excel (.xlsx, .xls)</li>
                <li>CSV (.csv)</li>
              </ul>
              <p>Файл должен содержать колонки: Дата, Сумма, Контрагент, Назначение платежа</p>
            </div>
            
            <div className="form-actions">
              <button onClick={() => setShowUpload(false)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* Статистика сверки */}
      <div className="reconciliation-stats">
        <div className="stat-card">
          <h4>Несопоставленные</h4>
          <div className="stat-value">{unmatchedStatements.length}</div>
        </div>
        <div className="stat-card">
          <h4>Сопоставленные</h4>
          <div className="stat-value">{matchedStatements.length}</div>
        </div>
        <div className="stat-card">
          <h4>Всего операций</h4>
          <div className="stat-value">{statements.length}</div>
        </div>
      </div>

      {/* Несопоставленные операции */}
      {unmatchedStatements.length > 0 && (
        <div className="unmatched-section">
          <h4>🔄 Несопоставленные операции</h4>
          <div className="statement-list">
            {unmatchedStatements.map(statement => (
              <div key={statement.id} className="statement-item unmatched">
                <div className="statement-info">
                  <div className="statement-amount">
                    {parseFloat(statement.credit_turnover || statement.debit_turnover).toLocaleString()} сум
                  </div>
                  <div className="statement-details">
                    <span>Дата: {statement.document_date}</span>
                    <span>Контрагент: {statement.counterparty_name}</span>
                    {statement.counterparty_inn && (
                      <span>ИНН: {statement.counterparty_inn}</span>
                    )}
                    <span>Назначение: {statement.description?.substring(0, 100)}...</span>
                  </div>
                </div>
                
                <div className="statement-actions">
                  <button 
                    className="btn-find-match"
                    onClick={() => {
                      setSelectedStatement(statement);
                      loadSuggestions(statement.id);
                    }}
                  >
                    🔍 Найти совпадения
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Предложения для сверки */}
      {selectedStatement && suggestions.length > 0 && (
        <div className="suggestions-modal">
          <div className="modal-overlay" onClick={() => {
            setSelectedStatement(null);
            setSuggestions([]);
          }}>
            <div className="modal-content suggestions-content" onClick={e => e.stopPropagation()}>
              <h4>Предложения для сверки</h4>
              
              <div className="selected-statement">
                <h5>Операция из выписки:</h5>
                <div className="statement-summary">
                  <span>Сумма: {parseFloat(selectedStatement.credit_turnover).toLocaleString()} сум</span>
                  <span>Контрагент: {selectedStatement.counterparty_name}</span>
                  <span>ИНН: {selectedStatement.counterparty_inn}</span>
                </div>
              </div>

              <div className="suggestions-list">
                {suggestions.map((suggestion, index) => (
                  <div key={index} className="suggestion-item">
                    <div className="suggestion-info">
                      <div className="suggestion-amount">
                        {parseFloat(suggestion.forecast_amount).toLocaleString()} сум
                      </div>
                      <div className="suggestion-details">
                        <span>Клиент: {suggestion.customer_name}</span>
                        <span>ИНН: {suggestion.customer_inn}</span>
                        <span>Разница: {parseFloat(suggestion.amount_diff).toLocaleString()} сум</span>
                      </div>
                    </div>
                    
                    <div className="suggestion-actions">
                      <button 
                        className="btn-confirm-match"
                        onClick={() => confirmMatch(
                          suggestion.statement_id,
                          suggestion.forecast_id,
                          null
                        )}
                      >
                        ✅ Подтвердить
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="form-actions">
                <button onClick={() => {
                  setSelectedStatement(null);
                  setSuggestions([]);
                }}>
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Сопоставленные операции */}
      {matchedStatements.length > 0 && (
        <div className="matched-section">
          <h4>✅ Сопоставленные операции</h4>
          <div className="statement-list">
            {matchedStatements.map(statement => (
              <div key={statement.id} className="statement-item matched">
                <div className="statement-info">
                  <div className="statement-amount">
                    {parseFloat(statement.credit_turnover || statement.debit_turnover).toLocaleString()} сум
                  </div>
                  <div className="statement-details">
                    <span>Дата: {statement.document_date}</span>
                    <span>Контрагент: {statement.counterparty_name}</span>
                    <span>Сопоставлено с: Прогноз #{statement.matched_forecast_id}</span>
                  </div>
                </div>
                
                <div className="match-status">
                  <span className="status-badge matched">✅ Сопоставлено</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Пустое состояние */}
      {statements.length === 0 && (
        <div className="empty-state">
          <p>Банковские выписки пока не загружены</p>
          <button onClick={() => setShowUpload(true)}>
            Загрузить первую выписку
          </button>
        </div>
      )}
    </div>
  );
}
