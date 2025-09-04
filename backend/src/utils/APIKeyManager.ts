import { logger } from './logger';

export interface APIKeyConfig {
  service: string;
  keys: string[];
  rotationIntervalMs?: number;
  maxFailuresBeforeRotation?: number;
  healthCheckIntervalMs?: number;
}

export interface APIKeyStats {
  service: string;
  currentKeyIndex: number;
  totalKeys: number;
  keyUsageCount: Record<number, number>;
  keyFailureCount: Record<number, number>;
  lastRotation: Date;
  lastHealthCheck: Date;
  healthyKeys: number;
}

export class APIKeyManager {
  private configs: Map<string, APIKeyConfig> = new Map();
  private currentKeyIndex: Map<string, number> = new Map();
  private keyUsageCount: Map<string, Record<number, number>> = new Map();
  private keyFailureCount: Map<string, Record<number, number>> = new Map();
  private lastRotation: Map<string, Date> = new Map();
  private lastHealthCheck: Map<string, Date> = new Map();
  private healthyKeys: Map<string, Set<number>> = new Map();
  private rotationTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    // Initialize from environment variables
    this.initializeFromEnvironment();
  }

  private initializeFromEnvironment(): void {
    // Google PageSpeed Insights API Keys
    const googleKeys = this.parseAPIKeys(process.env.GOOGLE_PAGESPEED_API_KEY);
    if (googleKeys.length > 0) {
      this.addService({
        service: 'google-pagespeed',
        keys: googleKeys,
        rotationIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
        maxFailuresBeforeRotation: 5,
        healthCheckIntervalMs: 60 * 60 * 1000 // 1 hour
      });
    }

    // Schema.org Validator (typically doesn't require API keys, but keeping for consistency)
    const schemaKeys = this.parseAPIKeys(process.env.SCHEMA_VALIDATOR_API_KEY);
    if (schemaKeys.length > 0) {
      this.addService({
        service: 'schema-validator',
        keys: schemaKeys,
        rotationIntervalMs: 24 * 60 * 60 * 1000,
        maxFailuresBeforeRotation: 3,
        healthCheckIntervalMs: 2 * 60 * 60 * 1000 // 2 hours
      });
    }
  }

  private parseAPIKeys(keyString?: string): string[] {
    if (!keyString) return [];
    
    // Support comma-separated keys for multiple API keys
    return keyString.split(',')
      .map(key => key.trim())
      .filter(key => key.length > 0);
  }

  addService(config: APIKeyConfig): void {
    const requiredConfig: Required<APIKeyConfig> = {
      rotationIntervalMs: 24 * 60 * 60 * 1000, // 24 hours default
      maxFailuresBeforeRotation: 5,
      healthCheckIntervalMs: 60 * 60 * 1000, // 1 hour default
      ...config
    };

    this.configs.set(config.service, requiredConfig);
    this.currentKeyIndex.set(config.service, 0);
    this.keyUsageCount.set(config.service, {});
    this.keyFailureCount.set(config.service, {});
    this.lastRotation.set(config.service, new Date());
    this.lastHealthCheck.set(config.service, new Date());
    this.healthyKeys.set(config.service, new Set(config.keys.map((_, index) => index)));

    // Initialize usage and failure counts
    const usageCount: Record<number, number> = {};
    const failureCount: Record<number, number> = {};
    config.keys.forEach((_, index) => {
      usageCount[index] = 0;
      failureCount[index] = 0;
    });
    this.keyUsageCount.set(config.service, usageCount);
    this.keyFailureCount.set(config.service, failureCount);

    // Set up automatic rotation
    this.setupAutomaticRotation(config.service, requiredConfig.rotationIntervalMs);

    logger.info(`API Key Manager: Added service ${config.service} with ${config.keys.length} keys`);
  }

  private setupAutomaticRotation(service: string, intervalMs: number): void {
    // Clear existing timer if any
    const existingTimer = this.rotationTimers.get(service);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // Set up new rotation timer
    const timer = setInterval(() => {
      this.rotateKey(service);
    }, intervalMs);

    this.rotationTimers.set(service, timer);
  }

  getCurrentKey(service: string): string | null {
    const config = this.configs.get(service);
    if (!config) {
      logger.error(`API Key Manager: Service ${service} not found`);
      return null;
    }

    if (config.keys.length === 0) {
      logger.warn(`API Key Manager: No keys available for ${service}`);
      return null;
    }

    const currentIndex = this.currentKeyIndex.get(service) || 0;
    const healthyKeys = this.healthyKeys.get(service) || new Set();

    // If current key is not healthy, try to find a healthy one
    if (!healthyKeys.has(currentIndex)) {
      const healthyIndex = this.findHealthyKey(service);
      if (healthyIndex !== -1) {
        this.currentKeyIndex.set(service, healthyIndex);
        const newCurrentIndex = healthyIndex;
        
        // Increment usage count for the new key
        const usageCount = this.keyUsageCount.get(service) || {};
        usageCount[newCurrentIndex] = (usageCount[newCurrentIndex] || 0) + 1;
        this.keyUsageCount.set(service, usageCount);
        
        return config.keys[newCurrentIndex];
      } else {
        logger.warn(`API Key Manager: No healthy keys available for ${service}`);
        return null;
      }
    }

    // Increment usage count
    const usageCount = this.keyUsageCount.get(service) || {};
    usageCount[currentIndex] = (usageCount[currentIndex] || 0) + 1;
    this.keyUsageCount.set(service, usageCount);

    return config.keys[currentIndex];
  }

  private findHealthyKey(service: string): number {
    const healthyKeys = this.healthyKeys.get(service) || new Set();
    const healthyIndices = Array.from(healthyKeys);
    
    if (healthyIndices.length === 0) {
      return -1;
    }

    // Return the least used healthy key
    const usageCount = this.keyUsageCount.get(service) || {};
    return healthyIndices.reduce((leastUsedIndex, index) => {
      const currentUsage = usageCount[index] || 0;
      const leastUsage = usageCount[leastUsedIndex] || 0;
      return currentUsage < leastUsage ? index : leastUsedIndex;
    });
  }

  reportKeyFailure(service: string, key: string): void {
    const config = this.configs.get(service);
    if (!config) return;

    const keyIndex = config.keys.indexOf(key);
    if (keyIndex === -1) return;

    // Increment failure count
    const failureCount = this.keyFailureCount.get(service) || {};
    failureCount[keyIndex] = (failureCount[keyIndex] || 0) + 1;
    this.keyFailureCount.set(service, failureCount);

    logger.warn(`API Key Manager: Key failure reported for ${service}, key index ${keyIndex}`, {
      failureCount: failureCount[keyIndex],
      maxFailures: config.maxFailuresBeforeRotation
    });

    // Check if key should be marked as unhealthy
    if (failureCount[keyIndex] >= (config.maxFailuresBeforeRotation || 5)) {
      this.markKeyUnhealthy(service, keyIndex);
    }

    // Rotate to next key if current key failed
    const currentIndex = this.currentKeyIndex.get(service) || 0;
    if (keyIndex === currentIndex) {
      this.rotateKey(service);
    }
  }

  private markKeyUnhealthy(service: string, keyIndex: number): void {
    const healthyKeys = this.healthyKeys.get(service) || new Set();
    healthyKeys.delete(keyIndex);
    this.healthyKeys.set(service, healthyKeys);

    logger.warn(`API Key Manager: Marked key ${keyIndex} as unhealthy for ${service}`, {
      remainingHealthyKeys: healthyKeys.size
    });

    // If no healthy keys remain, reset all keys to healthy (circuit breaker pattern)
    if (healthyKeys.size === 0) {
      this.resetAllKeysToHealthy(service);
    }
  }

  private resetAllKeysToHealthy(service: string): void {
    const config = this.configs.get(service);
    if (!config) return;

    const allIndices = new Set(config.keys.map((_, index) => index));
    this.healthyKeys.set(service, allIndices);

    // Reset failure counts
    const failureCount: Record<number, number> = {};
    config.keys.forEach((_, index) => {
      failureCount[index] = 0;
    });
    this.keyFailureCount.set(service, failureCount);

    logger.info(`API Key Manager: Reset all keys to healthy for ${service} (circuit breaker)`);
  }

  rotateKey(service: string): boolean {
    const config = this.configs.get(service);
    if (!config) return false;

    const currentIndex = this.currentKeyIndex.get(service) || 0;
    const healthyKeys = this.healthyKeys.get(service) || new Set();
    
    // Find next healthy key
    let nextIndex = (currentIndex + 1) % config.keys.length;
    let attempts = 0;
    
    while (!healthyKeys.has(nextIndex) && attempts < config.keys.length) {
      nextIndex = (nextIndex + 1) % config.keys.length;
      attempts++;
    }

    if (attempts >= config.keys.length) {
      logger.warn(`API Key Manager: No healthy keys available for rotation in ${service}`);
      return false;
    }

    this.currentKeyIndex.set(service, nextIndex);
    this.lastRotation.set(service, new Date());

    logger.info(`API Key Manager: Rotated key for ${service}`, {
      fromIndex: currentIndex,
      toIndex: nextIndex
    });

    return true;
  }

  async performHealthCheck(service: string, healthCheckFn: (key: string) => Promise<boolean>): Promise<void> {
    const config = this.configs.get(service);
    if (!config) return;

    logger.debug(`API Key Manager: Performing health check for ${service}`);

    const healthResults = await Promise.allSettled(
      config.keys.map(async (key, index) => {
        try {
          const isHealthy = await healthCheckFn(key);
          return { index, isHealthy };
        } catch (error) {
          logger.error(`API Key Manager: Health check failed for ${service} key ${index}`, {
            error: (error as Error).message
          });
          return { index, isHealthy: false };
        }
      })
    );

    const healthyKeys = new Set<number>();
    healthResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.isHealthy) {
        healthyKeys.add(index);
      }
    });

    this.healthyKeys.set(service, healthyKeys);
    this.lastHealthCheck.set(service, new Date());

    logger.info(`API Key Manager: Health check completed for ${service}`, {
      totalKeys: config.keys.length,
      healthyKeys: healthyKeys.size
    });
  }

  getStats(service: string): APIKeyStats | null {
    const config = this.configs.get(service);
    if (!config) return null;

    return {
      service,
      currentKeyIndex: this.currentKeyIndex.get(service) || 0,
      totalKeys: config.keys.length,
      keyUsageCount: { ...(this.keyUsageCount.get(service) || {}) },
      keyFailureCount: { ...(this.keyFailureCount.get(service) || {}) },
      lastRotation: this.lastRotation.get(service) || new Date(),
      lastHealthCheck: this.lastHealthCheck.get(service) || new Date(),
      healthyKeys: (this.healthyKeys.get(service) || new Set()).size
    };
  }

  getAllStats(): Record<string, APIKeyStats> {
    const stats: Record<string, APIKeyStats> = {};
    
    for (const service of this.configs.keys()) {
      const serviceStats = this.getStats(service);
      if (serviceStats) {
        stats[service] = serviceStats;
      }
    }

    return stats;
  }

  removeService(service: string): void {
    // Clear rotation timer
    const timer = this.rotationTimers.get(service);
    if (timer) {
      clearInterval(timer);
      this.rotationTimers.delete(service);
    }

    // Remove all data for the service
    this.configs.delete(service);
    this.currentKeyIndex.delete(service);
    this.keyUsageCount.delete(service);
    this.keyFailureCount.delete(service);
    this.lastRotation.delete(service);
    this.lastHealthCheck.delete(service);
    this.healthyKeys.delete(service);

    logger.info(`API Key Manager: Removed service ${service}`);
  }

  shutdown(): void {
    // Clear all timers
    for (const timer of this.rotationTimers.values()) {
      clearInterval(timer);
    }
    this.rotationTimers.clear();

    logger.info('API Key Manager: Shutdown completed');
  }
}