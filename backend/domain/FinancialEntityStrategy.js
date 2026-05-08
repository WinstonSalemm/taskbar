// Financial Entity Strategy - Unified Approach for Financial Objects

export const FinancialEntityType = {
  FORECAST: 'forecast',
  EXPENSE: 'expense',
  STATEMENT_LINE: 'statement_line',
  RECONCILIATION: 'reconciliation',
  TIMELINE_NODE: 'timeline_node'
}

export const FinancialEntityStatus = {
  // Forecast statuses
  FORECAST_DRAFT: 'draft',
  FORECAST_PLANNED: 'planned',
  FORECAST_EXPECTED: 'expected',
  FORECAST_MATCHED: 'matched',
  FORECAST_RECEIVED: 'received',
  FORECAST_ARCHIVED: 'archived',
  FORECAST_CANCELLED: 'cancelled',
  
  // Expense statuses
  EXPENSE_DRAFT: 'draft',
  EXPENSE_SUBMITTED: 'submitted',
  EXPENSE_APPROVED: 'approved',
  EXPENSE_SCHEDULED: 'scheduled',
  EXPENSE_PAID: 'paid',
  EXPENSE_RECONCILED: 'reconciled',
  EXPENSE_REJECTED: 'rejected',
  EXPENSE_CANCELLED: 'cancelled',
  
  // Reconciliation statuses
  RECONCILIATION_UNMATCHED: 'unmatched',
  RECONCILIATION_AUTO_MATCHED: 'auto_matched',
  RECONCILIATION_MANUAL_MATCHED: 'manual_matched',
  RECONCILIATION_PARTIAL_MATCH: 'partial_match',
  RECONCILIATION_CONFLICT: 'conflict',
  RECONCILIATION_IGNORED: 'ignored'
}

/**
 * Base Financial Entity Interface
 */
export class FinancialEntity {
  constructor(type, data) {
    this.id = this.generateId()
    this.entityType = type
    this.firmId = data.firmId
    this.amount = this.parseAmount(data.amount)
    this.date = this.parseDate(data.date)
    this.status = data.status || this.getDefaultStatus(type)
    this.metadata = this.buildMetadata(data, type)
    this.createdAt = new Date()
    this.updatedAt = new Date()
    this.version = 1
  }

