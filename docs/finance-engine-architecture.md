# Finance Engine Architecture

## 1. DOMAIN MODEL

### Core Distinction: Source vs Projection

```
SOURCE ENTITIES (Canonical Data)
├── ForecastEntry
├── ExpenseRequest  
├── BankStatementLine
├── ReconciliationEvent
└── EmployeeForecastSettings

DERIVED PROJECTIONS (Computed Views)
├── DailyCashflowProjection
├── EmployeeForecastSection
├── ExpenseWorkflowState
├── ReconciliationMatch
└── TimelineNode
```

### Source Entities

#### ForecastEntry (Aggregate Root)
```typescript
interface ForecastEntry {
  id: string
  firmId: string
  employeeId: string
  customerId: string
  customerInn?: string
  contractNumber?: string
  paymentType: 'prepayment' | 'payment'
  amount: Money
  expectedDate: Date
  status: ForecastStatus
  actualDate?: Date
  actualAmount?: Money
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}
```

#### ExpenseRequest (Aggregate Root)
```typescript
interface ExpenseRequest {
  id: string
  firmId: string
  employeeId: string
  subject: string
  counterparty?: string
  basis?: string
  amount: Money
  plannedDate: Date
  status: ExpenseStatus
  workflowData: WorkflowState
  scheduledDate?: Date
  actualDate?: Date
  actualAmount?: Money
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}
```

#### BankStatementLine (Immutable Event)
```typescript
interface BankStatementLine {
  id: string
  firmId: string
  documentDate: Date
  docNumber: string
  accountName: string
  accountInn?: string
  accountNumber: string
  mfo: string
  creditTurnover?: Money
  debitTurnover?: Money
  description: string
  counterpartyName?: string
  counterpartyInn?: string
  reconciliationStatus: ReconciliationStatus
  matchedForecastId?: string
  matchedExpenseId?: string
  confidence?: number
  createdAt: Date
}
```

#### ReconciliationEvent (Event Sourcing)
```typescript
interface ReconciliationEvent {
  id: string
  firmId: string
  statementLineId: string
  matchedEntityId: string
  matchedEntityType: 'forecast' | 'expense'
  matchType: 'auto' | 'manual' | 'partial'
  confidence: number
  amountDifference?: Money
  metadata: Record<string, any>
  createdBy: string
  createdAt: Date
}
```

### Lifecycle States

#### ForecastStatus
```typescript
enum ForecastStatus {
  DRAFT = 'draft',
  PLANNED = 'planned', 
  EXPECTED = 'expected',
  MATCHED = 'matched',
  RECEIVED = 'received',
  ARCHIVED = 'archived',
  CANCELLED = 'cancelled'
}
```

#### ExpenseStatus
```typescript
enum ExpenseStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  SCHEDULED = 'scheduled',
  PAID = 'paid',
  RECONCILED = 'reconciled',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled'
}
```

#### ReconciliationStatus
```typescript
enum ReconciliationStatus {
  UNMATCHED = 'unmatched',
  AUTO_MATCHED = 'auto_matched',
  MANUAL_MATCHED = 'manual_matched',
  PARTIAL_MATCH = 'partial_match',
  CONFLICT = 'conflict',
  IGNORED = 'ignored'
}
```

## 2. EVENT MODEL

### Financial Events (Event Sourcing)

```typescript
// Forecast Events
interface ForecastCreatedEvent {
  type: 'forecast.created'
  aggregateId: string
  data: Omit<ForecastEntry, 'id' | 'createdAt' | 'updatedAt'>
  timestamp: Date
}

interface ForecastStatusChangedEvent {
  type: 'forecast.status_changed'
  aggregateId: string
  fromStatus: ForecastStatus
  toStatus: ForecastStatus
  metadata?: Record<string, any>
  timestamp: Date
}

// Expense Events  
interface ExpenseCreatedEvent {
  type: 'expense.created'
  aggregateId: string
  data: Omit<ExpenseRequest, 'id' | 'createdAt' | 'updatedAt'>
  timestamp: Date
}

interface ExpenseApprovedEvent {
  type: 'expense.approved'
  aggregateId: string
  approvedBy: string
  scheduledDate?: Date
  timestamp: Date
}

// Statement Events
interface StatementImportedEvent {
  type: 'statement.imported'
  batchId: string
  lines: BankStatementLine[]
  timestamp: Date
}

// Reconciliation Events
interface ReconciliationConfirmedEvent {
  type: 'reconciliation.confirmed'
  statementLineId: string
  matchedEntityId: string
  matchedEntityType: 'forecast' | 'expense'
  matchType: 'auto' | 'manual'
  confidence: number
  confirmedBy: string
  timestamp: Date
}
```

