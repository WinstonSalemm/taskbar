# UI Architecture - Timeline-First Financial Interface

## Core Design Principles

### 1. Timeline as Primary Navigation
The timeline is the central organizing principle, not a secondary feature.

```
┌─────────────────────────────────────────────────────────────────┐
│                    FINANCIAL TIMELINE                        │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐  │
│  │ May 1│ May 2│ May 3│ May 4│ May 5│ May 6│ May 7│  │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤  │
│  │ 588M │ 590M │ 585M │ 592M │ 588M │ 595M │ 591M │  │
│  │  +2M │  -5M │  +7M │  -4M │  +7M │  -4M │  │
│  └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Split-View Architecture
Main timeline + detail panel pattern

```
┌─────────────────────────────────────────┬─────────────────────────┐
│                                     │                         │
│         TIMELINE VIEW                │     DETAIL PANEL       │
│                                     │                         │
│  Date  |  Income  |  Expense  │    │  • Entity Info         │
│  -----  |  ------  |  ------   │    │  • Status History      │
│  05/01  |  2000   |    500    │    │  • Related Events      │
│  05/02  |    0    |    200    │    │  • Comments           │
│  05/03  |  1500   |    0      │    │  • Files              │
│  05/04  |    0    |    800    │    │  • Actions            │
│         |         |           │    │                         │
└─────────────────────────────────────────┴─────────────────────────┘
```

## Component Architecture

### TimelineController
```javascript
class TimelineController {
  constructor() {
    this.timelineEngine = timelineEngine
    this.projectionBuilder = projectionBuilder
    this.selectedDate = null
    this.selectedEntity = null
    this.viewMode = 'day' // day, week, month
    this.dateRange = this.getCurrentDateRange()
  }

  async selectDate(date) {
    this.selectedDate = date
    await this.loadTimelineForDate(date)
    this.renderTimeline()
    this.renderDayDetail(date)
  }

  async selectEntity(entityId) {
    this.selectedEntity = await this.loadEntity(entityId)
    this.renderEntityDetail(this.selectedEntity)
    this.highlightRelatedEvents(entityId)
  }

  async loadTimelineForDate(date) {
    const range = this.getDateRangeForView(date, this.viewMode)
    this.timeline = await this.timelineEngine.buildTimeline(
      this.firmId,
      range.start,
      range.end
    )
  }
}
```

### TimelineView Component
```javascript
class TimelineView {
  render(timeline, selectedDate, selectedEntity) {
    this.renderTimelineHeader()
    this.renderTimelineRows(timeline)
    this.renderTimelineSummary(timeline)
    this.highlightSelectedDate(selectedDate)
    this.highlightSelectedEntity(selectedEntity)
  }

  renderTimelineRow(node) {
    return `
      <div class="timeline-row ${node.hasActivity ? 'has-activity' : ''}" 
           data-date="${node.date.toISOString()}">
        <div class="timeline-date">${this.formatDate(node.date)}</div>
        <div class="timeline-income ${node.confirmedIncome > 0 ? 'positive' : ''}">
          ${node.confirmedIncome > 0 ? this.formatCurrency(node.confirmedIncome) : '-'}
        </div>
        <div class="timeline-expense ${node.confirmedExpense > 0 ? 'negative' : ''}">
          ${node.confirmedExpense > 0 ? this.formatCurrency(node.confirmedExpense) : '-'}
        </div>
        <div class="timeline-balance">
          ${this.formatCurrency(node.closingBalance)}
        </div>
        <div class="timeline-actions">
          ${this.renderDayActions(node)}
        </div>
      </div>
    `
  }
}
```

### DetailPanel Component
```javascript
class DetailPanel {
  render(entity) {
    switch (entity.entityType) {
      case 'forecast':
        return this.renderForecastDetail(entity)
      case 'expense':
        return this.renderExpenseDetail(entity)
      case 'statement_line':
        return this.renderStatementDetail(entity)
      default:
        return this.renderGenericDetail(entity)
    }
  }

