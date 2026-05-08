import api from './index';

export const financialAPI = {
  // Forecast entries
  getForecast: (firmId, employeeId, startDate, endDate) => {
    const params = new URLSearchParams({ firmId });
    if (employeeId) params.append('employeeId', employeeId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    return api.get(`/financial/forecast?${params}`);
  },
  
  createForecast: (data) => api.post('/financial/forecast', data),
  
  // Expense requests
  getExpenses: (firmId, employeeId, status) => {
    const params = new URLSearchParams({ firmId });
    if (employeeId) params.append('employeeId', employeeId);
    if (status) params.append('status', status);
    
    return api.get(`/financial/expenses?${params}`);
  },
  
  createExpense: (data) => api.post('/financial/expenses', data),
  
  updateExpenseStatus: (id, data) => api.put(`/financial/expenses/${id}/status`, data),
  
  // Cashflow
  getCashflow: (firmId, startDate, endDate) => {
    const params = new URLSearchParams({ firmId, startDate, endDate });
    return api.get(`/financial/cashflow?${params}`);
  },
  
  // Bank statements
  getBankStatements: (firmId) => {
    return api.get(`/financial/bank-statements?firmId=${firmId}`);
  },
  
  uploadBankStatement: (formData) => {
    return api.post('/financial/bank-statement', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  // Reconciliation
  getReconciliationSuggestions: (firmId, statementId) => {
    const params = new URLSearchParams({ firmId, statementId });
    return api.get(`/financial/reconciliation-suggestions?${params}`);
  },
  
  confirmReconciliation: (data) => api.post('/financial/reconciliation/confirm', data),
  
  // Employee forecast settings
  getForecastEmployees: (firmId) => {
    return api.get(`/financial/forecast-employees?firmId=${firmId}`);
  },
  
  updateForecastSettings: (data) => api.post('/financial/forecast-settings', data)
};
