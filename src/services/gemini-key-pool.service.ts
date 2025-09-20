import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface KeyStats {
  keyIndex: number;
  requestsUsedToday: number;
  requestsPerMinute: number;
  lastUsed: Date | null;
  status: 'available' | 'rate_limited' | 'daily_limit_exceeded' | 'error';
  errorCount: number;
}

export interface SystemStats {
  totalKeys: number;
  activeKeys: number;
  totalDailyCapacity: number;
  totalDailyUsed: number;
  totalMinuteCapacity: number;
  availableKeys: number;
  nextResetTime: Date;
}

export interface KeyPoolStats {
  systemStats: SystemStats;
  keyStats: KeyStats[];
}

@Injectable()
export class GeminiKeyPoolService {
  private readonly logger = new Logger(GeminiKeyPoolService.name);
  
  private readonly keys: string[] = [];
  private currentKeyIndex = 0;
  private keyStats: Map<number, KeyStats> = new Map();
  
  // Rate limiting constants
  private readonly RPM_LIMIT = 15; // Requests per minute per key
  private readonly RPD_LIMIT = 200; // Requests per day per key
  private readonly TOTAL_KEYS = 15;
  
  constructor(private readonly configService: ConfigService) {
    this.initializeKeys();
    this.initializeKeyStats();
    this.startDailyReset();
  }

  /**
   * Get the next available API key
   */
  getNextAvailableKey(): { key: string; keyIndex: number } | null {
    let attempts = 0;
    
    while (attempts < this.TOTAL_KEYS) {
      const keyIndex = this.currentKeyIndex;
      const stats = this.keyStats.get(keyIndex);
      
      if (stats && this.isKeyAvailable(stats)) {
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.TOTAL_KEYS;
        return {
          key: this.keys[keyIndex],
          keyIndex,
        };
      }
      
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.TOTAL_KEYS;
      attempts++;
    }
    
    this.logger.warn('No available keys found');
    return null;
  }

  /**
   * Track successful request for a key
   */
  trackSuccessfulRequest(keyIndex: number): void {
    const stats = this.keyStats.get(keyIndex);
    if (stats) {
      stats.requestsUsedToday++;
      stats.requestsPerMinute++;
      stats.lastUsed = new Date();
      stats.status = this.calculateKeyStatus(stats);
      stats.errorCount = 0; // Reset error count on success
      
      this.logger.debug(`Key ${keyIndex} used successfully. Daily: ${stats.requestsUsedToday}/${this.RPD_LIMIT}, Minute: ${stats.requestsPerMinute}/${this.RPM_LIMIT}`);
    }
  }

  /**
   * Track failed request for a key
   */
  trackFailedRequest(keyIndex: number, error: any): void {
    const stats = this.keyStats.get(keyIndex);
    if (stats) {
      stats.errorCount++;
      stats.lastUsed = new Date();
      
      // Handle rate limiting
      if (this.isRateLimitError(error)) {
        stats.status = 'rate_limited';
        this.logger.warn(`Key ${keyIndex} rate limited`);
      } else if (this.isDailyLimitError(error)) {
        stats.status = 'daily_limit_exceeded';
        this.logger.warn(`Key ${keyIndex} daily limit exceeded`);
      } else {
        stats.status = 'error';
        this.logger.error(`Key ${keyIndex} error:`, error);
      }
    }
  }

  /**
   * Get key pool statistics
   */
  getKeyPoolStats(): KeyPoolStats {
    const keyStatsArray = Array.from(this.keyStats.values());
    
    // Calculate system stats
    const totalDailyUsed = keyStatsArray.reduce((sum, stats) => sum + stats.requestsUsedToday, 0);
    const availableKeys = keyStatsArray.filter(stats => this.isKeyAvailable(stats)).length;
    const activeKeys = keyStatsArray.filter(stats => stats.status !== 'error').length;
    
    const systemStats: SystemStats = {
      totalKeys: this.TOTAL_KEYS,
      activeKeys,
      totalDailyCapacity: this.TOTAL_KEYS * this.RPD_LIMIT,
      totalDailyUsed,
      totalMinuteCapacity: this.TOTAL_KEYS * this.RPM_LIMIT,
      availableKeys,
      nextResetTime: this.getNextMidnight(),
    };
    
    return {
      systemStats,
      keyStats: keyStatsArray,
    };
  }

  /**
   * Check if there are any available keys
   */
  hasAvailableKeys(): boolean {
    return Array.from(this.keyStats.values()).some(stats => this.isKeyAvailable(stats));
  }

