// Reconciliation Engine - Intelligent Matching and Confirmation System

import { financialEntityRepository } from './FinancialEntityStrategy.js'
import { stateMachineManager } from './StateMachine.js'
import { eventStore } from './FinancialEvent.js'

export class ReconciliationEngine {
  constructor() {
    this.MIN_CONFIDENCE_THRESHOLD = 0.3
    this.AUTO_MATCH_THRESHOLD = 0.8
    this.PARTIAL_MATCH_THRESHOLD = 0.5
    this.CONFLICT_THRESHOLD = 0.7
  }

  /**
   * Find matches for statement line against candidates
   */
  async findMatches(statementLine, candidates = []) {
    const matches = []
    
    // Get forecast candidates
    const forecastCandidates = candidates.filter(c => c.entityType === 'forecast')
    const expenseCandidates = candidates.filter(c => c.entityType === 'expense')
    
    // Match against forecasts
    for (const forecast of forecastCandidates) {
      const match = await this.calculateMatch(statementLine, forecast, 'forecast')
      if (match.confidence >= this.MIN_CONFIDENCE_THRESHOLD) {
        matches.push(match)
      }
    }
    
    // Match against expenses
    for (const expense of expenseCandidates) {
      const match = await this.calculateMatch(statementLine, expense, 'expense')
      if (match.confidence >= this.MIN_CONFIDENCE_THRESHOLD) {
        matches.push(match)
      }
    }
    
    // Sort by confidence (highest first)
    return matches.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Calculate match confidence between statement line and entity
   */
  async calculateMatch(statementLine, entity, entityType) {
    let confidence = 0
    const weights = {
      amount: 0.4,
      inn: 0.3,
      date: 0.2,
      description: 0.1
    }
    
    // Amount matching (40% weight)
    const amountDiff = Math.abs(statementLine.getAmount() - entity.amount)
    const amountScore = Math.max(0, 1 - (amountDiff / entity.amount))
    confidence += amountScore * weights.amount
    
    // INN matching (30% weight)
    let innScore = 0
    if (statementLine.getCounterpartyInn() && entity.metadata.customerInn) {
      innScore = statementLine.getCounterpartyInn() === entity.metadata.customerInn ? 1 : 0
    }
    confidence += innScore * weights.inn
    
    // Date proximity (20% weight)
    const statementDate = statementLine.getDocumentDate()
    const entityDate = entity.date
    const dateDiff = Math.abs(statementDate.getTime() - entityDate.getTime())
    const maxDateDiff = 7 * 24 * 60 * 60 * 1000 // 7 days
    const dateScore = Math.max(0, 1 - (dateDiff / maxDateDiff))
    confidence += dateScore * weights.date
    
    // Description matching (10% weight)
    const descriptionScore = await this.calculateDescriptionMatch(
      statementLine.metadata.description,
      entity,
      entityType
    )
    confidence += descriptionScore * weights.description
    
    // Determine match type
    let matchType = 'manual'
    if (confidence >= this.AUTO_MATCH_THRESHOLD) {
      matchType = 'auto'
    } else if (confidence >= this.PARTIAL_MATCH_THRESHOLD) {
      matchType = 'partial'
    }
    
    return {
      statementLineId: statementLine.id,
      matchedEntityId: entity.id,
      matchedEntityType: entityType,
      confidence: Math.round(confidence * 100) / 100,
      matchType,
      amountDifference: Math.abs(statementLine.getAmount() - entity.amount),
      matchedFields: this.getMatchedFields(statementLine, entity, entityType),
      conflicts: await this.detectConflicts(statementLine, entity),
      metadata: {
        amountScore: Math.round(amountScore * 100) / 100,
        innScore: Math.round(innScore * 100) / 100,
        dateScore: Math.round(dateScore * 100) / 100,
        descriptionScore: Math.round(descriptionScore * 100) / 100
      }
    }
  }

  /**
   * Calculate description match using fuzzy matching
   */
  async calculateDescriptionMatch(statementDescription, entity, entityType) {
    if (!statementDescription) return 0
    
    let score = 0
    const description = statementDescription.toLowerCase()
    
    // Check for contract number
    if (entityType === 'forecast' && entity.metadata.contractNumber) {
      const contractPattern = entity.metadata.contractNumber.toLowerCase()
      if (description.includes(contractPattern)) {
        score += 0.5
      }
    }
    
    // Check for company name
    if (entityType === 'forecast' && entity.metadata.customerName) {
      const customerPattern = entity.metadata.customerName.toLowerCase()
      if (description.includes(customerPattern)) {
        score += 0.3
      }
    }
    
    // Check for counterparty name
    if (entityType === 'expense' && entity.metadata.counterparty) {
      const counterpartyPattern = entity.metadata.counterparty.toLowerCase()
      if (description.includes(counterpartyPattern)) {
        score += 0.3
      }
    }
    
    // Check for keywords
    const positiveKeywords = ['оплата', 'payment', 'поступление', 'credit']
    const keywordMatches = positiveKeywords.filter(keyword => description.includes(keyword))
    score += Math.min(0.2, keywordMatches.length * 0.05)
    
    return Math.min(1, score)
  }

  /**
   * Get list of fields that matched
   */
  getMatchedFields(statementLine, entity, entityType) {
    const matchedFields = []
    
    // Amount field
    if (Math.abs(statementLine.getAmount() - entity.amount) < (entity.amount * 0.01)) { // 1% tolerance
      matchedFields.push('amount')
    }
    
    // INN field
    if (statementLine.getCounterpartyInn() && entity.metadata.customerInn &&
        statementLine.getCounterpartyInn() === entity.metadata.customerInn) {
      matchedFields.push('inn')
    }
    
    // Date field (within 3 days)
    const dateDiff = Math.abs(statementLine.getDocumentDate().getTime() - entity.date.getTime())
    if (dateDiff <= 3 * 24 * 60 * 60 * 1000) {
      matchedFields.push('date')
    }
    
    // Description field
    if (statementLine.metadata.description) {
      const description = statementLine.metadata.description.toLowerCase()
      
      if (entityType === 'forecast') {
        if (entity.metadata.contractNumber && 
            description.includes(entity.metadata.contractNumber.toLowerCase())) {
          matchedFields.push('contract')
        }
        if (entity.metadata.customerName && 
            description.includes(entity.metadata.customerName.toLowerCase())) {
          matchedFields.push('customer')
        }
      }
      
      if (entityType === 'expense') {
        if (entity.metadata.counterparty && 
            description.includes(entity.metadata.counterparty.toLowerCase())) {
          matchedFields.push('counterparty')
        }
      }
    }
    
    return matchedFields
  }

  /**
   * Detect potential conflicts
   */
  async detectConflicts(statementLine, entity) {
    const conflicts = []
    
    // Amount conflict (significant difference)
    const amountDiff = Math.abs(statementLine.getAmount() - entity.amount)
    if (amountDiff > (entity.amount * 0.1)) { // 10% difference
      conflicts.push({
        type: 'amount',
        severity: 'high',
        description: `Amount difference: ${amountDiff} (${Math.round(amountDiff / entity.amount * 100)}%)`
      })
    }
    
    // Date conflict (too far apart)
    const dateDiff = Math.abs(statementLine.getDocumentDate().getTime() - entity.date.getTime())
    if (dateDiff > 14 * 24 * 60 * 60 * 1000) { // 14 days
      conflicts.push({
        type: 'date',
        severity: 'medium',
        description: `Date difference: ${Math.round(dateDiff / (24 * 60 * 60 * 1000))} days`
      })
    }
    
    // Duplicate check
    const existingMatches = await this.findExistingMatches(entity.id)
    if (existingMatches.length > 0) {
      conflicts.push({
        type: 'duplicate',
        severity: 'high',
        description: `Entity already matched with ${existingMatches.length} statement lines`
      })
    }
    
    return conflicts
  }

  /**
   * Find existing matches for an entity
   */
  async findExistingMatches(entityId) {
    // In real implementation, this would query database
    // For now, return empty array
    return []
  }

  /**
   * Auto-match statement lines
   */
  async autoMatchStatementLines(statementLines, candidates) {
    const autoMatches = []
    const manualReviews = []
    
    for (const statementLine of statementLines) {
      const matches = await this.findMatches(statementLine, candidates)
      
      // Find best match
      const bestMatch = matches[0]
      
      if (bestMatch && bestMatch.confidence >= this.AUTO_MATCH_THRESHOLD) {
        // Auto-match
        autoMatches.push({
          statementLine,
          match: bestMatch,
          action: 'auto_match'
        })
        
        // Update statement line status
        await this.updateStatementLineStatus(statementLine.id, 'auto_matched', bestMatch)
        
      } else if (bestMatch && bestMatch.confidence >= this.MIN_CONFIDENCE_THRESHOLD) {
        // Manual review needed
        manualReviews.push({
          statementLine,
          matches,
          action: 'manual_review'
        })
        
        // Update statement line status
        await this.updateStatementLineStatus(statementLine.id, 'unmatched', { matches })
      } else {
        // No match found
        await this.updateStatementLineStatus(statementLine.id, 'unmatched')
      }
    }
    
    return {
      autoMatches,
      manualReviews,
      summary: {
        total: statementLines.length,
        autoMatched: autoMatches.length,
        manualReview: manualReviews.length,
        unmatched: statementLines.length - autoMatches.length - manualReviews.length
      }
    }
  }

  /**
   * Confirm reconciliation match
   */
  async confirmMatch(statementLineId, matchedEntityId, matchedEntityType, confirmedBy) {
    try {
      // Get statement line and entity
      const statementLine = financialEntityRepository.findById(statementLineId)
      const matchedEntity = financialEntityRepository.findById(matchedEntityId)
      
      if (!statementLine || !matchedEntity) {
        throw new Error('Statement line or matched entity not found')
      }
      
      // Calculate final match
      const match = await this.calculateMatch(statementLine, matchedEntity, matchedEntityType)
      
      // Update statement line
      statementLine.updateStatus('manual_matched', {
        matchedEntityId,
        matchedEntityType,
        confidence: match.confidence,
        confirmedBy
      })
      
      // Update entity status if it's a forecast
      if (matchedEntityType === 'forecast') {
        const forecastStateMachine = stateMachineManager.getMachine(matchedEntityId, 'forecast', matchedEntity.status)
        if (forecastStateMachine.canTransition('matched')) {
          forecastStateMachine.match({
            matchedStatementId: statementLineId,
            confidence: match.confidence
          })
        }
      }
      
      // Create reconciliation event
      const reconciliationEvent = {
        type: 'reconciliation.confirmed',
        aggregateId: statementLineId,
        data: {
          statementLineId,
          matchedEntityId,
          matchedEntityType,
          matchType: 'manual',
          confidence: match.confidence,
          confirmedBy
        },
        timestamp: new Date()
      }
      
      eventStore.saveEvent(reconciliationEvent)
      
      return {
        success: true,
        match,
        event: reconciliationEvent
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Reject match
   */
  async rejectMatch(statementLineId, reason, rejectedBy) {
    try {
      const statementLine = financialEntityRepository.findById(statementLineId)
      
      if (!statementLine) {
        throw new Error('Statement line not found')
      }
      
      // Update statement line status
      statementLine.updateStatus('unmatched', {
        rejectionReason: reason,
        rejectedBy
      })
      
      // Create rejection event
      const rejectionEvent = {
        type: 'reconciliation.rejected',
        aggregateId: statementLineId,
        data: {
          statementLineId,
          reason,
          rejectedBy
        },
        timestamp: new Date()
      }
      
      eventStore.saveEvent(rejectionEvent)
      
      return {
        success: true,
        event: rejectionEvent
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Get reconciliation suggestions for UI
   */
  async getReconciliationSuggestions(firmId, limit = 50) {
    // Get unmatched statement lines
    const unmatchedStatementLines = financialEntityRepository.findByFirmAndStatus(
      firmId, 
      'unmatched'
    ).filter(entity => entity.entityType === 'statement_line')
    
    // Get pending forecasts and expenses
    const pendingForecasts = financialEntityRepository.findByFirmAndStatus(
      firmId, 
      'expected'
    ).filter(entity => entity.entityType === 'forecast')
    
    const pendingExpenses = financialEntityRepository.findByFirmAndStatus(
      firmId, 
      'approved'
    ).filter(entity => entity.entityType === 'expense')
    
    const candidates = [...pendingForecasts, ...pendingExpenses]
    
    const suggestions = []
    
    for (const statementLine of unmatchedStatementLines.slice(0, limit)) {
      const matches = await this.findMatches(statementLine, candidates)
      
      if (matches.length > 0) {
        suggestions.push({
          statementLine,
          matches: matches.slice(0, 3), // Top 3 matches
          recommendation: this.getRecommendation(matches[0])
        })
      }
    }
    
    return suggestions
  }

  /**
   * Get recommendation based on match confidence
   */
  getRecommendation(bestMatch) {
    if (bestMatch.confidence >= this.AUTO_MATCH_THRESHOLD) {
      return {
        action: 'auto_confirm',
        message: 'High confidence match - can be auto-confirmed',
        confidence: bestMatch.confidence
      }
    } else if (bestMatch.confidence >= this.PARTIAL_MATCH_THRESHOLD) {
      return {
        action: 'manual_review',
        message: 'Medium confidence match - requires manual review',
        confidence: bestMatch.confidence
      }
    } else {
      return {
        action: 'low_confidence',
        message: 'Low confidence match - review carefully',
        confidence: bestMatch.confidence
      }
    }
  }

  /**
   * Update statement line status
   */
  async updateStatementLineStatus(statementLineId, status, metadata = {}) {
    const statementLine = financialEntityRepository.findById(statementLineId)
    if (statementLine) {
      statementLine.updateStatus(status, metadata)
      financialEntityRepository.save(statementLine)
    }
  }

  /**
   * Get reconciliation statistics
   */
  async getReconciliationStats(firmId, startDate, endDate) {
    const statementLines = financialEntityRepository.findInDateRange(firmId, startDate, endDate)
      .filter(entity => entity.entityType === 'statement_line')
    
    const stats = {
      total: statementLines.length,
      unmatched: 0,
      autoMatched: 0,
      manualMatched: 0,
      conflicts: 0,
      averageConfidence: 0,
      totalAmount: 0,
      matchedAmount: 0
    }
    
    let totalConfidence = 0
    let confidenceCount = 0
    
    for (const line of statementLines) {
      stats.totalAmount += line.getAmount()
      
      switch (line.status) {
        case 'unmatched':
          stats.unmatched++
          break
        case 'auto_matched':
          stats.autoMatched++
          stats.matchedAmount += line.getAmount()
          if (line.metadata.confidence) {
            totalConfidence += line.metadata.confidence
            confidenceCount++
          }
          break
        case 'manual_matched':
          stats.manualMatched++
          stats.matchedAmount += line.getAmount()
          if (line.metadata.confidence) {
            totalConfidence += line.metadata.confidence
            confidenceCount++
          }
          break
        case 'conflict':
          stats.conflicts++
          break
      }
    }
    
    stats.averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0
    stats.matchRate = stats.total > 0 ? (stats.autoMatched + stats.manualMatched) / stats.total : 0
    stats.autoMatchRate = stats.total > 0 ? stats.autoMatched / stats.total : 0
    
    return stats
  }
}

// Global reconciliation engine instance
export const reconciliationEngine = new ReconciliationEngine()
