// Timeline Engine - Core Financial Computation Engine

import { eventStore } from './FinancialEvent.js'

export class TimelineEngine {
  constructor() {
    this.cache = new Map() // firmId -> timeline cache
    this.CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  }

  /**
   * Build timeline for firm within date range
   */
  async buildTimeline(firmId, startDate, endDate) {
    const cacheKey = `${firmId}_${startDate.toISOString()}_${endDate.toISOString()}`
    
    // Check cache first
    const cached = this.cache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.timeline
    }

    // 1. Load source events within date range
    const events = await this.loadSourceEvents(firmId, startDate, endDate)
    
    // 2. Sort events chronologically with type priority
    const sortedEvents = this.sortEventsChronologically(events)
    
    // 3. Get opening balance
    const openingBalance = await this.getOpeningBalance(firmId, startDate)
    
    // 4. Build daily timeline nodes
    const timelineNodes = []
    let currentDate = new Date(startDate)
    let runningBalance = openingBalance
    
    while (currentDate <= endDate) {
      const dayEvents = sortedEvents.filter(event =>
        this.isSameDay(event.timestamp, currentDate)
      )
      
      const dayProjection = this.computeDayProjection(
        currentDate,
        dayEvents,
        runningBalance
      )
      
      timelineNodes.push(dayProjection)
      runningBalance = dayProjection.closingBalance
      currentDate = this.addDays(currentDate, 1)
    }
    
    // Cache result
    this.cache.set(cacheKey, {
      timeline: timelineNodes,
      timestamp: Date.now()
    })
    
