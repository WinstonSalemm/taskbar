import { Router } from "express";
import { query } from "../db/index.js";
import { createNotification } from "./notifications.js";
import { uploadToS3 } from "../utils/s3.js";

const router = Router();

// ============================================
// FORECAST ENTRIES
// ============================================

// Получить прогнозы по фирме и сотруднику
router.get("/forecast", async (req, res) => {
  try {
    const { firmId, employeeId, startDate, endDate } = req.query;
    
    let sql = `
      SELECT fe.*, e.name as employee_name
      FROM forecast_entries fe
      LEFT JOIN employees e ON fe.employee_id = e.id
      WHERE fe.firm_id = $1
    `;
    const params = [firmId];
    
    if (employeeId) {
      sql += ` AND fe.employee_id = $2`;
      params.push(employeeId);
    }
    
    if (startDate) {
      sql += ` AND fe.expected_date >= $${params.length + 1}`;
      params.push(startDate);
    }
    
    if (endDate) {
      sql += ` AND fe.expected_date <= $${params.length + 1}`;
      params.push(endDate);
    }
    
    sql += ` ORDER BY fe.expected_date DESC`;
    
    const result = await query(sql, params);
    res.json({ forecast: result.rows });
  } catch (err) {
    console.error("Error getting forecast:", err);
    res.status(500).json({ error: err.message });
  }
});

