// Financial Event System - Event Sourcing Architecture

export class FinancialEvent {
  constructor(type, aggregateId, data, timestamp = new Date()) {
    this.id = this.generateEventId()
    this.type = type
    this.aggregateId = aggregateId
    this.data = data
    this.timestamp = timestamp
    this.version = 1
  }
  
  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// Forecast Events
export class ForecastCreatedEvent extends FinancialEvent {
  constructor(aggregateId, forecastData) {
    super('forecast.created', aggregateId, forecastData)
  }
}

export class ForecastStatusChangedEvent extends FinancialEvent {
  constructor(aggregateId, fromStatus, toStatus, metadata = {}) {
    super('forecast.status_changed', aggregateId, {
      fromStatus,
      toStatus,
      ...metadata
    })
  }
}

export class ForecastExpectedEvent extends FinancialEvent {
  constructor(aggregateId, expectedDate, metadata = {}) {
    super('forecast.expected', aggregateId, {
      expectedDate,
      ...metadata
    })
  }
}

export class ForecastReceivedEvent extends FinancialEvent {
  constructor(aggregateId, actualAmount, actualDate, metadata = {}) {
    super('forecast.received', aggregateId, {
      actualAmount,
      actualDate,
      ...metadata
    })
  }
}

// Expense Events
export class ExpenseCreatedEvent extends FinancialEvent {
  constructor(aggregateId, expenseData) {
    super('expense.created', aggregateId, expenseData)
  }
}

export class ExpenseSubmittedEvent extends FinancialEvent {
  constructor(aggregateId, submittedBy, metadata = {}) {
    super('expense.submitted', aggregateId, {
      submittedBy,
      ...metadata
    })
  }
}

export class ExpenseApprovedEvent extends FinancialEvent {
  constructor(aggregateId, approvedBy, scheduledDate, metadata = {}) {
    super('expense.approved', aggregateId, {
      approvedBy,
      scheduledDate,
      ...metadata
    })
  }
}

export class ExpensePaidEvent extends FinancialEvent {
  constructor(aggregateId, actualAmount, paidDate, metadata = {}) {
    super('expense.paid', aggregateId, {
      actualAmount,
      paidDate,
      ...metadata
    })
  }
}

export class ExpenseRejectedEvent extends FinancialEvent {
  constructor(aggregateId, rejectedBy, reason, metadata = {}) {
    super('expense.rejected', aggregateId, {
      rejectedBy,
      reason,
      ...metadata
    })
  }
}

// Statement Events
export class StatementImportedEvent extends FinancialEvent {
  constructor(batchId, statementLines, metadata = {}) {
    super('statement.imported', batchId, {
      statementLines,
      ...metadata
    })
  }
}

export class StatementLineProcessedEvent extends FinancialEvent {
  constructor(aggregateId, statementLineId, processingResult, metadata = {}) {
    super('statement.line_processed', aggregateId, {
      statementLineId,
      processingResult,
      ...metadata
    })
  }
}

// Reconciliation Events
export class ReconciliationMatchedEvent extends FinancialEvent {
  constructor(aggregateId, statementLineId, matchedEntityId, matchedEntityType, confidence, metadata = {}) {
    super('reconciliation.matched', aggregateId, {
      statementLineId,
      matchedEntityId,
      matchedEntityType,
      confidence,
      ...metadata
    })
  }
}

export class ReconciliationConfirmedEvent extends FinancialEvent {
  constructor(aggregateId, statementLineId, matchedEntityId, matchedEntityType, matchType, confirmedBy, metadata = {}) {
    super('reconciliation.confirmed', aggregateId, {
      statementLineId,
      matchedEntityId,
      matchedEntityType,
      matchType,
      confirmedBy,
      ...metadata
    })
  }
}

export class ReconciliationConflictEvent extends FinancialEvent {
  constructor(aggregateId, statementLineId, conflicts, metadata = {}) {
    super('reconciliation.conflict', aggregateId, {
      statementLineId,
      conflicts,
      ...metadata
    })
  }
}

// Timeline Events
export class TimelineProjectionUpdatedEvent extends FinancialEvent {
  constructor(aggregateId, date, projectionData, metadata = {}) {
    super('timeline.projection_updated', aggregateId, {
      date,
      projectionData,
      ...metadata
    })
  }
}

export class BalanceRecalculatedEvent extends FinancialEvent {
  constructor(aggregateId, date, openingBalance, closingBalance, metadata = {}) {
    super('balance.recalculated', aggregateId, {
      date,
      openingBalance,
      closingBalance,
      ...metadata
    })
  }
}

// Event Factory
export class FinancialEventFactory {
  static createEvent(type, aggregateId, data) {
    switch (type) {
      case 'forecast.created':
        return new ForecastCreatedEvent(aggregateId, data)
      case 'forecast.status_changed':
        return new ForecastStatusChangedEvent(aggregateId, data.fromStatus, data.toStatus, data.metadata)
      case 'forecast.expected':
        return new ForecastExpectedEvent(aggregateId, data.expectedDate, data.metadata)
      case 'forecast.received':
        return new ForecastReceivedEvent(aggregateId, data.actualAmount, data.actualDate, data.metadata)
      
      case 'expense.created':
        return new ExpenseCreatedEvent(aggregateId, data)
      case 'expense.submitted':
        return new ExpenseSubmittedEvent(aggregateId, data.submittedBy, data.metadata)
      case 'expense.approved':
        return new ExpenseApprovedEvent(aggregateId, data.approvedBy, data.scheduledDate, data.metadata)
      case 'expense.paid':
        return new ExpensePaidEvent(aggregateId, data.actualAmount, data.paidDate, data.metadata)
      case 'expense.rejected':
        return new ExpenseRejectedEvent(aggregateId, data.rejectedBy, data.reason, data.metadata)
      
      case 'statement.imported':
        return new StatementImportedEvent(aggregateId, data.statementLines, data.metadata)
      case 'statement.line_processed':
        return new StatementLineProcessedEvent(aggregateId, data.statementLineId, data.processingResult, data.metadata)
      
      case 'reconciliation.matched':
        return new ReconciliationMatchedEvent(aggregateId, data.statementLineId, data.matchedEntityId, data.matchedEntityType, data.confidence, data.metadata)
      case 'reconciliation.confirmed':
        return new ReconciliationConfirmedEvent(aggregateId, data.statementLineId, data.matchedEntityId, data.matchedEntityType, data.matchType, data.confirmedBy, data.metadata)
      case 'reconciliation.conflict':
        return new ReconciliationConflictEvent(aggregateId, data.statementLineId, data.conflicts, data.metadata)
      
      case 'timeline.projection_updated':
        return new TimelineProjectionUpdatedEvent(aggregateId, data.date, data.projectionData, data.metadata)
      case 'balance.recalculated':
        return new BalanceRecalculatedEvent(aggregateId, data.date, data.openingBalance, data.closingBalance, data.metadata)
      
      default:
        throw new Error(`Unknown event type: ${type}`)
    }
  }
}

// Event Store Interface
export class EventStore {
  constructor() {
    this.events = new Map() // aggregateId -> events[]
    this.globalEvents = []
  }
  
  saveEvent(event) {
    // Save to aggregate stream
    if (!this.events.has(event.aggregateId)) {
      this.events.set(event.aggregateId, [])
    }
    this.events.get(event.aggregateId).push(event)
    
    // Save to global stream
    this.globalEvents.push(event)
    
    // Sort global events by timestamp
    this.globalEvents.sort((a, b) => a.timestamp - b.timestamp)
  }
  
  getEventsForAggregate(aggregateId) {
    return this.events.get(aggregateId) || []
  }
  
  getEventsByType(type) {
    return this.globalEvents.filter(event => event.type === type)
  }
  
  getEventsInDateRange(startDate, endDate) {
    return this.globalEvents.filter(event => 
      event.timestamp >= startDate && event.timestamp <= endDate
    )
  }
  
  getEventsForFirm(firmId, startDate, endDate) {
    // This would need to be implemented with actual database queries
    // For now, return all events in date range
    return this.getEventsInDateRange(startDate, endDate)
  }
}

// Global event store instance
export const eventStore = new EventStore()
