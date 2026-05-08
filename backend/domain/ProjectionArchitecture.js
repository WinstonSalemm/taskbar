// Projection Architecture - Building Dynamic Views from Source Data

import { timelineEngine } from './TimelineEngine.js'

export class ProjectionBuilder {
  constructor() {
    this.cache = new Map()
    this.CACHE_TTL = 2 * 60 * 1000 // 2 minutes
  }

  /**
   * Build employee forecast sections projection
   */
  async buildEmployeeForecastSections(firmId, startDate, endDate) {
    const cacheKey = `employee_sections_${firmId}_${startDate.toISOString()}_${endDate.toISOString()}`
    
    const cached = this.cache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.data
    }

    // Get forecast events from timeline
    const timeline = await timelineEngine.buildTimeline(firmId, startDate, endDate)
    
    // Group forecasts by employee
    const employeeGroups = new Map()
    
    timeline.forEach(node => {
      node.projections.forecastEvents.forEach(event => {
        const employeeId = event.data.employeeId
        const employeeName = event.data.employeeName || `Employee ${employeeId}`
        
        if (!employeeGroups.has(employeeId)) {
          employeeGroups.set(employeeId, {
            employeeId,
            employeeName,
            forecasts: [],
            total: 0,
            status: 'planned'
          })
        }
        
        const group = employeeGroups.get(employeeId)
        const forecastData = {
          id: event.aggregateId,
          eventId: event.id,
          customerName: event.data.customerName,
          customerInn: event.data.customerInn,
          contractNumber: event.data.contractNumber,
          paymentType: event.data.paymentType,
          amount: event.data.amount,
          expectedDate: event.data.expectedDate,
          actualDate: event.data.actualDate,
          actualAmount: event.data.actualAmount,
          status: event.data.status,
          date: node.date
        }
        
        group.forecasts.push(forecastData)
        group.total += event.data.amount || 0
      })
    })
    
    // Compute section status
    employeeGroups.forEach(group => {
      const hasPending = group.forecasts.some(f => f.status === 'expected')
      const hasCompleted = group.forecasts.some(f => f.status === 'received')
      const hasCancelled = group.forecasts.some(f => f.status === 'cancelled')
      
      if (hasCancelled) {
        group.status = 'cancelled'
      } else if (hasPending) {
        group.status = 'active'
      } else if (hasCompleted) {
        group.status = 'completed'
      } else {
        group.status = 'planned'
      }
    })
    