### Event Flow Architecture

```
User Action → Domain Command → Business Logic → Domain Event → Event Store → Projection Update → UI Update
```

## 3. TIMELINE ENGINE

### Core Algorithm

```typescript
class TimelineEngine {
  async buildTimeline(
    firmId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<TimelineNode[]> {
    
    // 1. Load source events within date range
    const events = await this.loadSourceEvents(firmId, startDate, endDate)
    
    // 2. Sort by date and type priority
    const sortedEvents = this.sortEventsChronologically(events)
    
    // 3. Build daily nodes
    const timelineNodes: TimelineNode[] = []
    let currentDate = new Date(startDate)
    let runningBalance = await this.getOpeningBalance(firmId, startDate)
    
    while (currentDate <= endDate) {
      const dayEvents = sortedEvents.filter(
        event => this.isSameDay(event.timestamp, currentDate)
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
    
    return timelineNodes
  }
  
  private computeDayProjection(
    date: Date,
    events: FinancialEvent[],
    openingBalance: Money
  ): TimelineNode {
    
    const confirmedIncome = events
      .filter(e => e.type === 'reconciliation.confirmed' && e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0)
      
    const confirmedExpense = events
      .filter(e => e.type === 'expense.paid')
      .reduce((sum, e) => sum + e.amount, 0)
      
    const expectedIncome = events
      .filter(e => e.type === 'forecast.expected')
      .reduce((sum, e) => sum + e.amount, 0)
      
    const expectedExpense = events
      .filter(e => e.type === 'expense.approved')
      .reduce((sum, e) => sum + e.amount, 0)
    
    return {
      date,
      openingBalance,
      confirmedIncome,
      confirmedExpense,
      expectedIncome,
      expectedExpense,
      closingBalance: openingBalance + confirmedIncome - confirmedExpense,
      projectedBalance: openingBalance + expectedIncome - expectedExpense,
      events
    }
  }
}
```

### Timeline Node Structure

```typescript
interface TimelineNode {
  date: Date
  openingBalance: Money
  confirmedIncome: Money
  confirmedExpense: Money
  expectedIncome: Money
  expectedExpense: Money
  closingBalance: Money
  projectedBalance: Money
  events: FinancialEvent[]
  projections: {
    employeeForecasts: EmployeeForecastProjection[]
    expenseSections: ExpenseSectionProjection[]
    reconciliationMatches: ReconciliationMatch[]
  }
}
```

## 4. PROJECTION ARCHITECTURE

### Projection Strategy

```typescript
interface ProjectionBuilder<T> {
  build(source: SourceEntity[]): T
  rebuild(source: SourceEntity[]): T
  update(source: SourceEntity, event: FinancialEvent): T
}

class EmployeeForecastProjectionBuilder 
  implements ProjectionBuilder<EmployeeForecastSection[]> {
    
  build(forecasts: ForecastEntry[]): EmployeeForecastSection[] {
    // Group by employee
    const employeeGroups = this.groupByEmployee(forecasts)
    
    return Object.entries(employeeGroups).map(([employeeId, forecasts]) => ({
      employeeId,
      employeeName: forecasts[0].employeeName,
      forecasts: forecasts.map(f => this.mapToForecastItem(f)),
      total: forecasts.reduce((sum, f) => sum + f.amount, 0),
      status: this.computeSectionStatus(forecasts)
    }))
  }
  
  private computeSectionStatus(forecasts: ForecastEntry[]): SectionStatus {
    const hasPending = forecasts.some(f => f.status === 'expected')
    const hasCompleted = forecasts.some(f => f.status === 'received')
    
    if (hasPending) return 'active'
    if (hasCompleted) return 'completed'
    return 'planned'
  }
}
```

### Dynamic Rendering Architecture

```typescript
class ProjectionRenderer {
  renderEmployeeSection(
    projection: EmployeeForecastSection,
    container: HTMLElement
  ): void {
    
    const section = this.createSectionElement(projection)
    
    // Dynamic forecast items
    projection.forecasts.forEach(forecast => {
      const item = this.createForecastItem(forecast)
      section.appendChild(item)
    })
    
    // Summary row
    const summary = this.createSummaryRow(projection.total)
    section.appendChild(summary)
    
    container.appendChild(section)
  }
  
  renderCashflowTimeline(
    timeline: TimelineNode[],
    container: HTMLElement
  ): void {
    
    const table = this.createTimelineTable()
    
    timeline.forEach(node => {
      const row = this.createTimelineRow(node)
      table.appendChild(row)
    })
    
    container.appendChild(table)
  }
}
```

