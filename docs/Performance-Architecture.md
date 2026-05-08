# Performance Architecture - Scalable Financial Engine

## Core Performance Strategy

### 1. Projection Caching System
```javascript
class ProjectionCache {
  constructor() {
    this.cache = new Map() // key -> { data, timestamp, version }
    this.TTL = {
      timeline: 5 * 60 * 1000,      // 5 minutes
      employee: 2 * 60 * 1000,      // 2 minutes
      reconciliation: 10 * 60 * 1000, // 10 minutes
      cashflow: 3 * 60 * 1000       // 3 minutes
    }
    this.VERSION = 1
  }

  async get(key, type) {
    const cached = this.cache.get(key)
    if (!cached) return null

    const isExpired = (Date.now() - cached.timestamp) > this.TTL[type]
    const isVersionValid = cached.version === this.VERSION

    if (isExpired || !isVersionValid) {
      this.cache.delete(key)
      return null
    }

    return cached.data
  }

  set(key, data, type) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      version: this.VERSION
    })
  }

  invalidatePattern(pattern) {
    for (const [key] of this.cache) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  invalidateFirm(firmId) {
    this.invalidatePattern(`${firmId}_`)
  }

  getStats() {
    return {
      size: this.cache.size,
      memoryUsage: this.estimateMemoryUsage(),
      hitRate: this.calculateHitRate()
    }
  }
}
```

### 2. Timeline Chunking Strategy
```javascript
class TimelineChunker {
  constructor() {
    this.CHUNK_SIZE = 30 // days
    this.CHUNK_OVERLAP = 3 // days overlap for smooth transitions
    this.MAX_CHUNKS_IN_MEMORY = 10
    this.loadedChunks = new Map() // chunkKey -> { data, timestamp, accessCount }
  }

  getChunkKey(firmId, startDate) {
    const chunkStart = this.getChunkStartDate(startDate)
    return `${firmId}_${chunkStart.toISOString().split('T')[0]}`
  }

  async getTimelineChunk(firmId, date) {
    const chunkKey = this.getChunkKey(firmId, date)
    
    // Check cache first
    if (this.loadedChunks.has(chunkKey)) {
      const chunk = this.loadedChunks.get(chunkKey)
      chunk.accessCount++
      return chunk.data
    }

    // Load from database
    const chunkStart = this.getChunkStartDate(date)
    const chunkEnd = this.addDays(chunkStart, this.CHUNK_SIZE - 1)

    const timelineData = await this.loadTimelineFromDB(
      firmId, 
      chunkStart, 
      chunkEnd
    )

    // Cache the chunk
    this.loadedChunks.set(chunkKey, {
      data: timelineData,
      timestamp: Date.now(),
      accessCount: 1
    })

    // Cleanup old chunks if needed
    this.cleanupOldChunks()

    return timelineData
  }

  cleanupOldChunks() {
    if (this.loadedChunks.size <= this.MAX_CHUNKS_IN_MEMORY) {
      return
    }

    // Sort by access count and timestamp
    const sortedChunks = Array.from(this.loadedChunks.entries())
      .sort(([,a], [,b]) => {
        // First by access count (least used first)
        if (a.accessCount !== b.accessCount) {
          return a.accessCount - b.accessCount
        }
        // Then by timestamp (oldest first)
        return a.timestamp - b.timestamp
      })

    // Remove least used chunks
    const chunksToRemove = sortedChunks
      .slice(0, sortedChunks.length - this.MAX_CHUNKS_IN_MEMORY)

    for (const [chunkKey] of chunksToRemove) {
      this.loadedChunks.delete(chunkKey)
    }
  }

  async getTimelineWindow(firmId, centerDate, windowSize = 90) {
    const startDate = this.addDays(centerDate, -Math.floor(windowSize / 2))
    const endDate = this.addDays(centerDate, Math.ceil(windowSize / 2))

    // Load required chunks
    const chunks = []
    let currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      const chunk = await this.getTimelineChunk(firmId, currentDate)
      chunks.push(chunk)
      currentDate = this.addDays(currentDate, this.CHUNK_SIZE)
    }

    // Merge chunks
    return this.mergeChunks(chunks, startDate, endDate)
  }
}
```

