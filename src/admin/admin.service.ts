import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MultiApiAllocationService } from '../services/multi-api-allocation.service';
import { GeminiKeyPoolService } from '../services/gemini-key-pool.service';
import { UserAllocationDto, SystemQuotaOverviewDto, KeyPoolStatsDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly allocationService: MultiApiAllocationService,
    private readonly keyPoolService: GeminiKeyPoolService,
  ) {}

  /**
   * Get comprehensive system health and usage metrics
   */
  async getSystemMetrics() {
    this.logger.log('Generating system metrics for admin dashboard');

    const [userStats, conversationStats, messageStats] = await Promise.all([
      this.databaseService.getUserStats(),
      this.databaseService.getConversationStats(),
      this.databaseService.getMessageStats(),
    ]);

    // Calculate growth rates
    const userGrowthRate = userStats.newUsersThisWeek > 0 
      ? ((userStats.newUsersThisWeek - userStats.newUsersToday) / userStats.newUsersThisWeek) * 100 
      : 0;

    const conversationGrowthRate = conversationStats.conversationsThisWeek > 0
      ? ((conversationStats.conversationsThisWeek - conversationStats.conversationsToday) / conversationStats.conversationsThisWeek) * 100
      : 0;

    return {
      users: {
        ...userStats,
        growthRate: userGrowthRate,
        activeUserPercentage: userStats.totalUsers > 0 ? (userStats.activeUsers / userStats.totalUsers) * 100 : 0,
      },
      conversations: {
        ...conversationStats,
        growthRate: conversationGrowthRate,
        avgConversationsPerUser: userStats.activeUsers > 0 ? conversationStats.totalConversations / userStats.activeUsers : 0,
      },
      messages: {
        ...messageStats,
        avgMessagesPerConversation: conversationStats.totalConversations > 0 
          ? messageStats.totalMessages / conversationStats.totalConversations 
          : 0,
      },
      systemHealth: {
        status: 'healthy',
        timestamp: new Date(),
      },
    };
  }

  /**
   * Get user engagement analytics
   */
  async getUserEngagementMetrics() {
    this.logger.log('Calculating user engagement metrics');

    // This would require more complex queries in a real implementation
    // For now, we'll use the existing stats methods
    const userStats = await this.databaseService.getUserStats();
    const conversationStats = await this.databaseService.getConversationStats();
    const messageStats = await this.databaseService.getMessageStats();

    return {
      dailyActiveUsers: userStats.newUsersToday, // Simplified - would need proper DAU tracking
      weeklyActiveUsers: userStats.newUsersThisWeek,
      monthlyActiveUsers: userStats.newUsersThisMonth,
      avgSessionsPerUser: conversationStats.totalConversations / userStats.activeUsers || 0,
      avgMessagesPerSession: messageStats.totalMessages / conversationStats.totalConversations || 0,
      userRetentionRate: 85, // Placeholder - would calculate from actual data
      engagement: {
        highlyActive: Math.floor(userStats.activeUsers * 0.2), // Top 20%
        moderatelyActive: Math.floor(userStats.activeUsers * 0.5), // 50%
        lowActivity: Math.floor(userStats.activeUsers * 0.3), // 30%
      },
    };
  }

  /**
   * Get content and usage analytics
   */
  async getContentAnalytics() {
    this.logger.log('Generating content analytics');

    const conversationStats = await this.databaseService.getConversationStats();
    const messageStats = await this.databaseService.getMessageStats();

    return {
      content: {
        totalConversations: conversationStats.totalConversations,
        totalMessages: messageStats.totalMessages,
        avgConversationLength: messageStats.totalMessages / conversationStats.totalConversations || 0,
        mostActiveHours: [9, 10, 14, 15, 16], // Placeholder - would analyze actual timestamps
        peakUsageDays: ['Monday', 'Tuesday', 'Wednesday'], // Placeholder
      },
      trends: {
        dailyGrowth: {
          conversations: conversationStats.conversationsToday,
          messages: messageStats.messagesToday,
        },
        weeklyGrowth: {
          conversations: conversationStats.conversationsThisWeek,
          messages: messageStats.messagesThisWeek,
        },
        monthlyGrowth: {
          conversations: conversationStats.conversationsThisMonth,
          messages: messageStats.messagesThisMonth,
        },
      },
    };
  }

  /**
   * Get user allocations for all users
   */
  async getUserAllocations(modelName: string = 'gemini-2.5-flash'): Promise<UserAllocationDto[]> {
    this.logger.log(`Getting user allocations for model: ${modelName}`);
    
    try {
      const users = await this.databaseService.getAllUsers(1000, 0);
      const allocations: UserAllocationDto[] = [];

      for (const user of users.users) {
        try {
          const allocation = await this.allocationService.getDailyAllocation(user.id, modelName);
          allocations.push({
            userId: user.id,
            userEmail: user.email,
            userName: user.name,
            modelName,
            allocatedRequestsToday: allocation.allocatedRequestsToday,
            requestsUsedToday: allocation.requestsUsedToday,
            requestsRemainingToday: allocation.requestsRemainingToday,
            allocationPercentageUsed: allocation.allocationPercentageUsed,
            canMakeRequest: allocation.canMakeRequest,
            warningLevel: allocation.warningLevel,
            lastRequestAt: user.last_login_at,
          });
        } catch (error) {
          this.logger.warn(`Failed to get allocation for user ${user.id}:`, error);
          allocations.push({
            userId: user.id,
            userEmail: user.email,
            userName: user.name,
            modelName,
            allocatedRequestsToday: 0,
            requestsUsedToday: 0,
            requestsRemainingToday: 0,
            allocationPercentageUsed: 0,
            canMakeRequest: false,
            warningLevel: 'CRITICAL',
            lastRequestAt: undefined,
          });
        }
      }

      return allocations;
    } catch (error) {
      this.logger.error('Failed to get user allocations:', error);
      throw error;
    }
  }

  /**
   * Get system quota overview
   */
  async getSystemQuotaOverview(modelName: string = 'gemini-2.5-flash'): Promise<SystemQuotaOverviewDto> {
    this.logger.log(`Getting system quota overview for model: ${modelName}`);
    
    try {
      const systemOverviewArray = await this.allocationService.getSystemOverview();
      const systemOverview = systemOverviewArray.find(overview => overview.modelName === modelName) || systemOverviewArray[0];
      
      if (!systemOverview) {
        throw new Error('No system overview data available');
      }
      
      return {
        modelName: systemOverview.modelName,
        totalRequestsAvailable: systemOverview.totalRequestsAvailable,
        totalRequestsUsed: systemOverview.totalRequestsUsed,
        requestsRemaining: systemOverview.requestsRemaining,
        systemUsagePercentage: systemOverview.systemUsagePercentage,
        activeUsersCount: systemOverview.activeUsersCount,
        requestsPerUser: systemOverview.requestsPerUser,
        utilizationEfficiency: systemOverview.utilizationEfficiency,
      };
    } catch (error) {
      this.logger.error(`Failed to get system quota overview:`, error);
      throw error;
    }
  }

  /**
   * Get key pool statistics
   */
  async getKeyPoolStats(): Promise<KeyPoolStatsDto> {
    this.logger.log('Getting key pool statistics');
    
    try {
      const stats = this.keyPoolService.getKeyPoolStats();
      const totalKeys = stats.systemStats.totalKeys;
      const availableKeys = stats.systemStats.availableKeys;
      const rateLimitedKeys = totalKeys - availableKeys;
      
      return {
        totalKeys,
        availableKeys,
        rateLimitedKeys,
        exhaustedKeys: 0, // Would need to track this separately
        systemHealth: availableKeys > totalKeys * 0.5 ? 'HEALTHY' : availableKeys > 0 ? 'WARNING' : 'CRITICAL',
        keyUtilization: totalKeys > 0 ? ((totalKeys - availableKeys) / totalKeys) * 100 : 0,
        estimatedRecoveryTime: stats.systemStats.nextResetTime?.toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get key pool stats:', error);
      throw error;
    }
  }

  /**
   * Update user allocation
   */
  async updateUserAllocation(userId: string, modelName: string, dailyAllocation: number, adminId: string) {
    this.logger.log(`Updating allocation for user ${userId}: ${dailyAllocation} requests/day for ${modelName}`);
    
    // Note: This would require implementing persistent allocation updates in the allocation service
    // For now, just log the action
    await this.logAdminAction(adminId, 'UPDATE_USER_ALLOCATION', userId, {
      modelName,
      dailyAllocation,
    });
    
    return { 
      success: true, 
      message: 'Allocation update logged. Implementation requires persistent storage.' 
    };
  }

  /**
   * Log admin action for audit trail
   */
  async logAdminAction(adminId: string, action: string, targetId?: string, details?: any) {
    this.logger.log(`Admin Action: ${action} by ${adminId}${targetId ? ` on ${targetId}` : ''}`, {
      adminId,
      action,
      targetId,
      details,
      timestamp: new Date(),
    });

    // In a production system, you'd want to store these in a dedicated audit log table
    // For now, we'll just log them
  }
}