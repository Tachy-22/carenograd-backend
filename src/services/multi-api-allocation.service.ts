import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';

export interface DailyAllocation {
  userId: string;
  modelName: string;
  allocatedRequestsToday: number;
  requestsUsedToday: number;
  requestsRemainingToday: number;
  allocationPercentageUsed: number;
  canMakeRequest: boolean;
  activeUsersCount: number;
  allocationMessage: string;
  warningLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  shouldWarn: boolean;
}

export interface SystemOverview {
  modelName: string;
  totalRequestsAvailable: number;
  totalRequestsUsed: number;
  requestsRemaining: number;
  systemUsagePercentage: number;
  activeUsersCount: number;
  requestsPerUser: number;
  utilizationEfficiency: number;
}

export interface AllocationCheck {
  allowed: boolean;
  reason?: string;
  allocation?: DailyAllocation;
}

@Injectable()
export class MultiApiAllocationService {
  private readonly logger = new Logger(MultiApiAllocationService.name);
  
  // Configuration constants
  private readonly GEMINI_TOTAL_RPD = 3000; // 15 keys × 200 RPD per key
  private readonly MIN_REQUESTS_PER_USER = 30;
  private readonly MAX_USERS_CAP = 100;
  
  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Get today's dynamic allocation for a user
   */
  async getDailyAllocation(userId: string, modelName: string = 'gemini-2.5'): Promise<DailyAllocation> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get active users count for today
      const activeUsersCount = await this.getActiveUsersToday(today);
      
      // Calculate dynamic allocation
      const allocatedRequestsToday = this.calculateDynamicAllocation(activeUsersCount);
      
      // Get user's current usage
      const requestsUsedToday = await this.getUserRequestsToday(userId, modelName, today);
      
      // Calculate remaining requests
      const requestsRemainingToday = Math.max(0, allocatedRequestsToday - requestsUsedToday);
      
      // Calculate percentage used
      const allocationPercentageUsed = (requestsUsedToday / allocatedRequestsToday) * 100;
      
      // Determine if user can make a request
      const canMakeRequest = requestsRemainingToday > 0;
      
      // Generate allocation message
      const allocationMessage = this.generateAllocationMessage(
        requestsRemainingToday,
        allocatedRequestsToday,
        activeUsersCount
      );
      
      // Determine warning level
      const { warningLevel, shouldWarn } = this.calculateWarningLevel(allocationPercentageUsed);
      