### 3. Materialized Views vs Live Computation
```javascript
class HybridProjectionEngine {
  constructor() {
    this.MATERIALIZED_VIEW_TTL = 24 * 60 * 60 * 1000 // 24 hours
    this.LIVE_COMPUTATION_THRESHOLD = 7 // days
  }

  async buildTimeline(firmId, startDate, endDate) {
    const isHistorical = this.isHistoricalData(endDate)
    const isLargeRange = this.getDaysDifference(startDate, endDate) > 30

    if (isHistorical && isLargeRange) {
      // Use materialized view for large historical ranges
      return this.getFromMaterializedView(firmId, startDate, endDate)
    } else {
      // Use live computation for recent or small ranges
      return this.computeLiveTimeline(firmId, startDate, endDate)
    }
  }

  async getFromMaterializedView(firmId, startDate, endDate) {
    // Query pre-computed materialized view
    const query = `
      SELECT * FROM materialized_cashflow_timeline 
      WHERE firm_id = $1 
        AND date BETWEEN $2 AND $3
      ORDER BY date
    `

    return await this.db.query(query, [firmId, startDate, endDate])
  }

  async computeLiveTimeline(firmId, startDate, endDate) {
    // Real-time computation using timeline engine
    return await this.timelineEngine.buildTimeline(firmId, startDate, endDate)
  }

  async refreshMaterializedView(firmId) {
    // Rebuild materialized view for firm
    const endDate = new Date()
    const startDate = this.addDays(endDate, -365) // Last year

    const timelineData = await this.computeLiveTimeline(firmId, startDate, endDate)

    // Update materialized view
    await this.db.query(`
      DELETE FROM materialized_cashflow_timeline WHERE firm_id = $1
    `, [firmId])

    await this.db.query(`
      INSERT INTO materialized_cashflow_timeline 
      (firm_id, date, opening_balance, confirmed_income, confirmed_expense, 
       expected_income, expected_expense, closing_balance, projected_balance)
      VALUES ${timelineData.map(row => 
        `($1, $2, $3, $4, $5, $6, $7, $8, $9)`
      ).join(',')}
    `, timelineData.flatMap(row => [
      firmId, row.date, row.openingBalance, row.confirmedIncome,
      row.confirmedExpense, row.expectedIncome, row.expectedExpense,
      row.closingBalance, row.projectedBalance
    ]))
  }
}
```

### 4. Virtual Scrolling for Large Datasets
```javascript
class VirtualTimeline {
  constructor(container) {
    this.container = container
    this.itemHeight = 60
    this.visibleItems = Math.ceil(container.clientHeight / this.itemHeight) + 2
    this.scrollTop = 0
    this.totalItems = 0
    this.renderedItems = []
    this.data = []
  }

  setData(data) {
    this.data = data
    this.totalItems = data.length
    this.updateVisibleItems()
  }

  updateVisibleItems() {
    const startIndex = Math.floor(this.scrollTop / this.itemHeight)
    const endIndex = Math.min(startIndex + this.visibleItems, this.totalItems)

    const visibleData = this.data.slice(startIndex, endIndex)
    
    this.render(visibleData, startIndex)
  }

  render(data, startIndex) {
    const fragment = document.createDocumentFragment()
    
    data.forEach((item, index) => {
      const element = this.createTimelineElement(item)
      element.style.position = 'absolute'
      element.style.top = `${(startIndex + index) * this.itemHeight}px`
      element.style.height = `${this.itemHeight}px`
      fragment.appendChild(element)
    })

    this.container.innerHTML = ''
    this.container.appendChild(fragment)
    this.container.style.height = `${this.totalItems * this.itemHeight}px`
  }

  handleScroll() {
    this.scrollTop = this.container.scrollTop
    this.updateVisibleItems()
  }

  createTimelineElement(item) {
    const element = document.createElement('div')
    element.className = 'timeline-row'
    element.innerHTML = `
      <div class="timeline-date">${this.formatDate(item.date)}</div>
      <div class="timeline-income">${this.formatCurrency(item.confirmedIncome)}</div>
      <div class="timeline-expense">${this.formatCurrency(item.confirmedExpense)}</div>
      <div class="timeline-balance">${this.formatCurrency(item.closingBalance)}</div>
    `
    return element
  }
}
```