## 5. FINANCIAL ENTITY STRATEGY

### Unified Financial Entity Pattern

```typescript
// Base interface for all financial entities
interface FinancialEntity {
  id: string
  firmId: string
  entityType: FinancialEntityType
  amount: Money
  date: Date
  status: string
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

enum FinancialEntityType {
  FORECAST = 'forecast',
  EXPENSE = 'expense',
  STATEMENT_LINE = 'statement_line',
  RECONCILIATION = 'reconciliation'
}

// Type-safe entity handling
class FinancialEntityFactory {
  static create<T extends FinancialEntity>(
    type: FinancialEntityType,
    data: Omit<T, 'id' | 'entityType' | 'createdAt' | 'updatedAt'>
  ): T {
    
    const entity = {
      ...data,
      entityType: type,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    } as T
    
    return this.validateEntity(entity)
  }
  
  static validateEntity<T extends FinancialEntity>(entity: T): T {
    // Type-specific validation
    switch (entity.entityType) {
      case FinancialEntityType.FORECAST:
        return this.validateForecast(entity as ForecastEntry)
      case FinancialEntityType.EXPENSE:
        return this.validateExpense(entity as ExpenseRequest)
      // ... other types
    }
  }
}
```

### JSONB vs Strict Columns Strategy

```typescript
// Use JSONB for:
interface FlexibleMetadata {
  // Dynamic fields that vary by entity type
  contractDetails?: Record<string, any>
  customFields?: Record<string, any>
  integrationData?: Record<string, any>
  auditTrail?: AuditEntry[]
}

// Use strict columns for:
interface CoreFinancialData {
  // Fields used in queries, joins, indexes
  id: string
  firmId: string
  amount: decimal
  date: timestamp
  status: varchar(20)
  // Performance-critical fields
}
```

## 6. STATE MACHINES

### Forecast State Machine

```typescript
class ForecastStateMachine {
  private transitions: Record<ForecastStatus, ForecastStatus[]> = {
    [ForecastStatus.DRAFT]: [ForecastStatus.PLANNED, ForecastStatus.CANCELLED],
    [ForecastStatus.PLANNED]: [ForecastStatus.EXPECTED, ForecastStatus.CANCELLED],
    [ForecastStatus.EXPECTED]: [ForecastStatus.MATCHED, ForecastStatus.RECEIVED, ForecastStatus.CANCELLED],
    [ForecastStatus.MATCHED]: [ForecastStatus.RECEIVED, ForecastStatus.CANCELLED],
    [ForecastStatus.RECEIVED]: [ForecastStatus.ARCHIVED],
    [ForecastStatus.ARCHIVED]: [],
    [ForecastStatus.CANCELLED]: []
  }
  
  canTransition(from: ForecastStatus, to: ForecastStatus): boolean {
    return this.transitions[from]?.includes(to) || false
  }
  
  transition(
    current: ForecastStatus, 
    to: ForecastStatus,
    context?: Record<string, any>
  ): ForecastStatus {
    
    if (!this.canTransition(current, to)) {
      throw new InvalidTransitionError(current, to)
    }
    
    this.validateTransition(current, to, context)
    return to
  }
  
  private validateTransition(
    from: ForecastStatus, 
    to: ForecastStatus, 
    context?: Record<string, any>
  ): void {
    switch (to) {
      case ForecastStatus.RECEIVED:
        if (!context?.actualAmount) {
          throw new ValidationError('Actual amount required for received status')
        }
        break
      case ForecastStatus.MATCHED:
        if (!context?.matchedStatementId) {
          throw new ValidationError('Statement ID required for matched status')
        }
        break
    }
  }
}
```

### Expense State Machine

```typescript
class ExpenseStateMachine {
  private transitions: Record<ExpenseStatus, ExpenseStatus[]> = {
    [ExpenseStatus.DRAFT]: [ExpenseStatus.SUBMITTED, ExpenseStatus.CANCELLED],
    [ExpenseStatus.SUBMITTED]: [ExpenseStatus.APPROVED, ExpenseStatus.REJECTED, ExpenseStatus.CANCELLED],
    [ExpenseStatus.APPROVED]: [ExpenseStatus.SCHEDULED, ExpenseStatus.CANCELLED],
    [ExpenseStatus.SCHEDULED]: [ExpenseStatus.PAID, ExpenseStatus.CANCELLED],
    [ExpenseStatus.PAID]: [ExpenseStatus.RECONCILED],
    [ExpenseStatus.RECONCILED]: [ExpenseStatus.ARCHIVED],
    [ExpenseStatus.REJECTED]: [ExpenseStatus.CANCELLED],
    [ExpenseStatus.CANCELLED]: []
  }
  
  // Similar implementation to ForecastStateMachine
  // with expense-specific validation rules
}
```