    return timelineNodes
  }

  /**
   * Load source events from database and event store
   */
  async loadSourceEvents(firmId, startDate, endDate) {
    // In real implementation, this would query database
    // For now, use event store
    const events = eventStore.getEventsInDateRange(startDate, endDate)
    
    // Filter by firm (would be done in DB query)
    return events.filter(event => 
      !event.data.firmId || event.data.firmId === firmId
    )
  }

  /**
   * Sort events chronologically with type priority
   */
  sortEventsChronologically(events) {
    const typePriority = {
      'forecast.created': 1,
      'forecast.expected': 2,
      'expense.approved': 3,
      'expense.paid': 4,
      'statement.imported': 5,
      'reconciliation.confirmed': 6,
      'balance.recalculated': 7
    }
    
    return events.sort((a, b) => {
      // First by date
      const dateDiff = a.timestamp - b.timestamp
      if (dateDiff !== 0) return dateDiff
      
      // Then by type priority for same date
      const priorityA = typePriority[a.type] || 999
      const priorityB = typePriority[b.type] || 999
      return priorityA - priorityB
    })
  }

  /**
   * Compute projection for a single day
   */
  computeDayProjection(date, events, openingBalance) {
    let confirmedIncome = 0
    let confirmedExpense = 0
    let expectedIncome = 0
    let expectedExpense = 0
    
    const dayEvents = []
    const forecastEvents = []
    const expenseEvents = []
    const reconciliationEvents = []
    
    // Process events and calculate amounts
    events.forEach(event => {
      dayEvents.push(event)
      
      switch (event.type) {
        case 'forecast.received':
          confirmedIncome += event.data.actualAmount || 0
          break
        case 'forecast.expected':
          expectedIncome += event.data.amount || 0
          forecastEvents.push(event)
          break
        case 'expense.paid':
          confirmedExpense += event.data.actualAmount || 0
          expenseEvents.push(event)
          break
        case 'expense.approved':
          expectedExpense += event.data.amount || 0
          break
        case 'reconciliation.confirmed':
          reconciliationEvents.push(event)
          break
      }
    })
    
    const closingBalance = openingBalance + confirmedIncome - confirmedExpense
    const projectedBalance = openingBalance + expectedIncome - expectedExpense
    
    return {
      date: new Date(date),
      openingBalance,
      confirmedIncome,
      confirmedExpense,
      expectedIncome,
      expectedExpense,
      closingBalance,
      projectedBalance,
      events: dayEvents,
      projections: {
        forecastEvents,
        expenseEvents,
        reconciliationEvents
      }
    }
  }

  /**
   * Get opening balance for date
   */
  async getOpeningBalance(firmId, date) {
    // In real implementation, this would query the latest balance before date
    // For now, return default from Excel
    return 588565821.44
  }

  /**
   * Build employee forecast projection
   */
  async buildEmployeeForecastProjection(firmId, employeeId, startDate, endDate) {
    const timeline = await this.buildTimeline(firmId, startDate, endDate)
    
    const employeeForecasts = []
    
    timeline.forEach(node => {
      node.projections.forecastEvents
        .filter(event => event.data.employeeId === employeeId)
        .forEach(event => {
          employeeForecasts.push({
            date: node.date,
            eventId: event.id,
            aggregateId: event.aggregateId,
            customerName: event.data.customerName,
            customerInn: event.data.customerInn,
            contractNumber: event.data.contractNumber,
            amount: event.data.amount,
            status: event.data.status,
            expectedDate: event.data.expectedDate,
            actualDate: event.data.actualDate,
            actualAmount: event.data.actualAmount
          })
        })
    })
    
    return employeeForecasts
  }

  /**
   * Build expense workflow projection
   */
  async buildExpenseProjection(firmId, employeeId, startDate, endDate) {
    const timeline = await this.buildTimeline(firmId, startDate, endDate)
    
    const expenses = []
    
    timeline.forEach(node => {
      node.projections.expenseEvents
        .filter(event => event.data.employeeId === employeeId)
        .forEach(event => {
          expenses.push({
            date: node.date,
            eventId: event.id,
            aggregateId: event.aggregateId,
            subject: event.data.subject,
            counterparty: event.data.counterparty,
            amount: event.data.amount,
            status: event.data.status,
            plannedDate: event.data.plannedDate,
            actualDate: event.data.actualDate,
            actualAmount: event.data.actualAmount
          })
        })
    })
    
    return expenses
  }

  /**
   * Build reconciliation projection
   */
  async buildReconciliationProjection(firmId, startDate, endDate) {
    const timeline = await this.buildTimeline(firmId, startDate, endDate)
    
    const reconciliations = []
    
    timeline.forEach(node => {
      node.projections.reconciliationEvents.forEach(event => {
        reconciliations.push({
          date: node.date,
          eventId: event.id,
          statementLineId: event.data.statementLineId,
          matchedEntityId: event.data.matchedEntityId,
          matchedEntityType: event.data.matchedEntityType,
          matchType: event.data.matchType,
          confidence: event.data.confidence,
          confirmedBy: event.data.confirmedBy
        })
      })
    })
    
    return reconciliations
  }

  /**
   * Invalidate cache for firm
   */
  invalidateCache(firmId) {
    for (const [key, value] of this.cache) {
      if (key.startsWith(`${firmId}_`)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get timeline chunk for pagination
   */
  async getTimelineChunk(firmId, startDate, direction = 'forward', chunkSize = 30) {
    const endDate = this.addDays(startDate, chunkSize - 1)
    
    const timeline = await this.buildTimeline(firmId, startDate, endDate)
    
    return {
      startDate,
      endDate,
      timeline,
      hasMore: await this.hasMoreData(firmId, endDate, direction)
    }
  }

  /**
   * Check if there's more data beyond date
   */
  async hasMoreData(firmId, date, direction) {
    // In real implementation, this would query database
    // For now, assume there's always more data in future
    return direction === 'forward'
  }

  /**
   * Utility functions
   */
  isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate()
  }

  addDays(date, days) {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('ru-UZ', {
      style: 'currency',
      currency: 'UZS'
    }).format(amount)
  }
}

// Singleton instance
export const timelineEngine = new TimelineEngine()
