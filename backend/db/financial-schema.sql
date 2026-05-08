-- ============================================
-- FINANCIAL MODULE SCHEMA
-- ============================================

-- Forecast entries (прогнозы поступлений)
CREATE TABLE IF NOT EXISTS forecast_entries (
  id SERIAL PRIMARY KEY,
  firm_id VARCHAR(50) REFERENCES firms(id) ON DELETE CASCADE,
  employee_id VARCHAR(50) REFERENCES employees(id) ON DELETE CASCADE,
  customer_name VARCHAR(255) NOT NULL,
  customer_inn VARCHAR(20),
  contract_number VARCHAR(100),
  payment_type VARCHAR(50), -- предоплата/оплата
  amount DECIMAL(15,2) NOT NULL,
  amount_currency DECIMAL(15,2),
  expected_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, completed, cancelled
  actual_date DATE,
  actual_amount DECIMAL(15,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expense requests (заявки на расход)
CREATE TABLE IF NOT EXISTS expense_requests (
  id SERIAL PRIMARY KEY,
  firm_id VARCHAR(50) REFERENCES firms(id) ON DELETE CASCADE,
  employee_id VARCHAR(50) REFERENCES employees(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  counterparty VARCHAR(255),
  basis VARCHAR(255), -- основание
  amount DECIMAL(15,2) NOT NULL,
  planned_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'draft', -- draft, submitted, review, approved, paid, rejected
  workflow_data JSONB DEFAULT '{}', -- данные согласования
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bank statements (выписки)
CREATE TABLE IF NOT EXISTS bank_statements (
  id SERIAL PRIMARY KEY,
  firm_id VARCHAR(50) REFERENCES firms(id) ON DELETE CASCADE,
  document_date DATE NOT NULL,
  doc_number VARCHAR(100),
  account_name VARCHAR(255),
  account_inn VARCHAR(20),
  account_number VARCHAR(50),
  mfo VARCHAR(20),
  credit_turnover DECIMAL(15,2),
  debit_turnover DECIMAL(15,2),
  description TEXT,
  counterparty_name VARCHAR(255),
  counterparty_inn VARCHAR(20),
  reconciliation_status VARCHAR(20) DEFAULT 'unmatched', -- unmatched, matched, manual
  matched_forecast_id INTEGER REFERENCES forecast_entries(id),
  matched_expense_id INTEGER REFERENCES expense_requests(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cashflow snapshots (агрегированные данные)
CREATE TABLE IF NOT EXISTS cashflow_snapshots (
  id SERIAL PRIMARY KEY,
  firm_id VARCHAR(50) REFERENCES firms(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  opening_balance DECIMAL(15,2) NOT NULL,
  total_income DECIMAL(15,2) DEFAULT 0,
  total_expense DECIMAL(15,2) DEFAULT 0,
  closing_balance DECIMAL(15,2) NOT NULL,
  forecast_income DECIMAL(15,2) DEFAULT 0,
  forecast_expense DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(firm_id, snapshot_date)
);

-- Employee forecast settings (динамическое управление)
CREATE TABLE IF NOT EXISTS employee_forecast_settings (
  id SERIAL PRIMARY KEY,
  firm_id VARCHAR(50) REFERENCES firms(id) ON DELETE CASCADE,
  employee_id VARCHAR(50) REFERENCES employees(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(firm_id, employee_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_forecast_firm_employee ON forecast_entries(firm_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_forecast_expected_date ON forecast_entries(expected_date);
CREATE INDEX IF NOT EXISTS idx_forecast_status ON forecast_entries(status);
CREATE INDEX IF NOT EXISTS idx_expense_firm_employee ON expense_requests(firm_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_expense_planned_date ON expense_requests(planned_date);
CREATE INDEX IF NOT EXISTS idx_expense_status ON expense_requests(status);
CREATE INDEX IF NOT EXISTS idx_bank_statement_date ON bank_statements(document_date);
CREATE INDEX IF NOT EXISTS idx_bank_statement_inn ON bank_statements(counterparty_inn);
CREATE INDEX IF NOT EXISTS idx_cashflow_firm_date ON cashflow_snapshots(firm_id, snapshot_date);