  /**
   * Reset a specific key's statistics
   */
  resetKey(keyIndex: number): void {
    const stats = this.keyStats.get(keyIndex);
    if (stats) {
      stats.requestsUsedToday = 0;
      stats.requestsPerMinute = 0;
      stats.status = 'available';
      stats.errorCount = 0;
      this.logger.log(`Key ${keyIndex} reset manually`);
    }
  }

  /**
   * Reset all keys' daily statistics
   */
  resetAllKeysDailyStats(): void {
    this.keyStats.forEach((stats) => {
      stats.requestsUsedToday = 0;
      stats.requestsPerMinute = 0;
      stats.status = 'available';
      stats.errorCount = 0;
    });
    this.logger.log('All keys daily stats reset');
  }

  /**
   * Initialize API keys from environment variables
   */
  private initializeKeys(): void {
    for (let i = 1; i <= this.TOTAL_KEYS; i++) {
      const key = this.configService.get<string>(`GEMINI_API_KEY_${i}`);
      if (!key) {
        this.logger.error(`Missing GEMINI_API_KEY_${i} in environment variables`);
        throw new Error(`Missing GEMINI_API_KEY_${i} in environment variables`);
      }
      this.keys.push(key);
    }
    
    this.logger.log(`Initialized ${this.keys.length} Gemini API keys`);
  }

  /**
   * Initialize key statistics
   */
  private initializeKeyStats(): void {
    for (let i = 0; i < this.TOTAL_KEYS; i++) {
      this.keyStats.set(i, {
        keyIndex: i,
        requestsUsedToday: 0,
        requestsPerMinute: 0,
        lastUsed: null,
        status: 'available',
        errorCount: 0,
      });
    }
    
    // Start minute reset interval
    setInterval(() => {
      this.resetMinuteCounters();
    }, 60000); // Reset every minute
  }

  /**
   * Check if a key is available for use
   */
  private isKeyAvailable(stats: KeyStats): boolean {
    return (
      stats.status === 'available' &&
      stats.requestsUsedToday < this.RPD_LIMIT &&
      stats.requestsPerMinute < this.RPM_LIMIT &&
      stats.errorCount < 5 // Temporary ban after 5 consecutive errors
    );
  }

  /**
   * Calculate key status based on current usage
   */
  private calculateKeyStatus(stats: KeyStats): 'available' | 'rate_limited' | 'daily_limit_exceeded' | 'error' {
    if (stats.errorCount >= 5) {
      return 'error';
    }
    
    if (stats.requestsUsedToday >= this.RPD_LIMIT) {
      return 'daily_limit_exceeded';
    }
    
    if (stats.requestsPerMinute >= this.RPM_LIMIT) {
      return 'rate_limited';
    }
    
    return 'available';
  }

  /**
   * Check if error is a rate limiting error
   */
  private isRateLimitError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message || error.toString();
    const statusCode = error.status || error.statusCode;
    
    return (
      statusCode === 429 ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests') ||
      errorMessage.includes('quota exceeded')
    );
  }

  /**
   * Check if error is a daily limit error
   */
  private isDailyLimitError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message || error.toString();
    
    return (
      errorMessage.includes('daily quota') ||
      errorMessage.includes('daily limit') ||
      errorMessage.includes('requests per day')
    );
  }

  /**
   * Reset per-minute counters for all keys
   */
  private resetMinuteCounters(): void {
    this.keyStats.forEach((stats) => {
      stats.requestsPerMinute = 0;
      
      // Update status if it was rate limited due to minute limits
      if (stats.status === 'rate_limited') {
        stats.status = this.calculateKeyStatus(stats);
      }
    });
  }

  /**
   * Start daily reset timer
   */
  private startDailyReset(): void {
    const now = new Date();
    const nextMidnight = this.getNextMidnight();
    const msUntilMidnight = nextMidnight.getTime() - now.getTime();
    
    // Set initial timeout to next midnight
    setTimeout(() => {
      this.resetAllKeysDailyStats();
      
      // Then set daily interval
      setInterval(() => {
        this.resetAllKeysDailyStats();
      }, 24 * 60 * 60 * 1000); // 24 hours
      
    }, msUntilMidnight);
    
    this.logger.log(`Daily reset scheduled for ${nextMidnight.toISOString()}`);
  }

  /**
   * Get next midnight date
   */
  private getNextMidnight(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }
}