## 7. RECONCILIATION ENGINE

### Matching Strategy

```typescript
class ReconciliationEngine {
  async findMatches(
    statementLine: BankStatementLine,
    candidates: (ForecastEntry | ExpenseRequest)[]
  ): Promise<ReconciliationMatch[]> {
    
    const matches: ReconciliationMatch[] = []
    
    for (const candidate of candidates) {
      const confidence = this.calculateMatchConfidence(statementLine, candidate)
      
      if (confidence >= this.MIN_CONFIDENCE_THRESHOLD) {
        matches.push({
          statementLineId: statementLine.id,
          matchedEntityId: candidate.id,
          matchedEntityType: this.getEntityType(candidate),
          confidence,
          matchType: confidence >= this.AUTO_MATCH_THRESHOLD ? 'auto' : 'manual',
          amountDifference: Math.abs(statementLine.amount - candidate.amount),
          matchedFields: this.getMatchedFields(statementLine, candidate)
        })
      }
    }
    
    return matches.sort((a, b) => b.confidence - a.confidence)
  }
  
  private calculateMatchConfidence(
    statementLine: BankStatementLine,
    entity: ForecastEntry | ExpenseRequest
  ): number {
    
    let confidence = 0
    
    // Amount matching (40% weight)
    const amountDiff = Math.abs(statementLine.amount - entity.amount)
    const amountScore = Math.max(0, 1 - (amountDiff / entity.amount)) * 0.4
    confidence += amountScore
    
    // INN matching (30% weight)
    if (statementLine.counterpartyInn && entity.customerInn) {
      const innScore = statementLine.counterpartyInn === entity.customerInn ? 0.3 : 0
      confidence += innScore
    }
    
    // Date proximity (20% weight)
    const dateDiff = Math.abs(statementLine.documentDate.getTime() - entity.date.getTime())
    const dateScore = Math.max(0, 1 - (dateDiff / (7 * 24 * 60 * 60 * 1000))) * 0.2 // 7 days
    confidence += dateScore
    
    // Description matching (10% weight)
    const descriptionScore = this.calculateDescriptionMatch(
      statementLine.description, 
      entity
    ) * 0.1
    confidence += descriptionScore
    
    return confidence
  }
  
  private calculateDescriptionMatch(
    description: string,
    entity: ForecastEntry | ExpenseRequest
  ): number {
    // Implement fuzzy string matching
    // Check for contract numbers, company names, etc.
    return 0 // Placeholder
  }
}
```

### Reconciliation Match Structure

```typescript
interface ReconciliationMatch {
  statementLineId: string
  matchedEntityId: string
  matchedEntityType: 'forecast' | 'expense'
  confidence: number
  matchType: 'auto' | 'manual' | 'partial'
  amountDifference: Money
  matchedFields: string[]
  conflicts?: string[]
  metadata: Record<string, any>
}
```

## 8. UI ARCHITECTURE

### Timeline-First UX Pattern

```typescript
interface TimelineView {
  // Core timeline component
  renderTimeline(timeline: TimelineNode[]): void
  
  // Detail panel for selected node
  renderNodeDetail(node: TimelineNode): void
  
  // Event drilldown
  renderEventDetail(event: FinancialEvent): void
  
  // Entity inspection
  renderEntityDetail(entity: FinancialEntity): void
}

class TimelineController {
  private selectedDate?: Date
  private selectedEntity?: FinancialEntity
  private viewMode: 'day' | 'week' | 'month' = 'day'
  
  async selectDate(date: Date): Promise<void> {
    this.selectedDate = date
    
    // Load timeline for selected period
    const timeline = await this.timelineEngine.buildTimeline(
      this.firmId,
      this.getPeriodStart(date),
      this.getPeriodEnd(date)
    )
    
    this.timelineView.renderTimeline(timeline)
    this.timelineView.renderNodeDetail(timeline.find(node => 
      this.isSameDay(node.date, date)
    )!)
  }
  
  async selectEntity(entityId: string): Promise<void> {
    this.selectedEntity = await this.loadEntity(entityId)
    
    // Show entity detail in side panel
    this.timelineView.renderEntityDetail(this.selectedEntity)
    
    // Highlight related events in timeline
    this.highlightRelatedEvents(entityId)
  }
}
```

