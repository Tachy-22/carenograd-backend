/**
 * Google Search API Key Rotation Manager
 * Manages 10 API keys with automatic rotation for 1000 daily queries at $0 cost
 */

interface ApiKeyStats {
  key: string;
  dailyUsage: number;
  lastReset: string;
  isActive: boolean;
  lastUsed?: Date;
}

export class GoogleSearchKeyManager {
  private static instance: GoogleSearchKeyManager;
  private keys: ApiKeyStats[] = [];
  private currentKeyIndex = 0;

  private constructor() {
    this.initializeKeys();
  }

  public static getInstance(): GoogleSearchKeyManager {
    if (!GoogleSearchKeyManager.instance) {
      GoogleSearchKeyManager.instance = new GoogleSearchKeyManager();
    }
    return GoogleSearchKeyManager.instance;
  }

  private initializeKeys(): void {
    const apiKeys = [
      process.env.GOOGLE_SEARCH_KEY_1,
      process.env.GOOGLE_SEARCH_KEY_2,
      process.env.GOOGLE_SEARCH_KEY_3,
      process.env.GOOGLE_SEARCH_KEY_4,
      process.env.GOOGLE_SEARCH_KEY_5,
      process.env.GOOGLE_SEARCH_KEY_6,
      process.env.GOOGLE_SEARCH_KEY_7,
      process.env.GOOGLE_SEARCH_KEY_8,
      process.env.GOOGLE_SEARCH_KEY_9,
      process.env.GOOGLE_SEARCH_KEY_10
    ].filter(Boolean) as string[]; // Remove undefined values

    if (apiKeys.length === 0) {
      throw new Error('No Google Search API keys configured. Please set GOOGLE_SEARCH_KEY_1 through GOOGLE_SEARCH_KEY_10 environment variables.');
    }

    const today = new Date().toDateString();

    this.keys = apiKeys.map((key, index) => ({
      key,
      dailyUsage: 0,
      lastReset: today,
      isActive: true
    }));
  }

  /**
   * Get next available API key with rotation
   */
  public getAvailableKey(): string | null {
    this.resetDailyCountersIfNeeded();

    // Find key with available quota (prefer current key for efficiency)
    const startIndex = this.currentKeyIndex;
    
    for (let i = 0; i < this.keys.length; i++) {
      const keyIndex = (startIndex + i) % this.keys.length;
      const keyStats = this.keys[keyIndex];
      
      if (keyStats.isActive && keyStats.dailyUsage < 100) {
        this.currentKeyIndex = keyIndex;
        return keyStats.key;
      }
    }

    return null; // All keys exhausted
  }

  /**
   * Track successful API usage
   */
  public trackUsage(apiKey: string): void {
    const keyStats = this.keys.find(k => k.key === apiKey);
    if (keyStats) {
      keyStats.dailyUsage++;
      keyStats.lastUsed = new Date();
    }
  }

  /**
   * Track failed API usage (disable problematic keys)
   */
  public trackFailure(apiKey: string, error: any): void {
    const keyStats = this.keys.find(k => k.key === apiKey);
    if (keyStats) {
      // Disable key if quota exceeded or other persistent errors
      const errorMessage = error?.message?.toLowerCase() || '';
      if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
        keyStats.dailyUsage = 100; // Mark as exhausted
      } else if (errorMessage.includes('invalid') || errorMessage.includes('forbidden')) {
        keyStats.isActive = false; // Disable invalid keys
      }
    }
  }

  /**
   * Get current usage statistics
   */
  public getUsageStats(): {
    totalQueries: number;
    remainingQueries: number;
    activeKeys: number;
    currentKey: string;
    keyDetails: Array<{
      key: string;
      usage: number;
      remaining: number;
      active: boolean;
    }>;
  } {
    this.resetDailyCountersIfNeeded();

    const totalQueries = this.keys.reduce((sum, key) => sum + key.dailyUsage, 0);
    const maxQueries = this.keys.filter(k => k.isActive).length * 100;
    const remainingQueries = maxQueries - totalQueries;
    const activeKeys = this.keys.filter(k => k.isActive).length;
    const currentKey = this.keys[this.currentKeyIndex]?.key || 'None';

    return {
      totalQueries,
      remainingQueries,
      activeKeys,
      currentKey: `${currentKey.slice(0, 8)}...${currentKey.slice(-8)}`,
      keyDetails: this.keys.map(key => ({
        key: `${key.key.slice(0, 8)}...${key.key.slice(-8)}`,
        usage: key.dailyUsage,
        remaining: key.isActive ? 100 - key.dailyUsage : 0,
        active: key.isActive
      }))
    };
  }

  /**
   * Reset all keys (for testing or manual reset)
   */
  public resetAllKeys(): void {
    const today = new Date().toDateString();
    this.keys.forEach(key => {
      key.dailyUsage = 0;
      key.lastReset = today;
      key.isActive = true;
    });
    this.currentKeyIndex = 0;
  }

  /**
   * Reset daily counters if new day
   */
  private resetDailyCountersIfNeeded(): void {
    const today = new Date().toDateString();
    
    this.keys.forEach(key => {
      if (key.lastReset !== today) {
        key.dailyUsage = 0;
        key.lastReset = today;
        key.isActive = true; // Re-enable keys for new day
      }
    });
  }
}