import { Injectable, Logger } from '@nestjs/common';
import { MonolithicAgent } from '../../agent-monolith/monolithic-agent';
import { GeminiWithKeyPoolService } from '../services/gemini-with-key-pool.service';

@Injectable()
export class AgentCacheService {
  private readonly logger = new Logger(AgentCacheService.name);
  private readonly agentCache = new Map<string, MonolithicAgent>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly cacheTimestamps = new Map<string, number>();

  constructor(private readonly geminiService: GeminiWithKeyPoolService) {}

  getAgent(userId: string): MonolithicAgent {
    const now = Date.now();
    const cacheKey = userId;
    
    // Check if cached agent exists and is still valid
    const cachedAgent = this.agentCache.get(cacheKey);
    const cacheTime = this.cacheTimestamps.get(cacheKey);
    
    if (cachedAgent && cacheTime && (now - cacheTime) < this.CACHE_TTL) {
      this.logger.debug(`Using cached agent for user ${userId}`);
      return cachedAgent;
    }

    // Create new agent and cache it
    this.logger.debug(`Creating new agent for user ${userId}`);
    const agent = new MonolithicAgent(this.geminiService);
    
    this.agentCache.set(cacheKey, agent);
    this.cacheTimestamps.set(cacheKey, now);
    
    // Clean up old cache entries
    this.cleanupCache();
    
    return agent;
  }

  private cleanupCache(): void {
    const now = Date.now();
    
    for (const [key, timestamp] of this.cacheTimestamps.entries()) {
      if (now - timestamp > this.CACHE_TTL) {
        this.agentCache.delete(key);
        this.cacheTimestamps.delete(key);
        this.logger.debug(`Cleaned up cached agent for key ${key}`);
      }
    }
  }

  clearCache(): void {
    this.agentCache.clear();
    this.cacheTimestamps.clear();
    this.logger.log('Agent cache cleared');
  }
}