### Split-View Architecture

```
┌─────────────────────────────────────────┬─────────────────────────┐
│                                     │                         │
│         Timeline View                  │     Entity Detail        │
│                                     │                         │
│  Date  |  Income  |  Expense  |    │  • Entity Info         │
│  -----  |  ------  |  ------   |    │  • Status History      │
│  05/01  |  1000   |    500    |    │  • Related Events      │
│  05/02  |    0    |    200    |    │  • Comments           │
│  05/03  |  1500   |    0      |    │  • Files              │
│         |         |           |    │                         │
└─────────────────────────────────────────┴─────────────────────────┘
```

## 9. PERFORMANCE ARCHITECTURE

### Projection Caching Strategy

```typescript
class ProjectionCache {
  private cache = new Map<string, CachedProjection>()
  
  async getProjection<T>(
    key: string,
    builder: () => Promise<T>,
    ttl: number = 300000 // 5 minutes
  ): Promise<T> {
    
    const cached = this.cache.get(key)
    
    if (cached && !this.isExpired(cached, ttl)) {
      return cached.data as T
    }
    
    const projection = await builder()
    
    this.cache.set(key, {
      data: projection,
      timestamp: Date.now()
    })
    
    return projection
  }
  
  invalidatePattern(pattern: string): void {
    // Invalidate all cache entries matching pattern
    for (const [key] of this.cache) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }
}
```

### Materialized Views vs Live Computation

```typescript
// Use materialized views for:
// - Historical data (doesn't change)
// - Complex aggregations (expensive to compute)
// - Reporting queries

// Use live computation for:
// - Current period data
// - Real-time projections
// - User-specific views

class HybridProjectionEngine {
  async buildTimeline(
    firmId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TimelineNode[]> {
    
    const isHistorical = endDate < new Date()
    
    if (isHistorical) {
      // Use materialized view for historical data
      return this.materializedViewQuery(firmId, startDate, endDate)
    } else {
      // Use live computation for current/future data
      return this.liveComputation(firmId, startDate, endDate)
    }
  }
}
```

### Timeline Chunking Strategy

```typescript
class TimelineChunker {
  private CHUNK_SIZE = 30 // days
  
  async loadTimelineChunk(
    firmId: string,
    startDate: Date,
    direction: 'forward' | 'backward' = 'forward'
  ): Promise<TimelineChunk> {
    
    const endDate = this.addDays(startDate, this.CHUNK_SIZE)
    
    const timeline = await this.timelineEngine.buildTimeline(
      firmId,
      startDate,
      endDate
    )
    
    return {
      startDate,
      endDate,
      timeline,
      hasMore: await this.hasMoreData(firmId, endDate, direction)
    }
  }
  
  async loadTimelineWindow(
    firmId: string,
    centerDate: Date,
    windowSize: number = 90 // days
  ): Promise<TimelineNode[]> {
    
    const startDate = this.addDays(centerDate, -Math.floor(windowSize / 2))
    const endDate = this.addDays(centerDate, Math.ceil(windowSize / 2))
    
    return this.timelineEngine.buildTimeline(firmId, startDate, endDate)
  }
}
```

## 10. IMPLEMENTATION PHASES

### Phase 1: Core Domain (Week 1)
- Implement source entities
- Create state machines
- Build basic event system

### Phase 2: Timeline Engine (Week 2)
- Implement timeline computation
- Add projection builders
- Create caching layer

### Phase 3: Reconciliation Engine (Week 3)
- Build matching algorithms
- Implement confidence scoring
- Add manual confirmation flow

### Phase 4: UI Integration (Week 4)
- Create timeline-first UI
- Implement split-view architecture
- Add entity detail panels

### Phase 5: Performance & Polish (Week 5)
- Optimize projections
- Add virtualization
- Implement advanced caching

---

## ARCHITECTURE SUMMARY

This architecture provides:

1. **Clear separation** between source data and projections
2. **Event-driven** design for auditability and extensibility  
3. **Timeline-centric** approach matching the business domain
4. **Performance-optimized** projection system
5. **Extensible** entity strategy for future growth
6. **Robust** state management with explicit transitions
7. **Intelligent** reconciliation with confidence scoring
8. **User-friendly** timeline-first UX
9. **Scalable** caching and chunking strategies

The system treats cashflow as a **projection layer**, not canonical data, with all financial truth stored in source entities and derived through event-driven computation.