### 5. Background Processing for Heavy Computations
```javascript
class BackgroundProcessor {
  constructor() {
    this.queue = []
    this.processing = false
    this.WORKER_COUNT = 2
    this.workers = []
    this.initWorkers()
  }

  initWorkers() {
    for (let i = 0; i < this.WORKER_COUNT; i++) {
      const worker = new Worker('/js/financial-worker.js')
      worker.onmessage = this.handleWorkerMessage.bind(this)
      this.workers.push(worker)
    }
  }

  async processInBackground(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        task,
        resolve,
        reject,
        id: this.generateTaskId()
      })
      
      this.processQueue()
    })
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true

    while (this.queue.length > 0) {
      const availableWorker = this.getAvailableWorker()
      if (!availableWorker) {
        break
      }

      const taskItem = this.queue.shift()
      this.assignTaskToWorker(availableWorker, taskItem)
    }

    this.processing = false
  }

  assignTaskToWorker(worker, taskItem) {
    worker.isBusy = true
    worker.currentTask = taskItem.id

    worker.postMessage({
      taskId: taskItem.id,
      task: taskItem.task
    })

    // Set timeout for long-running tasks
    setTimeout(() => {
      if (worker.currentTask === taskItem.id) {
        taskItem.reject(new Error('Task timeout'))
        worker.isBusy = false
        worker.currentTask = null
        this.processQueue()
      }
    }, 30000) // 30 seconds timeout
  }

  handleWorkerMessage(event) {
    const { taskId, result, error } = event.data
    const worker = event.target

    // Find the task in queue
    const taskIndex = this.queue.findIndex(item => item.id === taskId)
    if (taskIndex === -1) return

    const taskItem = this.queue[taskIndex]
    this.queue.splice(taskIndex, 1)

    if (error) {
      taskItem.reject(new Error(error))
    } else {
      taskItem.resolve(result)
    }

    worker.isBusy = false
    worker.currentTask = null
    this.processQueue()
  }

  getAvailableWorker() {
    return this.workers.find(worker => !worker.isBusy)
  }

  // Predefined background tasks
  async precomputeTimeline(firmId, startDate, endDate) {
    return this.processInBackground({
      type: 'compute_timeline',
      firmId,
      startDate,
      endDate
    })
  }

  async findReconciliationMatches(statementLines, candidates) {
    return this.processInBackground({
      type: 'reconciliation_matching',
      statementLines,
      candidates
    })
  }

  async generateFinancialReport(firmId, reportConfig) {
    return this.processInBackground({
      type: 'generate_report',
      firmId,
      reportConfig
    })
  }
}
```

### 6. Database Optimization Strategy
```sql
-- Optimized indexes for financial queries
CREATE INDEX CONCURRENTLY idx_forecast_entries_firm_date 
ON forecast_entries(firm_id, expected_date DESC);

CREATE INDEX CONCURRENTLY idx_forecast_entries_employee_status 
ON forecast_entries(employee_id, status, expected_date DESC);

CREATE INDEX CONCURRENTLY idx_expense_requests_firm_date 
ON expense_requests(firm_id, planned_date DESC);

CREATE INDEX CONCURRENTLY idx_bank_statements_firm_date 
ON bank_statements(firm_id, document_date DESC);

CREATE INDEX CONCURRENTLY idx_bank_statements_inn 
ON bank_statements(counterparty_inn) WHERE counterparty_inn IS NOT NULL;

-- Materialized view for historical cashflow
CREATE MATERIALIZED VIEW materialized_cashflow_timeline AS
SELECT 
  firm_id,
  date,
  opening_balance,
  confirmed_income,
  confirmed_expense,
  expected_income,
  expected_expense,
  closing_balance,
  projected_balance
FROM precomputed_cashflow_data
WHERE date <= CURRENT_DATE - INTERVAL '7 days'
WITH DATA;

-- Refresh strategy
CREATE OR REPLACE FUNCTION refresh_cashflow_materialized_view()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY materialized_cashflow_timeline;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh every hour
SELECT cron.schedule('refresh-cashflow-mv', '0 * * * *', 'SELECT refresh_cashflow_materialized_view();');
```

### 7. Memory Management
```javascript
class MemoryManager {
  constructor() {
    this.MEMORY_LIMITS = {
      timeline: 50 * 1024 * 1024,      // 50MB
      projections: 20 * 1024 * 1024,    // 20MB
      cache: 30 * 1024 * 1024,        // 30MB
      workers: 10 * 1024 * 1024         // 10MB
    }
    this.currentUsage = {
      timeline: 0,
      projections: 0,
      cache: 0,
      workers: 0
    }
  }

  checkMemoryUsage(type, size) {
    return (this.currentUsage[type] + size) <= this.MEMORY_LIMITS[type]
  }

  allocateMemory(type, size) {
    if (!this.checkMemoryUsage(type, size)) {
      this.cleanupMemory(type)
      
      if (!this.checkMemoryUsage(type, size)) {
        throw new Error(`Insufficient memory for ${type}`)
      }
    }

    this.currentUsage[type] += size
    return true
  }

  freeMemory(type, size) {
    this.currentUsage[type] = Math.max(0, this.currentUsage[type] - size)
  }

  cleanupMemory(type) {
    switch (type) {
      case 'timeline':
        this.cleanupTimelineMemory()
        break
      case 'projections':
        this.cleanupProjectionMemory()
        break
      case 'cache':
        this.cleanupCacheMemory()
        break
    }
  }

  cleanupTimelineMemory() {
    // Remove old timeline chunks
    if (window.timelineChunker) {
      window.timelineChunker.cleanupOldChunks()
    }
  }

  cleanupProjectionMemory() {
    // Clear projection cache
    if (window.projectionBuilder) {
      window.projectionBuilder.clearCache()
    }
  }

  cleanupCacheMemory() {
    // Clear least recently used cache entries
    if (window.projectionCache) {
      window.projectionCache.cleanupOldEntries()
    }
  }

  getMemoryStats() {
    return {
      limits: this.MEMORY_LIMITS,
      usage: this.currentUsage,
      total: Object.values(this.currentUsage).reduce((sum, usage) => sum + usage, 0),
      totalLimit: Object.values(this.MEMORY_LIMITS).reduce((sum, limit) => sum + limit, 0)
    }
  }
}
```