      return {
        userId,
        modelName,
        allocatedRequestsToday,
        requestsUsedToday,
        requestsRemainingToday,
        allocationPercentageUsed,
        canMakeRequest,
        activeUsersCount,
        allocationMessage,
        warningLevel,
        shouldWarn,
      };
    } catch (error) {
      this.logger.error(`Failed to get daily allocation for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a user can make a request
   */
  async canUserMakeRequest(userId: string, modelName: string = 'gemini-2.5'): Promise<AllocationCheck> {
    try {
      const allocation = await this.getDailyAllocation(userId, modelName);
      
      if (!allocation.canMakeRequest) {
        return {
          allowed: false,
          reason: `Daily request limit exceeded. You've used ${allocation.requestsUsedToday}/${allocation.allocatedRequestsToday} requests today. Your allocation may increase if fewer users are active.`,
          allocation,
        };
      }
      
      return {
        allowed: true,
        allocation,
      };
    } catch (error) {
      this.logger.error(`Failed to check allocation for user ${userId}:`, error);
      return {
        allowed: false,
        reason: 'Failed to check allocation. Please try again.',
      };
    }
  }

  /**
   * Track a request for a user (increment their usage)
   */
  async trackUserRequest(userId: string, modelName: string = 'gemini-2.5'): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await this.databaseService['supabase']
        .from('user_daily_allocations')
        .upsert({
          user_id: userId,
          model_name: modelName,
          date: today,
          requests_used: 1,
        }, {
          onConflict: 'user_id,model_name,date',
          ignoreDuplicates: false,
        });

      if (error) {
        // If upsert failed, try to increment existing record
        const { error: incrementError } = await this.databaseService['supabase']
          .rpc('increment_user_requests', {
            p_user_id: userId,
            p_model_name: modelName,
            p_date: today,
          });

        if (incrementError) {
          throw incrementError;
        }
      }

      this.logger.debug(`Tracked request for user ${userId} on ${today}`);
    } catch (error) {
      this.logger.error(`Failed to track request for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get system overview for all models
   */
  async getSystemOverview(): Promise<SystemOverview[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const modelName = 'gemini-2.5';
      
      // Get active users count
      const activeUsersCount = await this.getActiveUsersToday(today);
      
      // Get total usage today
      const totalRequestsUsed = await this.getTotalRequestsToday(modelName, today);
      
      // Calculate allocations
      const totalRequestsAvailable = this.GEMINI_TOTAL_RPD;
      const requestsRemaining = Math.max(0, totalRequestsAvailable - totalRequestsUsed);
      const systemUsagePercentage = (totalRequestsUsed / totalRequestsAvailable) * 100;
      const requestsPerUser = this.calculateDynamicAllocation(activeUsersCount);
      const utilizationEfficiency = (totalRequestsUsed / totalRequestsAvailable) * 100;
      
      return [{
        modelName,
        totalRequestsAvailable,
        totalRequestsUsed,
        requestsRemaining,
        systemUsagePercentage,
        activeUsersCount,
        requestsPerUser,
        utilizationEfficiency,
      }];
    } catch (error) {
      this.logger.error('Failed to get system overview:', error);
      throw error;
    }
  }

  /**
   * Calculate dynamic allocation based on active users
   */
  private calculateDynamicAllocation(activeUsersCount: number): number {
    if (activeUsersCount === 0) {
      return this.GEMINI_TOTAL_RPD;
    }
    
    // Limit users to prevent too low allocation
    const effectiveUserCount = Math.min(activeUsersCount, this.MAX_USERS_CAP);
    
    // Calculate allocation with minimum guarantee
    const calculatedAllocation = Math.floor(this.GEMINI_TOTAL_RPD / effectiveUserCount);
    
    return Math.max(calculatedAllocation, this.MIN_REQUESTS_PER_USER);
  }

  /**
   * Get count of active users today
   */
  private async getActiveUsersToday(date: string): Promise<number> {
    try {
      const { data, error } = await this.databaseService['supabase']
        .from('user_daily_allocations')
        .select('user_id')
        .eq('date', date)
        .gt('requests_used', 0);

      if (error) {
        throw error;
      }

      return data?.length || 0;
    } catch (error) {
      this.logger.error(`Failed to get active users count for ${date}:`, error);
      return 0;
    }
  }

  /**
   * Get user's requests used today
   */
  private async getUserRequestsToday(userId: string, modelName: string, date: string): Promise<number> {
    try {
      const { data, error } = await this.databaseService['supabase']
        .from('user_daily_allocations')
        .select('requests_used')
        .eq('user_id', userId)
        .eq('model_name', modelName)
        .eq('date', date)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      return data?.requests_used || 0;
    } catch (error) {
      this.logger.error(`Failed to get user requests for ${userId} on ${date}:`, error);
      return 0;
    }
  }

  /**
   * Get total requests used today across all users
   */
  private async getTotalRequestsToday(modelName: string, date: string): Promise<number> {
    try {
      const { data, error } = await this.databaseService['supabase']
        .from('user_daily_allocations')
        .select('requests_used')
        .eq('model_name', modelName)
        .eq('date', date);

      if (error) {
        throw error;
      }

      return data?.reduce((total, record) => total + record.requests_used, 0) || 0;
    } catch (error) {
      this.logger.error(`Failed to get total requests for ${date}:`, error);
      return 0;
    }
  }

  /**
   * Generate user-friendly allocation message
   */
  private generateAllocationMessage(
    remaining: number,
    allocated: number,
    activeUsers: number
  ): string {
    if (activeUsers === 1) {
      return `🚀 You're the only active user today! Enjoy ${allocated.toLocaleString()} requests.`;
    }
    
    if (activeUsers <= 5) {
      return `✨ Premium experience! ${remaining}/${allocated} requests remaining. Only ${activeUsers} users active today.`;
    }
    
    if (remaining > allocated * 0.5) {
      return `✅ ${remaining}/${allocated} requests remaining today. Shared among ${activeUsers} active users.`;
    }
    
    if (remaining > 0) {
      return `⚠️ ${remaining}/${allocated} requests remaining today. Shared among ${activeUsers} active users.`;
    }
    
    return `❌ Daily limit reached (${allocated} requests). Your allocation may increase if fewer users are active tomorrow.`;
  }

  /**
   * Calculate warning level based on usage percentage
   */
  private calculateWarningLevel(usagePercentage: number): { warningLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; shouldWarn: boolean } {
    if (usagePercentage >= 95) {
      return { warningLevel: 'CRITICAL', shouldWarn: true };
    }
    
    if (usagePercentage >= 80) {
      return { warningLevel: 'HIGH', shouldWarn: true };
    }
    
    if (usagePercentage >= 60) {
      return { warningLevel: 'MEDIUM', shouldWarn: true };
    }
    
    return { warningLevel: 'LOW', shouldWarn: false };
  }
}