// Создать прогноз
router.post("/forecast", async (req, res) => {
  try {
    const { 
      firmId, employeeId, customerName, customerInn, 
      contractNumber, paymentType, amount, expectedDate, notes 
    } = req.body;
    
    const result = await query(`
      INSERT INTO forecast_entries 
      (firm_id, employee_id, customer_name, customer_inn, contract_number, 
       payment_type, amount, expected_date, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [firmId, employeeId, customerName, customerInn, 
        contractNumber, paymentType, amount, expectedDate, notes]);
    
    // Уведомление админу
    await createNotification({
      userId: "admin",
      type: "forecast_created",
      title: "Новый прогноз поступлений",
      message: `Добавлен прогноз от ${req.user?.name || employeeId} на сумму ${amount}`,
      metadata: { forecastId: result.rows[0].id }
    });
    
    res.json({ forecast: result.rows[0] });
  } catch (err) {
    console.error("Error creating forecast:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// EXPENSE REQUESTS
// ============================================

// Получить заявки на расход
router.get("/expenses", async (req, res) => {
  try {
    const { firmId, employeeId, status } = req.query;
    
    let sql = `
      SELECT er.*, e.name as employee_name
      FROM expense_requests er
      LEFT JOIN employees e ON er.employee_id = e.id
      WHERE er.firm_id = $1
    `;
    const params = [firmId];
    
    if (employeeId) {
      sql += ` AND er.employee_id = $2`;
      params.push(employeeId);
    }
    
    if (status) {
      sql += ` AND er.status = $${params.length + 1}`;
      params.push(status);
    }
    
    sql += ` ORDER BY er.created_at DESC`;
    
    const result = await query(sql, params);
    res.json({ expenses: result.rows });
  } catch (err) {
    console.error("Error getting expenses:", err);
    res.status(500).json({ error: err.message });
  }
});

// Создать заявку на расход
router.post("/expenses", async (req, res) => {
  try {
    const { 
      firmId, employeeId, subject, counterparty, basis, 
      amount, plannedDate, notes 
    } = req.body;
    
    const result = await query(`
      INSERT INTO expense_requests 
      (firm_id, employee_id, subject, counterparty, basis, 
       amount, planned_date, notes, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'submitted')
      RETURNING *
    `, [firmId, employeeId, subject, counterparty, basis, 
        amount, plannedDate, notes]);
    
    // Уведомление админу на согласование
    await createNotification({
      userId: "admin",
      type: "expense_submitted",
      title: "Новая заявка на расход",
      message: `Заявка на ${subject} на сумму ${amount} требует согласования`,
      metadata: { expenseId: result.rows[0].id }
    });
    
    res.json({ expense: result.rows[0] });
  } catch (err) {
    console.error("Error creating expense:", err);
    res.status(500).json({ error: err.message });
  }
});

// Обновить статус заявки (workflow)
router.put("/expenses/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    const result = await query(`
      UPDATE expense_requests 
      SET status = $1, notes = COALESCE(notes, notes), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [status, notes, id]);
    
    // Уведомление сотруднику
    const expense = result.rows[0];
    await createNotification({
      userId: expense.employee_id,
      type: "expense_status_changed",
      title: `Статус заявки изменен: ${status}`,
      message: `Ваша заявка на "${expense.subject}" теперь имеет статус "${status}"`,
      metadata: { expenseId: expense.id }
    });
    
    res.json({ expense: result.rows[0] });
  } catch (err) {
    console.error("Error updating expense status:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// CASHFLOW AGGREGATION
// ============================================

// Получить cashflow timeline
router.get("/cashflow", async (req, res) => {
  try {
    const { firmId, startDate, endDate } = req.query;
    
    // Получаем снепшоты или создаём агрегацию на лету
    const snapshots = await query(`
      SELECT * FROM cashflow_snapshots 
      WHERE firm_id = $1 AND snapshot_date BETWEEN $2 AND $3
      ORDER BY snapshot_date
    `, [firmId, startDate, endDate]);
    
    // Если снепшотов нет, агрегируем на лету
    if (snapshots.rows.length === 0) {
      const aggregation = await query(`
        SELECT 
          DATE_TRUNC('day', COALESCE(fe.expected_date, er.planned_date)) as date,
          COALESCE(SUM(CASE WHEN fe.expected_date IS NOT NULL THEN fe.amount ELSE 0 END), 0) as forecast_income,
          COALESCE(SUM(CASE WHEN er.planned_date IS NOT NULL THEN er.amount ELSE 0 END), 0) as forecast_expense,
          COALESCE(SUM(CASE WHEN bs.credit_turnover > 0 THEN bs.credit_turnover ELSE 0 END), 0) as actual_income,
          COALESCE(SUM(CASE WHEN bs.debit_turnover > 0 THEN bs.debit_turnover ELSE 0 END), 0) as actual_expense
        FROM forecast_entries fe
        FULL OUTER JOIN expense_requests er ON DATE_TRUNC('day', fe.expected_date) = DATE_TRUNC('day', er.planned_date)
        FULL OUTER JOIN bank_statements bs ON DATE_TRUNC('day', fe.expected_date) = DATE_TRUNC('day', bs.document_date)
        WHERE (fe.firm_id = $1 OR er.firm_id = $1 OR bs.firm_id = $1)
          AND COALESCE(DATE_TRUNC('day', fe.expected_date), DATE_TRUNC('day', er.planned_date), DATE_TRUNC('day', bs.document_date)) BETWEEN $2 AND $3
        GROUP BY DATE_TRUNC('day', COALESCE(fe.expected_date, er.planned_date, bs.document_date))
        ORDER BY date
      `, [firmId, startDate, endDate]);
      
      res.json({ cashflow: aggregation.rows });
    } else {
      res.json({ cashflow: snapshots.rows });
    }
  } catch (err) {
    console.error("Error getting cashflow:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// BANK STATEMENTS & RECONCILIATION
// ============================================

// Загрузить выписку из Excel
router.post("/bank-statement", async (req, res) => {
  try {
    const { firmId, fileData } = req.body;
    
    // Парсинг Excel и сохранение в bank_statements
    // TODO: Implement Excel parsing logic
    
    res.json({ message: "Bank statement uploaded successfully" });
  } catch (err) {
    console.error("Error uploading bank statement:", err);
    res.status(500).json({ error: err.message });
  }
});

// Получить предложения для сверки
router.get("/reconciliation-suggestions", async (req, res) => {
  try {
    const { firmId, statementId } = req.query;
    
    // Ищем совпадения по ИНН и сумме
    const suggestions = await query(`
      SELECT 
        bs.id as statement_id,
        bs.counterparty_inn,
        bs.credit_turnover,
        fe.id as forecast_id,
        fe.customer_inn,
        fe.amount as forecast_amount,
        fe.customer_name,
        ABS(bs.credit_turnover - fe.amount) as amount_diff
      FROM bank_statements bs
      LEFT JOIN forecast_entries fe ON bs.counterparty_inn = fe.customer_inn 
        AND fe.status = 'pending'
        AND ABS(bs.credit_turnover - fe.amount) < 100 -- разница до 100
      WHERE bs.firm_id = $1 AND bs.reconciliation_status = 'unmatched'
        AND bs.credit_turnover > 0
      ORDER BY amount_diff ASC
      LIMIT 10
    `, [firmId]);
    
    res.json({ suggestions: suggestions.rows });
  } catch (err) {
    console.error("Error getting reconciliation suggestions:", err);
    res.status(500).json({ error: err.message });
  }
});

// Подтвердить сверку
router.post("/reconciliation/confirm", async (req, res) => {
  try {
    const { statementId, forecastId, expenseId } = req.body;
    
    // Обновляем статус выписки
    await query(`
      UPDATE bank_statements 
      SET reconciliation_status = 'matched',
          matched_forecast_id = $1,
          matched_expense_id = $2
      WHERE id = $3
    `, [forecastId, expenseId, statementId]);
    
    // Обновляем статус прогноза
    if (forecastId) {
      await query(`
        UPDATE forecast_entries 
        SET status = 'completed', actual_date = CURRENT_DATE
        WHERE id = $1
      `, [forecastId]);
    }
    
    // Обновляем статус расхода
    if (expenseId) {
      await query(`
        UPDATE expense_requests 
        SET status = 'paid'
        WHERE id = $1
      `, [expenseId]);
    }
    
    res.json({ message: "Reconciliation confirmed successfully" });
  } catch (err) {
    console.error("Error confirming reconciliation:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