### 8. Network Optimization
```javascript
class NetworkOptimizer {
  constructor() {
    this.requestQueue = []
    this.batchSize = 10
    this.batchTimeout = 100 // ms
    this.pendingBatches = new Map()
  }

  async batchRequest(requests) {
    const batchId = this.generateBatchId()
    
    return new Promise((resolve, reject) => {
      this.pendingBatches.set(batchId, { requests, resolve, reject })
      
      setTimeout(() => {
        this.processBatch(batchId)
      }, this.batchTimeout)
    })
  }

  async processBatch(batchId) {
    const batch = this.pendingBatches.get(batchId)
    if (!batch) return

    this.pendingBatches.delete(batchId)

    try {
      const response = await fetch('/api/financial/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: batch.requests,
          batchId
        })
      })

      const results = await response.json()
      batch.resolve(results)
    } catch (error) {
      batch.reject(error)
    }
  }

  // Debounced API calls
  debounceApiCall(apiCall, delay = 300) {
    let timeoutId
    return (...args) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => apiCall(...args), delay)
    }
  }

  // Cached API responses
  async cachedApiCall(url, options = {}) {
    const cacheKey = `${url}_${JSON.stringify(options)}`
    const cached = localStorage.getItem(cacheKey)
    
    if (cached) {
      const { data, timestamp } = JSON.parse(cached)
      const isExpired = (Date.now() - timestamp) > (options.cacheTime || 5 * 60 * 1000)
      
      if (!isExpired) {
        return data
      }
    }

    const response = await fetch(url, options)
    const data = await response.json()
    
    localStorage.setItem(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now()
    }))
    
    return data
  }
}
```

## Performance Monitoring

### 1. Metrics Collection
```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      timeline: { loadTime: [], renderTime: [], cacheHitRate: 0 },
      projections: { buildTime: [], cacheHitRate: 0 },
      reconciliation: { matchTime: [], accuracy: 0 },
      memory: { usage: [], gc: [] }
    }
  }

  startTimer(operation) {
    this.metrics[operation].startTime = performance.now()
  }

  endTimer(operation) {
    if (!this.metrics[operation].startTime) return
    
    const duration = performance.now() - this.metrics[operation].startTime
    this.metrics[operation].loadTime.push(duration)
    
    // Keep only last 100 measurements
    if (this.metrics[operation].loadTime.length > 100) {
      this.metrics[operation].loadTime.shift()
    }
    
    delete this.metrics[operation].startTime
  }

  recordCacheHit(operation, hit) {
    if (!this.metrics[operation].cacheHits) {
      this.metrics[operation].cacheHits = 0
      this.metrics[operation].cacheMisses = 0
    }
    
    if (hit) {
      this.metrics[operation].cacheHits++
    } else {
      this.metrics[operation].cacheMisses++
    }
    
    const total = this.metrics[operation].cacheHits + this.metrics[operation].cacheMisses
    this.metrics[operation].cacheHitRate = this.metrics[operation].cacheHits / total
  }

  getReport() {
    const report = {}
    
    for (const [operation, metrics] of Object.entries(this.metrics)) {
      report[operation] = {
        averageLoadTime: this.average(metrics.loadTime),
        maxLoadTime: Math.max(...metrics.loadTime),
        cacheHitRate: metrics.cacheHitRate || 0,
        totalRequests: metrics.loadTime.length
      }
    }
    
    return report
  }

  average(arr) {
    return arr.length > 0 ? arr.reduce((sum, val) => sum + val, 0) / arr.length : 0
  }
}
```

This performance architecture ensures the financial engine can handle large datasets, complex computations, and real-time updates while maintaining responsive user experience.
