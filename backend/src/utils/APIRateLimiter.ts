import { logger } from './logger';

export interface RateLimiterConfig {
  requestsPerInterval: number;
  intervalMs: number;
  maxConcurrent?: number;
  burstAllowance?: number;
}

export interface RateLimiterStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitedRequests: number;
  averageWaitTime: number;
  currentConcurrent: number;
  remainingRequests: number;
}

export class APIRateLimiter {
  private requests: number[] = [];
  private config: Required<RateLimiterConfig>;
  private concurrentRequests = 0;
  private waitingQueue: Array<{
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    operation: () => Promise<any>;
    timestamp: number;
  }> = [];
  
  private stats: RateLimiterStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    rateLimitedRequests: 0,
    averageWaitTime: 0,
    currentConcurrent: 0,
    remainingRequests: 0
  };

  private cleanupTimer?: NodeJS.Timeout;
  private queueTimer?: NodeJS.Timeout;

  constructor(config: RateLimiterConfig) {
    this.config = {
      maxConcurrent: 10,
      burstAllowance: Math.floor(config.requestsPerInterval * 0.1), // 10% burst allowance
      ...config
    };

    // Clean up old requests periodically
    this.cleanupTimer = setInterval(() => this.cleanupOldRequests(), this.config.intervalMs / 4);
    
    // Process waiting queue periodically
    this.queueTimer = setInterval(() => this.processWaitingQueue(), 100);
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.stats.totalRequests++;
    const startTime = Date.now();

    return new Promise<T>((resolve, reject) => {
      if (this.canExecuteNow()) {
        this.executeOperation(operation, resolve, reject, startTime);
      } else {
        // Add to waiting queue
        this.waitingQueue.push({
          resolve: (value) => {
            this.stats.averageWaitTime = this.updateAverageWaitTime(Date.now() - startTime);
            resolve(value);
          },
          reject,
          operation,
          timestamp: startTime
        });
        this.stats.rateLimitedRequests++;
        
        logger.debug('Request queued due to rate limiting', {
          queueLength: this.waitingQueue.length,
          concurrentRequests: this.concurrentRequests,
          remainingRequests: this.getRemainingRequests()
        });
      }
    });
  }

  private canExecuteNow(): boolean {
    this.cleanupOldRequests();
    
    const withinRateLimit = this.requests.length < this.config.requestsPerInterval;
    const withinConcurrencyLimit = this.concurrentRequests < this.config.maxConcurrent;
    
    return withinRateLimit && withinConcurrencyLimit;
  }

  private async executeOperation<T>(
    operation: () => Promise<T>,
    resolve: (value: T) => void,
    reject: (error: Error) => void,
    startTime: number
  ): Promise<void> {
    this.concurrentRequests++;
    this.stats.currentConcurrent = this.concurrentRequests;
    this.requests.push(Date.now());

    try {
      const result = await operation();
      this.stats.successfulRequests++;
      this.stats.averageWaitTime = this.updateAverageWaitTime(Date.now() - startTime);
      resolve(result);
    } catch (error) {
      this.stats.failedRequests++;
      reject(error as Error);
    } finally {
      this.concurrentRequests--;
      this.stats.currentConcurrent = this.concurrentRequests;
    }
  }

  private processWaitingQueue(): void {
    while (this.waitingQueue.length > 0 && this.canExecuteNow()) {
      const item = this.waitingQueue.shift()!;
      this.executeOperation(item.operation, item.resolve, item.reject, item.timestamp);
    }
  }

  private cleanupOldRequests(): void {
    const cutoff = Date.now() - this.config.intervalMs;
    this.requests = this.requests.filter(timestamp => timestamp > cutoff);
    this.stats.remainingRequests = Math.max(0, this.config.requestsPerInterval - this.requests.length);
  }

  private updateAverageWaitTime(newWaitTime: number): number {
    const totalRequests = this.stats.successfulRequests + this.stats.failedRequests;
    if (totalRequests === 1) {
      return newWaitTime;
    }
    
    const currentAverage = this.stats.averageWaitTime;
    return (currentAverage * (totalRequests - 1) + newWaitTime) / totalRequests;
  }

  getRemainingRequests(): number {
    this.cleanupOldRequests();
    return Math.max(0, this.config.requestsPerInterval - this.requests.length);
  }

  getCurrentConcurrency(): number {
    return this.concurrentRequests;
  }

  getQueueLength(): number {
    return this.waitingQueue.length;
  }

  getStats(): RateLimiterStats {
    return { ...this.stats };
  }

  reset(): void {
    this.requests = [];
    this.concurrentRequests = 0;
    this.waitingQueue = [];
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitedRequests: 0,
      averageWaitTime: 0,
      currentConcurrent: 0,
      remainingRequests: this.config.requestsPerInterval
    };
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    if (this.queueTimer) {
      clearInterval(this.queueTimer);
      this.queueTimer = undefined;
    }
    this.waitingQueue = [];
  }

  // Allow burst requests up to the burst allowance
  async executeBurst<T>(operations: Array<() => Promise<T>>): Promise<Array<{
    success: boolean;
    result?: T;
    error?: Error;
  }>> {
    const maxBurst = Math.min(operations.length, this.config.burstAllowance);
    const burstOperations = operations.slice(0, maxBurst);
    const remainingOperations = operations.slice(maxBurst);

    // Execute burst operations
    const burstResults = await Promise.allSettled(
      burstOperations.map(op => this.execute(op))
    );

    // Execute remaining operations with normal rate limiting
    const remainingResults = await Promise.allSettled(
      remainingOperations.map(op => this.execute(op))
    );

    // Combine results
    const allResults = [...burstResults, ...remainingResults];
    
    return allResults.map(result => {
      if (result.status === 'fulfilled') {
        return { success: true, result: result.value };
      } else {
        return { success: false, error: result.reason };
      }
    });
  }

  // Get estimated wait time for next available slot
  getEstimatedWaitTime(): number {
    if (this.canExecuteNow()) {
      return 0;
    }

    const oldestRequest = Math.min(...this.requests);
    const timeUntilSlotAvailable = (oldestRequest + this.config.intervalMs) - Date.now();
    
    const concurrencyWait = this.concurrentRequests >= this.config.maxConcurrent ? 
      this.stats.averageWaitTime : 0;

    return Math.max(timeUntilSlotAvailable, concurrencyWait);
  }

  // Check if the rate limiter is healthy (not overwhelmed)
  isHealthy(): boolean {
    const queueBacklog = this.waitingQueue.length > this.config.requestsPerInterval;
    const highFailureRate = this.stats.failedRequests / Math.max(1, this.stats.totalRequests) > 0.5;
    const excessiveWaitTime = this.stats.averageWaitTime > this.config.intervalMs;

    return !queueBacklog && !highFailureRate && !excessiveWaitTime;
  }
}