  generateId() {
    return `${this.entityType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  parseAmount(amount) {
    if (typeof amount === 'string') {
      return parseFloat(amount.replace(/[^0-9.-]/g, '')) || 0
    }
    return parseFloat(amount) || 0
  }

  parseDate(date) {
    if (date instanceof Date) return date
    return new Date(date)
  }

  getDefaultStatus(type) {
    switch (type) {
      case FinancialEntityType.FORECAST:
        return FinancialEntityStatus.FORECAST_DRAFT
      case FinancialEntityType.EXPENSE:
        return FinancialEntityStatus.EXPENSE_DRAFT
      case FinancialEntityType.STATEMENT_LINE:
        return FinancialEntityStatus.RECONCILIATION_UNMATCHED
      default:
        return 'draft'
    }
  }

  buildMetadata(data, type) {
    const baseMetadata = {
      createdBy: data.createdBy,
      source: data.source || 'manual',
      tags: data.tags || []
    }

    switch (type) {
      case FinancialEntityType.FORECAST:
        return {
          ...baseMetadata,
          employeeId: data.employeeId,
          customerId: data.customerId,
          customerInn: data.customerInn,
          contractNumber: data.contractNumber,
          paymentType: data.paymentType,
          expectedDate: data.expectedDate,
          actualDate: data.actualDate,
          actualAmount: data.actualAmount
        }
      
      case FinancialEntityType.EXPENSE:
        return {
          ...baseMetadata,
          employeeId: data.employeeId,
          subject: data.subject,
          counterparty: data.counterparty,
          basis: data.basis,
          plannedDate: data.plannedDate,
          actualDate: data.actualDate,
          actualAmount: data.actualAmount,
          workflowData: data.workflowData || {}
        }
      
      case FinancialEntityType.STATEMENT_LINE:
        return {
          ...baseMetadata,
          documentDate: data.documentDate,
          docNumber: data.docNumber,
          accountName: data.accountName,
          accountInn: data.accountInn,
          accountNumber: data.accountNumber,
          mfo: data.mfo,
          creditTurnover: data.creditTurnover,
          debitTurnover: data.debitTurnover,
          description: data.description,
          counterpartyName: data.counterpartyName,
          counterpartyInn: data.counterpartyInn,
          matchedForecastId: data.matchedForecastId,
          matchedExpenseId: data.matchedExpenseId,
          confidence: data.confidence
        }
      
      default:
        return baseMetadata
    }
  }

  updateStatus(newStatus, metadata = {}) {
    this.status = newStatus
    this.metadata = { ...this.metadata, ...metadata }
    this.updatedAt = new Date()
    this.version++
  }

  updateMetadata(updates) {
    this.metadata = { ...this.metadata, ...updates }
    this.updatedAt = new Date()
    this.version++
  }

  toJSON() {
    return {
      id: this.id,
      entityType: this.entityType,
      firmId: this.firmId,
      amount: this.amount,
      date: this.date,
      status: this.status,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.version
    }
  }
}

/**
 * Specialized Entity Classes
 */
export class ForecastEntity extends FinancialEntity {
  constructor(data) {
    super(FinancialEntityType.FORECAST, data)
    this.validateForecastData(data)
  }

  validateForecastData(data) {
    if (!data.employeeId) {
      throw new Error('Employee ID is required for forecast')
    }
    if (!data.customerId) {
      throw new Error('Customer ID is required for forecast')
    }
    if (!data.expectedDate) {
      throw new Error('Expected date is required for forecast')
    }
  }

  getEmployeeId() {
    return this.metadata.employeeId
  }

  getCustomerId() {
    return this.metadata.customerId
  }

  getCustomerInn() {
    return this.metadata.customerInn
  }

  getExpectedDate() {
    return this.metadata.expectedDate
  }

  getActualDate() {
    return this.metadata.actualDate
  }

  getActualAmount() {
    return this.metadata.actualAmount
  }

  isReceived() {
    return this.status === FinancialEntityStatus.FORECAST_RECEIVED
  }

  isExpected() {
    return this.status === FinancialEntityStatus.FORECAST_EXPECTED
  }
}

export class ExpenseEntity extends FinancialEntity {
  constructor(data) {
    super(FinancialEntityType.EXPENSE, data)
    this.validateExpenseData(data)
  }

  validateExpenseData(data) {
    if (!data.employeeId) {
      throw new Error('Employee ID is required for expense')
    }
    if (!data.subject) {
      throw new Error('Subject is required for expense')
    }
    if (!data.plannedDate) {
      throw new Error('Planned date is required for expense')
    }
  }

  getEmployeeId() {
    return this.metadata.employeeId
  }

  getSubject() {
    return this.metadata.subject
  }

  getCounterparty() {
    return this.metadata.counterparty
  }

  getPlannedDate() {
    return this.metadata.plannedDate
  }

  getActualDate() {
    return this.metadata.actualDate
  }

  getActualAmount() {
    return this.metadata.actualAmount
  }

  isApproved() {
    return [
      FinancialEntityStatus.EXPENSE_APPROVED,
      FinancialEntityStatus.EXPENSE_SCHEDULED,
      FinancialEntityStatus.EXPENSE_PAID,
      FinancialEntityStatus.EXPENSE_RECONCILED
    ].includes(this.status)
  }

  isPaid() {
    return [
      FinancialEntityStatus.EXPENSE_PAID,
      FinancialEntityStatus.EXPENSE_RECONCILED
    ].includes(this.status)
  }

  needsApproval() {
    return this.status === FinancialEntityStatus.EXPENSE_SUBMITTED
  }
}

export class StatementLineEntity extends FinancialEntity {
  constructor(data) {
    super(FinancialEntityType.STATEMENT_LINE, data)
    this.validateStatementData(data)
  }

  validateStatementData(data) {
    if (!data.documentDate) {
      throw new Error('Document date is required for statement line')
    }
    if (!data.accountName) {
      throw new Error('Account name is required for statement line')
    }
  }

  getDocumentDate() {
    return this.metadata.documentDate
  }

  getCreditTurnover() {
    return this.metadata.creditTurnover || 0
  }

  getDebitTurnover() {
    return this.metadata.debitTurnover || 0
  }

  getCounterpartyName() {
    return this.metadata.counterpartyName
  }

  getCounterpartyInn() {
    return this.metadata.counterpartyInn
  }

  isCredit() {
    return this.getCreditTurnover() > 0
  }

  isDebit() {
    return this.getDebitTurnover() > 0
  }

  getAmount() {
    return this.isCredit() ? this.getCreditTurnover() : this.getDebitTurnover()
  }

  isMatched() {
    return this.status !== FinancialEntityStatus.RECONCILIATION_UNMATCHED
  }

  getMatchedEntityId() {
    return this.metadata.matchedForecastId || this.metadata.matchedExpenseId
  }
}

/**
 * Financial Entity Factory
 */
export class FinancialEntityFactory {
  static create(type, data) {
    switch (type) {
      case FinancialEntityType.FORECAST:
        return new ForecastEntity(data)
      case FinancialEntityType.EXPENSE:
        return new ExpenseEntity(data)
      case FinancialEntityType.STATEMENT_LINE:
        return new StatementLineEntity(data)
      default:
        throw new Error(`Unknown entity type: ${type}`)
    }
  }

  static createFromEvent(event) {
    switch (event.type) {
      case 'forecast.created':
        return new ForecastEntity(event.data)
      case 'expense.created':
        return new ExpenseEntity(event.data)
      case 'statement.line_processed':
        return new StatementLineEntity(event.data)
      default:
        throw new Error(`Cannot create entity from event type: ${event.type}`)
    }
  }

  static validateEntity(entity) {
    if (!entity.id) {
      throw new Error('Entity ID is required')
    }
    if (!entity.entityType) {
      throw new Error('Entity type is required')
    }
    if (!entity.firmId) {
      throw new Error('Firm ID is required')
    }
    if (typeof entity.amount !== 'number') {
      throw new Error('Amount must be a number')
    }
    if (!(entity.date instanceof Date)) {
      throw new Error('Date must be a Date object')
    }
    if (!entity.status) {
      throw new Error('Status is required')
    }

    // Type-specific validation
    switch (entity.entityType) {
      case FinancialEntityType.FORECAST:
        return this.validateForecastEntity(entity)
      case FinancialEntityType.EXPENSE:
        return this.validateExpenseEntity(entity)
      case FinancialEntityType.STATEMENT_LINE:
        return this.validateStatementLineEntity(entity)
    }
  }

  static validateForecastEntity(entity) {
    if (!entity.metadata.employeeId) {
      throw new Error('Employee ID is required for forecast')
    }
    if (!entity.metadata.customerId) {
      throw new Error('Customer ID is required for forecast')
    }
    return true
  }

  static validateExpenseEntity(entity) {
    if (!entity.metadata.employeeId) {
      throw new Error('Employee ID is required for expense')
    }
    if (!entity.metadata.subject) {
      throw new Error('Subject is required for expense')
    }
    return true
  }

  static validateStatementLineEntity(entity) {
    if (!entity.metadata.documentDate) {
      throw new Error('Document date is required for statement line')
    }
    if (!entity.metadata.accountName) {
      throw new Error('Account name is required for statement line')
    }
    return true
  }
}

/**
 * Entity Repository Interface
 */
export class FinancialEntityRepository {
  constructor() {
    this.entities = new Map() // id -> entity
    this.byFirm = new Map() // firmId -> Set of entityIds
    this.byType = new Map() // type -> Set of entityIds
    this.byStatus = new Map() // status -> Set of entityIds
  }

  save(entity) {
    FinancialEntityFactory.validateEntity(entity)
    
    this.entities.set(entity.id, entity)
    
    // Update indexes
    if (!this.byFirm.has(entity.firmId)) {
      this.byFirm.set(entity.firmId, new Set())
    }
    this.byFirm.get(entity.firmId).add(entity.id)
    
    if (!this.byType.has(entity.entityType)) {
      this.byType.set(entity.entityType, new Set())
    }
    this.byType.get(entity.entityType).add(entity.id)
    
    if (!this.byStatus.has(entity.status)) {
      this.byStatus.set(entity.status, new Set())
    }
    this.byStatus.get(entity.status).add(entity.id)
  }

  findById(id) {
    return this.entities.get(id)
  }

  findByFirm(firmId) {
    const entityIds = this.byFirm.get(firmId) || new Set()
    return Array.from(entityIds).map(id => this.entities.get(id))
  }

  findByType(type) {
    const entityIds = this.byType.get(type) || new Set()
    return Array.from(entityIds).map(id => this.entities.get(id))
  }

  findByStatus(status) {
    const entityIds = this.byStatus.get(status) || new Set()
    return Array.from(entityIds).map(id => this.entities.get(id))
  }

  findByFirmAndType(firmId, type) {
    const firmEntities = this.findByFirm(firmId)
    return firmEntities.filter(entity => entity.entityType === type)
  }

  findByFirmAndStatus(firmId, status) {
    const firmEntities = this.findByFirm(firmId)
    return firmEntities.filter(entity => entity.status === status)
  }

  findInDateRange(firmId, startDate, endDate) {
    const firmEntities = this.findByFirm(firmId)
    return firmEntities.filter(entity => 
      entity.date >= startDate && entity.date <= endDate
    )
  }

  delete(id) {
    const entity = this.entities.get(id)
    if (!entity) return false

    this.entities.delete(id)
    
    // Update indexes
    this.byFirm.get(entity.firmId)?.delete(id)
    this.byType.get(entity.entityType)?.delete(id)
    this.byStatus.get(entity.status)?.delete(id)
    
    return true
  }

  clear() {
    this.entities.clear()
    this.byFirm.clear()
    this.byType.clear()
    this.byStatus.clear()
  }

  getStats() {
    return {
      totalEntities: this.entities.size,
      byFirm: Array.from(this.byFirm.entries()).map(([firmId, entities]) => ({
        firmId,
        count: entities.size
      })),
      byType: Array.from(this.byType.entries()).map(([type, entities]) => ({
        type,
        count: entities.size
      })),
      byStatus: Array.from(this.byStatus.entries()).map(([status, entities]) => ({
        status,
        count: entities.size
      }))
    }
  }
}

// Global repository instance
export const financialEntityRepository = new FinancialEntityRepository()
