import { logger } from './logger';

export interface PerformanceMetrics {
  duration: number;
  memoryUsage: NodeJS.MemoryUsage;
  timestamp: Date;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private activeOperations: Map<string, { startTime: number; startMemory: NodeJS.MemoryUsage }> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Starts monitoring an operation
   */
  startOperation(operationId: string, context?: any): void {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    this.activeOperations.set(operationId, {
      startTime,
      startMemory
    });

    logger.debug('Performance monitoring started', {
      operationId,
      startTime,
      memoryUsage: startMemory,
      context
    });
  }

  /**
   * Ends monitoring an operation and returns metrics
   */
  endOperation(operationId: string, context?: any): PerformanceMetrics | null {
    const operation = this.activeOperations.get(operationId);
    
    if (!operation) {
      logger.warn('Attempted to end non-existent operation', { operationId });
      return null;
    }

    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    const duration = endTime - operation.startTime;

    const metrics: PerformanceMetrics = {
      duration,
      memoryUsage: endMemory,
      timestamp: new Date()
    };

    // Calculate memory delta
    const memoryDelta = {
      rss: endMemory.rss - operation.startMemory.rss,
      heapUsed: endMemory.heapUsed - operation.startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - operation.startMemory.heapTotal,
      external: endMemory.external - operation.startMemory.external
    };

    logger.info('Performance monitoring completed', {
      operationId,
      duration,
      memoryDelta,
      finalMemory: endMemory,
      context
    });

    // Clean up
    this.activeOperations.delete(operationId);

    // Log warning for long operations
    if (duration > 30000) { // 30 seconds
      logger.warn('Long-running operation detected', {
        operationId,
        duration,
        context
      });
    }

    // Log warning for high memory usage
    if (memoryDelta.heapUsed > 100 * 1024 * 1024) { // 100MB
      logger.warn('High memory usage detected', {
        operationId,
        memoryDelta: memoryDelta.heapUsed,
        context
      });
    }

    return metrics;
  }

  /**
   * Monitors a function execution
   */
  async monitor<T>(
    operationId: string, 
    operation: () => Promise<T>, 
    context?: any
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    this.startOperation(operationId, context);
    
    try {
      const result = await operation();
      const metrics = this.endOperation(operationId, context);
      
      return {
        result,
        metrics: metrics || {
          duration: 0,
          memoryUsage: process.memoryUsage(),
          timestamp: new Date()
        }
      };
    } catch (error) {
      this.endOperation(operationId, { ...context, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Gets current system performance metrics
   */
  getSystemMetrics(): {
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
    cpuUsage: NodeJS.CpuUsage;
    activeOperations: number;
  } {
    return {
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      cpuUsage: process.cpuUsage(),
      activeOperations: this.activeOperations.size
    };
  }

  /**
   * Gets metrics for all active operations
   */
  getActiveOperations(): Array<{
    operationId: string;
    duration: number;
    startTime: number;
  }> {
    const now = Date.now();
    
    return Array.from(this.activeOperations.entries()).map(([operationId, operation]) => ({
      operationId,
      duration: now - operation.startTime,
      startTime: operation.startTime
    }));
  }

  /**
   * Cleans up stale operations (running for more than 1 hour)
   */
  cleanupStaleOperations(): void {
    const now = Date.now();
    const staleThreshold = 60 * 60 * 1000; // 1 hour
    
    for (const [operationId, operation] of this.activeOperations.entries()) {
      if (now - operation.startTime > staleThreshold) {
        logger.warn('Cleaning up stale operation', {
          operationId,
          duration: now - operation.startTime
        });
        
        this.activeOperations.delete(operationId);
      }
    }
  }

  /**
   * Logs performance summary
   */
  logPerformanceSummary(): void {
    const systemMetrics = this.getSystemMetrics();
    const activeOps = this.getActiveOperations();
    
    logger.info('Performance summary', {
      system: systemMetrics,
      activeOperations: activeOps.length,
      longestRunningOperation: activeOps.length > 0 
        ? Math.max(...activeOps.map(op => op.duration))
        : 0
    });
  }
}