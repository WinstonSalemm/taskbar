// State Machine Framework - Financial Entity Lifecycle Management

export class StateMachineError extends Error {
  constructor(message, currentState, attemptedState) {
    super(message)
    this.name = 'StateMachineError'
    this.currentState = currentState
    this.attemptedState = attemptedState
  }
}

export class ValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Base State Machine Class
 */
export class StateMachine {
  constructor(initialState, transitions, validators = {}) {
    this.currentState = initialState
    this.transitions = transitions
    this.validators = validators
    this.history = [{ state: initialState, timestamp: new Date() }]
  }

  canTransition(toState) {
    const allowedTransitions = this.transitions[this.currentState] || []
    return allowedTransitions.includes(toState)
  }

  transition(toState, context = {}) {
    if (!this.canTransition(toState)) {
      throw new StateMachineError(
        `Cannot transition from ${this.currentState} to ${toState}`,
        this.currentState,
        toState
      )
    }

    // Run validators if they exist
    if (this.validators[toState]) {
      this.validators[toState](this.currentState, toState, context)
    }

    const previousState = this.currentState
    this.currentState = toState
    this.history.push({
      state: toState,
      previousState,
      timestamp: new Date(),
      context
    })

    return {
      previousState,
      currentState: toState,
      timestamp: new Date(),
      context
    }
  }

  getCurrentState() {
    return this.currentState
  }

  getHistory() {
    return [...this.history]
  }

  isInState(state) {
    return this.currentState === state
  }

  reset(newState) {
    this.currentState = newState
    this.history = [{ state: newState, timestamp: new Date() }]
  }
}

/**
 * Forecast State Machine
 */
export class ForecastStateMachine extends StateMachine {
  constructor(initialState = 'draft') {
    const transitions = {
      'draft': ['planned', 'cancelled'],
      'planned': ['expected', 'cancelled'],
      'expected': ['matched', 'received', 'cancelled'],
      'matched': ['received', 'cancelled'],
      'received': ['archived'],
      'archived': [],
      'cancelled': []
    }

    const validators = {
      'expected': (from, to, context) => {
        if (!context.expectedDate) {
          throw new ValidationError('Expected date is required for expected status')
        }
      },
      'received': (from, to, context) => {
        if (!context.actualAmount && !context.actualDate) {
          throw new ValidationError('Actual amount and date are required for received status')
        }
        if (context.actualAmount && context.actualAmount <= 0) {
          throw new ValidationError('Actual amount must be greater than 0')
        }
      },
      'matched': (from, to, context) => {
        if (!context.matchedStatementId) {
          throw new ValidationError('Statement ID is required for matched status')
        }
      }
    }

    super(initialState, transitions, validators)
  }

  // Convenience methods
  plan(context = {}) {
    return this.transition('planned', context)
  }

  expect(context = {}) {
    return this.transition('expected', context)
  }

  match(context = {}) {
    return this.transition('matched', context)
  }

  receive(context = {}) {
    return this.transition('received', context)
  }

  archive(context = {}) {
    return this.transition('archived', context)
  }

  cancel(context = {}) {
    return this.transition('cancelled', context)
  }

  // Business logic helpers
  isActive() {
    return ['planned', 'expected', 'matched'].includes(this.currentState)
  }

  isCompleted() {
    return this.currentState === 'received'
  }

  isCancelled() {
    return this.currentState === 'cancelled'
  }

  canBeEdited() {
    return ['draft', 'planned'].includes(this.currentState)
  }

  canBeMatched() {
    return this.currentState === 'expected'
  }
}

/**
 * Expense State Machine
 */
export class ExpenseStateMachine extends StateMachine {
  constructor(initialState = 'draft') {
    const transitions = {
      'draft': ['submitted', 'cancelled'],
      'submitted': ['approved', 'rejected', 'cancelled'],
      'approved': ['scheduled', 'cancelled'],
      'scheduled': ['paid', 'cancelled'],
      'paid': ['reconciled'],
      'reconciled': ['archived'],
      'rejected': ['cancelled'],
      'cancelled': []
    }

    const validators = {
      'submitted': (from, to, context) => {
        if (!context.submittedBy) {
          throw new ValidationError('Submitted by is required for submitted status')
        }
      },
      'approved': (from, to, context) => {
        if (!context.approvedBy) {
          throw new ValidationError('Approved by is required for approved status')
        }
      },
      'scheduled': (from, to, context) => {
        if (!context.scheduledDate) {
          throw new ValidationError('Scheduled date is required for scheduled status')
        }
      },
      'paid': (from, to, context) => {
        if (!context.actualAmount && !context.paidDate) {
          throw new ValidationError('Actual amount and paid date are required for paid status')
        }
        if (context.actualAmount && context.actualAmount <= 0) {
          throw new ValidationError('Actual amount must be greater than 0')
        }
      },
      'rejected': (from, to, context) => {
        if (!context.rejectedBy || !context.reason) {
          throw new ValidationError('Rejected by and reason are required for rejected status')
        }
      }
    }

    super(initialState, transitions, validators)
  }

  // Convenience methods
  submit(context = {}) {
    return this.transition('submitted', context)
  }

  approve(context = {}) {
    return this.transition('approved', context)
  }