  renderForecastDetail(forecast) {
    return `
      <div class="detail-panel">
        <div class="detail-header">
          <h3>Forecast Entry</h3>
          <div class="detail-status ${forecast.status}">${forecast.status}</div>
        </div>
        
        <div class="detail-content">
          ${this.renderEntityInfo(forecast)}
          ${this.renderStatusHistory(forecast)}
          ${this.renderRelatedEvents(forecast)}
          ${this.renderComments(forecast)}
          ${this.renderFiles(forecast)}
          ${this.renderActions(forecast)}
        </div>
      </div>
    `
  }
}
```

## User Interaction Patterns

### 1. Date Selection
- Click on timeline row → select date
- Show day detail in panel
- Highlight related events

### 2. Entity Selection
- Click on any entity within timeline → select entity
- Show entity detail in panel
- Highlight all related timeline events

### 3. Event Drilldown
- Click on event in detail panel → show event details
- Navigate to related entities
- Show audit trail

### 4. Quick Actions
- Inline actions in timeline rows
- Context menus for entities
- Keyboard shortcuts for navigation

## Responsive Design

### Desktop Layout
```
┌─────────────────────────────────────────┬─────────────────────────┐
│                                     │                         │
│         Timeline (70%)               │      Detail (30%)       │
│                                     │                         │
└─────────────────────────────────────────┴─────────────────────────┘
```

### Tablet Layout
```
┌─────────────────────────────────────────┐
│                                     │
│           Timeline                   │
│                                     │
├─────────────────────────────────────────┤
│                                     │
│            Detail Panel             │
│                                     │
└─────────────────────────────────────────┘
```

### Mobile Layout
```
┌─────────────────────────────────────────┐
│                                     │
│           Timeline                   │
│                                     │
│         (Scrollable)                 │
│                                     │
├─────────────────────────────────────────┤
│        [Tap for Detail]              │
└─────────────────────────────────────────┘
```

## State Management

### UI State
```javascript
const uiState = {
  timeline: {
    selectedDate: null,
    viewMode: 'day',
    dateRange: { start: null, end: null },
    nodes: [],
    loading: false
  },
  detail: {
    selectedEntity: null,
    entityType: null,
    panelMode: 'entity', // entity, day, events
    loading: false
  },
  filters: {
    employeeId: null,
    status: null,
    amountRange: null,
    dateRange: null
  }
}
```

### Data Flow
```
User Action → UI State Update → API Call → Data Update → UI Re-render
     ↓              ↓                ↓           ↓            ↓
Timeline Click → Select Date → Load Timeline → Timeline Data → Render Timeline
Entity Click   → Select Entity → Load Entity  → Entity Data → Render Detail
```

## Performance Considerations

### 1. Virtual Scrolling
- Only render visible timeline rows
- Reuse DOM elements
- Smooth scrolling for long timelines

### 2. Lazy Loading
- Load timeline data in chunks
- Preload adjacent dates
- Cache rendered components

### 3. Debounced Updates
- Debounce timeline scrolling
- Batch API calls
- Optimize re-renders

## Integration with Existing Task-Manager

### 1. Shared Components
- Use existing modal system
- Reuse notification components
- Follow existing CSS patterns

### 2. Navigation Integration
- Add financial navigation to sidebar
- Maintain consistent routing
- Use existing layout patterns

### 3. Authentication & Authorization
- Use existing auth store
- Respect role-based access
- Follow existing permission patterns

## Implementation Phases

### Phase 1: Core Timeline
- Basic timeline rendering
- Date selection
- Simple detail panel

### Phase 2: Entity Details
- Entity-specific detail views
- Status management
- Basic actions

### Phase 3: Advanced Features
- Filtering and search
- Bulk operations
- Advanced visualizations

### Phase 4: Optimization
- Performance improvements
- Mobile responsiveness
- Accessibility enhancements

## CSS Architecture

### Component-Based Styling
```css
/* Timeline Container */
.financial-timeline {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Timeline Row */
.timeline-row {
  display: grid;
  grid-template-columns: 120px 1fr 1fr 1fr auto;
  align-items: center;
  padding: var(--space-3);
  border-bottom: 1px solid var(--border-color);
}

/* Detail Panel */
.detail-panel {
  background: var(--surface-primary);
  border-left: 1px solid var(--border-color);
  overflow-y: auto;
}
```

### Responsive Utilities
```css
/* Desktop */
@media (min-width: 1024px) {
  .financial-layout {
    display: grid;
    grid-template-columns: 2fr 1fr;
  }
}

/* Tablet */
@media (max-width: 1023px) and (min-width: 768px) {
  .financial-layout {
    display: flex;
    flex-direction: column;
  }
}

/* Mobile */
@media (max-width: 767px) {
  .timeline-row {
    grid-template-columns: 1fr;
    gap: var(--space-2);
  }
}
```

This UI architecture provides a timeline-first experience that naturally extends the existing task-manager patterns while delivering the sophisticated financial interface required by the business domain.