    const result = Array.from(employeeGroups.values())
    
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    })
    
    return result
  }

  /**
   * Build expense workflow projection
   */
  async buildExpenseWorkflowProjection(firmId, startDate, endDate, employeeId = null) {
    const cacheKey = `expense_workflow_${firmId}_${startDate.toISOString()}_${endDate.toISOString()}_${employeeId || 'all'}`
    
    const cached = this.cache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.data
    }

    const timeline = await timelineEngine.buildTimeline(firmId, startDate, endDate)
    
    const expenses = []
    const statusGroups = {
      draft: [],
      submitted: [],
      approved: [],
      scheduled: [],
      paid: [],
      reconciled: [],
      rejected: [],
      cancelled: []
    }
    
    timeline.forEach(node => {
      node.projections.expenseEvents.forEach(event => {
        if (employeeId && event.data.employeeId !== employeeId) {
          return
        }
        
        const expenseData = {
          id: event.aggregateId,
          eventId: event.id,
          employeeId: event.data.employeeId,
          employeeName: event.data.employeeName,
          subject: event.data.subject,
          counterparty: event.data.counterparty,
          basis: event.data.basis,
          amount: event.data.amount,
          plannedDate: event.data.plannedDate,
          actualDate: event.data.actualDate,
          actualAmount: event.data.actualAmount,
          status: event.data.status,
          workflowData: event.data.workflowData || {},
          date: node.date
        }
        
        expenses.push(expenseData)
        
        if (statusGroups[expenseData.status]) {
          statusGroups[expenseData.status].push(expenseData)
        }
      })
    })
    
    const result = {
      expenses,
      statusGroups,
      summary: {
        total: expenses.length,
        pendingApproval: statusGroups.submitted.length,
        approved: statusGroups.approved.length,
        paid: statusGroups.paid.length,
        rejected: statusGroups.rejected.length
      }
    }
    
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    })
    
    return result
  }

  /**
   * Build reconciliation projection
   */
  async buildReconciliationProjection(firmId, startDate, endDate) {
    const cacheKey = `reconciliation_${firmId}_${startDate.toISOString()}_${endDate.toISOString()}`
    
    const cached = this.cache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.data
    }

    const timeline = await timelineEngine.buildTimeline(firmId, startDate, endDate)
    
    const reconciliations = []
    const unmatched = []
    const conflicts = []
    
    timeline.forEach(node => {
      node.projections.reconciliationEvents.forEach(event => {
        const reconciliationData = {
          id: event.id,
          statementLineId: event.data.statementLineId,
          matchedEntityId: event.data.matchedEntityId,
          matchedEntityType: event.data.matchedEntityType,
          matchType: event.data.matchType,
          confidence: event.data.confidence,
          confirmedBy: event.data.confirmedBy,
          date: node.date
        }
        
        reconciliations.push(reconciliationData)
        
        if (event.data.matchType === 'conflict') {
          conflicts.push(reconciliationData)
        }
      })
    })
    
    const result = {
      reconciliations,
      unmatched,
      conflicts,
      summary: {
        total: reconciliations.length,
        autoMatched: reconciliations.filter(r => r.matchType === 'auto').length,
        manualMatched: reconciliations.filter(r => r.matchType === 'manual').length,
        conflicts: conflicts.length
      }
    }
    
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    })
    
    return result
  }

  /**
   * Build cashflow timeline projection (Excel-like view)
   */
  async buildCashflowTimelineProjection(firmId, startDate, endDate) {
    const cacheKey = `cashflow_timeline_${firmId}_${startDate.toISOString()}_${endDate.toISOString()}`
    
    const cached = this.cache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.data
    }

    const timeline = await timelineEngine.buildTimeline(firmId, startDate, endDate)
    
    const cashflowRows = timeline.map(node => ({
      date: node.date,
      openingBalance: node.openingBalance,
      confirmedIncome: node.confirmedIncome,
      confirmedExpense: node.confirmedExpense,
      expectedIncome: node.expectedIncome,
      expectedExpense: node.expectedExpense,
      closingBalance: node.closingBalance,
      projectedBalance: node.projectedBalance,
      deviation: node.closingBalance - node.projectedBalance,
      events: node.events,
      hasActivity: node.events.length > 0
    }))
    
    // Calculate totals
    const totals = cashflowRows.reduce((acc, row) => ({
      totalConfirmedIncome: acc.totalConfirmedIncome + row.confirmedIncome,
      totalConfirmedExpense: acc.totalConfirmedExpense + row.confirmedExpense,
      totalExpectedIncome: acc.totalExpectedIncome + row.expectedIncome,
      totalExpectedExpense: acc.totalExpectedExpense + row.expectedExpense
    }), {
      totalConfirmedIncome: 0,
      totalConfirmedExpense: 0,
      totalExpectedIncome: 0,
      totalExpectedExpense: 0
    })
    
    const result = {
      rows: cashflowRows,
      totals,
      summary: {
        openingBalance: cashflowRows[0]?.openingBalance || 0,
        closingBalance: cashflowRows[cashflowRows.length - 1]?.closingBalance || 0,
        netIncome: totals.totalConfirmedIncome - totals.totalConfirmedExpense,
        projectedNetIncome: totals.totalExpectedIncome - totals.totalExpectedExpense,
        accuracy: totals.totalExpectedIncome > 0 
          ? (totals.totalConfirmedIncome / totals.totalExpectedIncome) * 100 
          : 0
      }
    }
    
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    })
    
    return result
  }

  /**
   * Build daily summary projection
   */
  async buildDailySummaryProjection(firmId, date) {
    const startDate = new Date(date)
    const endDate = new Date(date)
    endDate.setHours(23, 59, 59, 999)
    
    const timeline = await timelineEngine.buildTimeline(firmId, startDate, endDate)
    const dayNode = timeline[0]
    
    if (!dayNode) {
      return {
        date,
        isEmpty: true
      }
    }
    
    return {
      date: dayNode.date,
      openingBalance: dayNode.openingBalance,
      closingBalance: dayNode.closingBalance,
      projectedBalance: dayNode.projectedBalance,
      confirmedIncome: dayNode.confirmedIncome,
      confirmedExpense: dayNode.confirmedExpense,
      expectedIncome: dayNode.expectedIncome,
      expectedExpense: dayNode.expectedExpense,
      deviation: dayNode.closingBalance - dayNode.projectedBalance,
      events: dayNode.events,
      forecastCount: dayNode.projections.forecastEvents.length,
      expenseCount: dayNode.projections.expenseEvents.length,
      reconciliationCount: dayNode.projections.reconciliationEvents.length,
      hasActivity: dayNode.events.length > 0,
      isEmpty: false
    }
  }

  /**
   * Build employee performance projection
   */
  async buildEmployeePerformanceProjection(firmId, startDate, endDate, employeeId) {
    const employeeForecasts = await timelineEngine.buildEmployeeForecastProjection(firmId, employeeId, startDate, endDate)
    const employeeExpenses = await timelineEngine.buildExpenseProjection(firmId, employeeId, startDate, endDate)
    
    const forecastStats = this.calculateForecastStats(employeeForecasts)
    const expenseStats = this.calculateExpenseStats(employeeExpenses)
    
    return {
      employeeId,
      period: { startDate, endDate },
      forecasts: {
        total: employeeForecasts.length,
        completed: employeeForecasts.filter(f => f.status === 'received').length,
        pending: employeeForecasts.filter(f => f.status === 'expected').length,
        cancelled: employeeForecasts.filter(f => f.status === 'cancelled').length,
        totalAmount: employeeForecasts.reduce((sum, f) => sum + (f.amount || 0), 0),
        completedAmount: employeeForecasts.filter(f => f.status === 'received').reduce((sum, f) => sum + (f.actualAmount || 0), 0),
        accuracy: forecastStats.accuracy
      },
      expenses: {
        total: employeeExpenses.length,
        approved: employeeExpenses.filter(e => e.status === 'approved').length,
        paid: employeeExpenses.filter(e => e.status === 'paid').length,
        rejected: employeeExpenses.filter(e => e.status === 'rejected').length,
        totalAmount: employeeExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
        paidAmount: employeeExpenses.filter(e => e.status === 'paid').reduce((sum, e) => sum + (e.actualAmount || 0), 0)
      },
      netImpact: forecastStats.completedAmount - expenseStats.paidAmount
    }
  }

  /**
   * Calculate forecast statistics
   */
  calculateForecastStats(forecasts) {
    const completed = forecasts.filter(f => f.status === 'received')
    const totalExpected = forecasts.reduce((sum, f) => sum + (f.amount || 0), 0)
    const totalCompleted = completed.reduce((sum, f) => sum + (f.actualAmount || 0), 0)
    
    return {
      accuracy: totalExpected > 0 ? (totalCompleted / totalExpected) * 100 : 0,
      completionRate: forecasts.length > 0 ? (completed.length / forecasts.length) * 100 : 0,
      totalExpected,
      totalCompleted
    }
  }

  /**
   * Calculate expense statistics
   */
  calculateExpenseStats(expenses) {
    const paid = expenses.filter(e => e.status === 'paid')
    const totalRequested = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
    const totalPaid = paid.reduce((sum, e) => sum + (e.actualAmount || 0), 0)
    
    return {
      approvalRate: expenses.length > 0 ? (expenses.filter(e => e.status === 'approved' || e.status === 'paid').length / expenses.length) * 100 : 0,
      totalRequested,
      totalPaid
    }
  }

  /**
   * Invalidate cache patterns
   */
  invalidateCache(pattern) {
    for (const [key, value] of this.cache) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear()
  }
}

// Singleton instance
export const projectionBuilder = new ProjectionBuilder()