  schedule(context = {}) {
    return this.transition('scheduled', context)
  }

  pay(context = {}) {
    return this.transition('paid', context)
  }

  reconcile(context = {}) {
    return this.transition('reconciled', context)
  }

  reject(context = {}) {
    return this.transition('rejected', context)
  }

  cancel(context = {}) {
    return this.transition('cancelled', context)
  }

  archive(context = {}) {
    return this.transition('archived', context)
  }

  // Business logic helpers
  needsApproval() {
    return this.currentState === 'submitted'
  }

  isApproved() {
    return ['approved', 'scheduled', 'paid', 'reconciled'].includes(this.currentState)
  }

  isPaid() {
    return ['paid', 'reconciled'].includes(this.currentState)
  }

  isCompleted() {
    return ['reconciled', 'archived'].includes(this.currentState)
  }

  isCancelled() {
    return this.currentState === 'cancelled'
  }

  canBeEdited() {
    return this.currentState === 'draft'
  }

  canBeSubmitted() {
    return this.currentState === 'draft'
  }

  canBeApproved() {
    return this.currentState === 'submitted'
  }

  canBePaid() {
    return ['approved', 'scheduled'].includes(this.currentState)
  }
}

/**
 * Reconciliation State Machine
 */
export class ReconciliationStateMachine extends StateMachine {
  constructor(initialState = 'unmatched') {
    const transitions = {
      'unmatched': ['auto_matched', 'manual_matched', 'partial_match', 'conflict', 'ignored'],
      'auto_matched': ['manual_matched', 'conflict', 'ignored'],
      'manual_matched': ['conflict', 'ignored'],
      'partial_match': ['manual_matched', 'conflict', 'ignored'],
      'conflict': ['manual_matched', 'ignored'],
      'ignored': []
    }

    const validators = {
      'auto_matched': (from, to, context) => {
        if (!context.confidence || context.confidence < 0.8) {
          throw new ValidationError('High confidence (>= 0.8) is required for auto match')
        }
      },
      'manual_matched': (from, to, context) => {
        if (!context.confirmedBy) {
          throw new ValidationError('Confirmed by is required for manual match')
        }
      },
      'partial_match': (from, to, context) => {
        if (!context.amountDifference) {
          throw new ValidationError('Amount difference is required for partial match')
        }
      },
      'conflict': (from, to, context) => {
        if (!context.conflicts || context.conflicts.length === 0) {
          throw new ValidationError('Conflicts array is required for conflict status')
        }
      }
    }

    super(initialState, transitions, validators)
  }

  // Convenience methods
  autoMatch(context = {}) {
    return this.transition('auto_matched', context)
  }

  manualMatch(context = {}) {
    return this.transition('manual_matched', context)
  }

  partialMatch(context = {}) {
    return this.transition('partial_match', context)
  }

  conflict(context = {}) {
    return this.transition('conflict', context)
  }

  ignore(context = {}) {
    return this.transition('ignored', context)
  }

  // Business logic helpers
  isMatched() {
    return ['auto_matched', 'manual_matched'].includes(this.currentState)
  }

  isUnmatched() {
    return this.currentState === 'unmatched'
  }

  hasConflict() {
    return this.currentState === 'conflict'
  }

  isIgnored() {
    return this.currentState === 'ignored'
  }

  canBeManuallyMatched() {
    return ['unmatched', 'auto_matched', 'partial_match', 'conflict'].includes(this.currentState)
  }
}

/**
 * State Machine Factory
 */
export class StateMachineFactory {
  static create(type, initialState) {
    switch (type) {
      case 'forecast':
        return new ForecastStateMachine(initialState)
      case 'expense':
        return new ExpenseStateMachine(initialState)
      case 'reconciliation':
        return new ReconciliationStateMachine(initialState)
      default:
        throw new Error(`Unknown state machine type: ${type}`)
    }
  }

  static createForEntity(entity) {
    switch (entity.entityType) {
      case 'forecast':
        return new ForecastStateMachine(entity.status)
      case 'expense':
        return new ExpenseStateMachine(entity.status)
      case 'statement_line':
        return new ReconciliationStateMachine(entity.status)
      default:
        throw new Error(`Cannot create state machine for entity type: ${entity.entityType}`)
    }
  }
}

/**
 * State Machine Manager - Centralized state management
 */
export class StateMachineManager {
  constructor() {
    this.machines = new Map() // entityId -> stateMachine
  }

  getMachine(entityId, type, initialState) {
    if (!this.machines.has(entityId)) {
      this.machines.set(entityId, StateMachineFactory.create(type, initialState))
    }
    return this.machines.get(entityId)
  }

  removeMachine(entityId) {
    return this.machines.delete(entityId)
  }

  getAllMachines() {
    return new Map(this.machines)
  }

  getMachineStats() {
    const stats = {
      total: this.machines.size,
      byType: {},
      byState: {}
    }

    for (const [entityId, machine] of this.machines) {
      const state = machine.getCurrentState()
      
      // Count by state
      stats.byState[state] = (stats.byState[state] || 0) + 1
      
      // Count by type would need type info - simplified for now
    }

    return stats
  }

  reset() {
    this.machines.clear()
  }
}

// Global state machine manager instance
export const stateMachineManager = new StateMachineManager()
