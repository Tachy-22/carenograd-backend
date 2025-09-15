import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface UserQuotaStatus {
  userId: string;
  modelName: string;
  allocatedTokensPerMinute: number;
  allocatedRequestsPerMinute: number;
  tokensUsedCurrentMinute: number;
  requestsMadeCurrentMinute: number;
  tokensRemainingCurrentMinute: number;
  requestsRemainingCurrentMinute: number;
  quotaPercentageUsed: number;
  warningLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  canMakeRequest: boolean;
}

export interface SystemTokenOverview {
  modelName: string;
  totalTokensPerMinute: number;
  totalTokensUsedCurrentMinute: number;
  systemTokensRemaining: number;
  activeUsersCount: number;
  tokensPerUser: number;
  systemUsagePercentage: number;
}

export interface TokenUsageRecord {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  userId: string;
  conversationId?: string;
  messageId?: string;
}

@Injectable()
export class DatabaseTokenTrackerService {
  private readonly logger = new Logger(DatabaseTokenTrackerService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Record token usage and update all summaries
   */
  async recordTokenUsage(usage: TokenUsageRecord): Promise<void> {
    try {
      const supabase = this.databaseService.getSupabaseClient();
      
      // Insert token usage record directly
      const { error: insertError } = await supabase
        .from('token_usage_records')
        .insert({
          user_id: usage.userId,
          model_name: usage.model,
          prompt_tokens: usage.promptTokens,
          completion_tokens: usage.completionTokens,
          total_tokens: usage.totalTokens,
          conversation_id: usage.conversationId || null,
          message_id: usage.messageId || null,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        this.logger.error('Failed to insert token usage record:', insertError);
        throw insertError;
      }

      // Update or insert user token usage summary with proper time-based resets
      // First try to get existing summary
      const { data: existingSummary } = await supabase
        .from('user_token_usage_summary')
        .select('*')
        .eq('user_id', usage.userId)
        .eq('model_name', usage.model)
        .single();

      const now = new Date();
      const currentMinute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
      const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
      const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (existingSummary) {
        // Check if we need to reset counters based on time boundaries
        const lastResetMinute = existingSummary.last_reset_minute ? new Date(existingSummary.last_reset_minute) : new Date(0);
        const lastResetHour = existingSummary.last_reset_hour ? new Date(existingSummary.last_reset_hour) : new Date(0);
        const lastResetDay = existingSummary.last_reset_day ? new Date(existingSummary.last_reset_day) : new Date(0);

        // Determine if counters should be reset
        const shouldResetMinute = currentMinute.getTime() > lastResetMinute.getTime();
        const shouldResetHour = currentHour.getTime() > lastResetHour.getTime();
        const shouldResetDay = currentDay.getTime() > lastResetDay.getTime();

        // Calculate new values
        const newTokensMinute = shouldResetMinute ? usage.totalTokens : (existingSummary.tokens_used_current_minute || 0) + usage.totalTokens;
        const newRequestsMinute = shouldResetMinute ? 1 : (existingSummary.requests_made_current_minute || 0) + 1;
        const newTokensHour = shouldResetHour ? usage.totalTokens : (existingSummary.tokens_used_current_hour || 0) + usage.totalTokens;
        const newRequestsHour = shouldResetHour ? 1 : (existingSummary.requests_made_current_hour || 0) + 1;
        const newTokensDay = shouldResetDay ? usage.totalTokens : (existingSummary.tokens_used_today || 0) + usage.totalTokens;
        const newRequestsDay = shouldResetDay ? 1 : (existingSummary.requests_made_today || 0) + 1;

        const { error: updateError } = await supabase
          .from('user_token_usage_summary')
          .update({
            tokens_used_current_minute: newTokensMinute,
            requests_made_current_minute: newRequestsMinute,
            tokens_used_current_hour: newTokensHour,
            requests_made_current_hour: newRequestsHour,
            tokens_used_today: newTokensDay,
            requests_made_today: newRequestsDay,
            last_reset_minute: shouldResetMinute ? currentMinute.toISOString() : existingSummary.last_reset_minute,
            last_reset_hour: shouldResetHour ? currentHour.toISOString() : existingSummary.last_reset_hour,
            last_reset_day: shouldResetDay ? currentDay.toISOString() : existingSummary.last_reset_day,
            updated_at: now.toISOString()
          })
          .eq('user_id', usage.userId)
          .eq('model_name', usage.model);

        if (updateError) {
          this.logger.error('Failed to update token usage summary:', updateError);
        } else if (shouldResetMinute || shouldResetHour || shouldResetDay) {
          this.logger.log(`🔄 Reset counters for user ${usage.userId}: minute=${shouldResetMinute}, hour=${shouldResetHour}, day=${shouldResetDay}`);
        }
      } else {
        // Insert new record
        const { error: insertSummaryError } = await supabase
          .from('user_token_usage_summary')
          .insert({
            user_id: usage.userId,
            model_name: usage.model,
            tokens_used_current_minute: usage.totalTokens,
            requests_made_current_minute: 1,
            tokens_used_current_hour: usage.totalTokens,
            requests_made_current_hour: 1,
            tokens_used_today: usage.totalTokens,
            requests_made_today: 1,
            last_reset_minute: currentMinute.toISOString(),
            last_reset_hour: currentHour.toISOString(),
            last_reset_day: currentDay.toISOString(),
            updated_at: now.toISOString()
          });

        if (insertSummaryError) {
          this.logger.error('Failed to insert token usage summary:', insertSummaryError);
        }
      }

      this.logger.log(`📊 Token usage recorded: ${usage.totalTokens} tokens for user ${usage.userId} using ${usage.model}`);
    } catch (error) {
      this.logger.error('Failed to record token usage:', error);
      throw error;
    }
  }

  /**
   * Get user's current quota status for a specific model
   */
  async getUserQuotaStatus(userId: string, modelName: string = 'gemini-2.0-flash'): Promise<UserQuotaStatus | null> {
    try {
      const supabase = this.databaseService.getSupabaseClient();
      
      // Use direct table queries instead of PostgreSQL functions
      // First get user quota allocation
      const { data: quotaData, error: quotaError } = await supabase
        .from('user_token_quotas')
        .select('*')
        .eq('user_id', userId)
        .eq('model_name', modelName)
        .eq('is_active', true)
        .single();
      
      if (quotaError || !quotaData) {
        // User doesn't have quota yet, trigger allocation
        await this.allocateUserQuotas();
        
        // Try again after allocation
        const { data: retryQuotaData, error: retryQuotaError } = await supabase
          .from('user_token_quotas')
          .select('*')
          .eq('user_id', userId)
          .eq('model_name', modelName)
          .eq('is_active', true)
          .single();
        
        if (retryQuotaError || !retryQuotaData) {
          return null;
        }
        
        // Use retryQuotaData directly instead of assigning to const quotaData
        const allocatedTokens = retryQuotaData.allocated_tokens_per_minute;
        const allocatedRequests = retryQuotaData.allocated_requests_per_minute;
        
        // Get current usage summary
        const { data: usageData } = await supabase
          .from('user_token_usage_summary')
          .select('*')
          .eq('user_id', userId)
          .eq('model_name', modelName)
          .single();
        
        const tokensUsed = usageData?.tokens_used_current_minute || 0;
        const requestsMade = usageData?.requests_made_current_minute || 0;
        
        const tokensRemaining = Math.max(0, allocatedTokens - tokensUsed);
        const requestsRemaining = Math.max(0, allocatedRequests - requestsMade);
        
        const quotaPercentage = allocatedTokens > 0 ? (tokensUsed / allocatedTokens) * 100 : 0;
        
        let warningLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
        if (quotaPercentage >= 95) warningLevel = 'CRITICAL';
        else if (quotaPercentage >= 80) warningLevel = 'HIGH';
        else if (quotaPercentage >= 60) warningLevel = 'MEDIUM';
        
        const canMakeRequest = tokensUsed < allocatedTokens && requestsMade < allocatedRequests;
        
        return {
          userId,
          modelName,
          allocatedTokensPerMinute: allocatedTokens,
          allocatedRequestsPerMinute: allocatedRequests,
          tokensUsedCurrentMinute: tokensUsed,
          requestsMadeCurrentMinute: requestsMade,
          tokensRemainingCurrentMinute: tokensRemaining,
          requestsRemainingCurrentMinute: requestsRemaining,
          quotaPercentageUsed: quotaPercentage,
          warningLevel,
          canMakeRequest
        };
      }
      
      // Get current usage summary
      const { data: usageData } = await supabase
        .from('user_token_usage_summary')
        .select('*')
        .eq('user_id', userId)
        .eq('model_name', modelName)
        .single();
      
      // Calculate status manually
      const tokensUsed = usageData?.tokens_used_current_minute || 0;
      const requestsMade = usageData?.requests_made_current_minute || 0;
      const allocatedTokens = quotaData.allocated_tokens_per_minute;
      const allocatedRequests = quotaData.allocated_requests_per_minute;
      
      const tokensRemaining = Math.max(0, allocatedTokens - tokensUsed);
      const requestsRemaining = Math.max(0, allocatedRequests - requestsMade);
      
      const quotaPercentage = allocatedTokens > 0 ? (tokensUsed / allocatedTokens) * 100 : 0;
      
      let warningLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
      if (quotaPercentage >= 95) warningLevel = 'CRITICAL';
      else if (quotaPercentage >= 80) warningLevel = 'HIGH';
      else if (quotaPercentage >= 60) warningLevel = 'MEDIUM';
      
      const canMakeRequest = tokensUsed < allocatedTokens && requestsMade < allocatedRequests;
      
      return {
        userId,
        modelName,
        allocatedTokensPerMinute: allocatedTokens,
        allocatedRequestsPerMinute: allocatedRequests,
        tokensUsedCurrentMinute: tokensUsed,
        requestsMadeCurrentMinute: requestsMade,
        tokensRemainingCurrentMinute: tokensRemaining,
        requestsRemainingCurrentMinute: requestsRemaining,
        quotaPercentageUsed: quotaPercentage,
        warningLevel,
        canMakeRequest
      };
      
    } catch (error) {
      this.logger.error('Failed to get user quota status:', error);
      return null;
    }
  }

  /**
   * Get system-wide token overview for all models
   */
  async getSystemTokenOverview(): Promise<SystemTokenOverview[]> {
    try {
      const supabase = this.databaseService.getSupabaseClient();
      
      // Get token pools and calculate overview manually
      const { data: tokenPools, error: poolsError } = await supabase
        .from('token_pools')
        .select('*')
        .eq('is_active', true);
      
      if (poolsError) {
        this.logger.error('Failed to get token pools:', poolsError);
        throw poolsError;
      }
      
      const overviews: SystemTokenOverview[] = [];
      
      for (const pool of tokenPools || []) {
        // Get total usage for this model
        const { data: usageData } = await supabase
          .from('user_token_usage_summary')
          .select('tokens_used_current_minute')
          .eq('model_name', pool.model_name);
        
        const totalTokensUsed = (usageData || []).reduce((sum, usage) => sum + (usage.tokens_used_current_minute || 0), 0);
        
        // Get active users count for this model
        const { count: activeUsersCount } = await supabase
          .from('user_token_quotas')
          .select('user_id', { count: 'exact' })
          .eq('model_name', pool.model_name)
          .eq('is_active', true);
        
        const systemTokensRemaining = Math.max(0, pool.total_tokens_per_minute - totalTokensUsed);
        const tokensPerUser = activeUsersCount && activeUsersCount > 0 ? Math.floor(pool.total_tokens_per_minute / activeUsersCount) : 0;
        const systemUsagePercentage = pool.total_tokens_per_minute > 0 ? (totalTokensUsed / pool.total_tokens_per_minute) * 100 : 0;
        
        overviews.push({
          modelName: pool.model_name,
          totalTokensPerMinute: pool.total_tokens_per_minute,
          totalTokensUsedCurrentMinute: totalTokensUsed,
          systemTokensRemaining,
          activeUsersCount: activeUsersCount || 0,
          tokensPerUser,
          systemUsagePercentage
        });
      }
      
      return overviews;
    } catch (error) {
      this.logger.error('Failed to get system token overview:', error);
      throw error;
    }
  }

  /**
   * Check if user can make a request with estimated token usage
   */
  async canUserMakeRequest(userId: string, estimatedTokens: number, modelName: string = 'gemini-2.0-flash'): Promise<{
    allowed: boolean;
    reason?: string;
    quotaStatus?: UserQuotaStatus;
    suggestedModel?: string;
  }> {
    try {
      const quotaStatus = await this.getUserQuotaStatus(userId, modelName);
      
      if (!quotaStatus) {
        return {
          allowed: false,
          reason: 'No quota allocation found for user'
        };
      }

      // Check if user has enough tokens remaining
      if (quotaStatus.tokensRemainingCurrentMinute < estimatedTokens) {
        // Try to find alternative model with sufficient quota
        const alternativeModel = await this.findAvailableModelForUser(userId, estimatedTokens);
        
        return {
          allowed: false,
          reason: `Insufficient tokens. Need: ${estimatedTokens}, Available: ${quotaStatus.tokensRemainingCurrentMinute}`,
          quotaStatus,
          suggestedModel: alternativeModel as string
        };
      }

      // Check if user has request capacity
      if (quotaStatus.requestsRemainingCurrentMinute <= 0) {
        return {
          allowed: false,
          reason: 'Request limit exceeded for current minute',
          quotaStatus
        };
      }

      return {
        allowed: true,
        quotaStatus
      };
    } catch (error) {
      this.logger.error('Failed to check if user can make request:', error);
      return {
        allowed: false,
        reason: 'Error checking quota status'
      };
    }
  }

  /**
   * Find an alternative model that user can use for the request
   */
  async findAvailableModelForUser(userId: string, estimatedTokens: number): Promise<string | null> {
    try {
      const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-flash-002', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
      
      for (const model of models) {
        const quotaStatus = await this.getUserQuotaStatus(userId, model);
        if (quotaStatus && quotaStatus.tokensRemainingCurrentMinute >= estimatedTokens && quotaStatus.requestsRemainingCurrentMinute > 0) {
          return model;
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error('Failed to find available model:', error);
      return null;
    }
  }

  /**
   * Trigger quota reallocation based on active users
   */
  async allocateUserQuotas(): Promise<void> {
    try {
      const supabase = this.databaseService.getSupabaseClient();
      
      // Get all active token pools
      const { data: tokenPools, error: poolsError } = await supabase
        .from('token_pools')
        .select('*')
        .eq('is_active', true);
      
      if (poolsError) {
        this.logger.error('Failed to get token pools:', poolsError);
        throw poolsError;
      }
      
      for (const pool of tokenPools || []) {
        // Count active users for this model (users who have made requests recently)
        const { count: activeUsersCount } = await supabase
          .from('users')
          .select('id', { count: 'exact' })
          .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Active in last 24 hours
        
        const usersCount = Math.max(1, activeUsersCount || 1); // At least 1 user
        const tokensPerUser = Math.floor(pool.total_tokens_per_minute / usersCount);
        const requestsPerUser = Math.floor(pool.total_requests_per_minute / usersCount);
        
        // Get all users to create/update quotas
        const { data: users } = await supabase
          .from('users')
          .select('id');
        
        for (const user of users || []) {
          // Upsert user quota
          const { error: upsertError } = await supabase
            .from('user_token_quotas')
            .upsert({
              user_id: user.id,
              model_name: pool.model_name,
              allocated_tokens_per_minute: tokensPerUser,
              allocated_requests_per_minute: requestsPerUser,
              is_active: true,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id,model_name'
            });
          
          if (upsertError) {
            this.logger.error(`Failed to upsert quota for user ${user.id}:`, upsertError);
          }
        }
      }
      
      this.logger.log('🔄 User quotas reallocated based on active users');
    } catch (error) {
      this.logger.error('Failed to allocate user quotas:', error);
      throw error;
    }
  }

  /**
   * Get user's token usage history
   */
  async getUserTokenHistory(userId: string, limit: number = 10, modelName?: string): Promise<any[]> {
    try {
      const supabase = this.databaseService.getSupabaseClient();
      
      let queryBuilder = supabase
        .from('token_usage_records')
        .select('prompt_tokens, completion_tokens, total_tokens, model_name, conversation_id, message_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (modelName) {
        queryBuilder = queryBuilder.eq('model_name', modelName);
      }
      
      const { data, error } = await queryBuilder;
      
      if (error) {
        this.logger.error('Failed to get user token history:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      this.logger.error('Failed to get user token history:', error);
      throw error;
    }
  }

  /**
   * Get quota status for all models for a user
   */
  async getUserAllModelsQuotaStatus(userId: string): Promise<UserQuotaStatus[]> {
    try {
      const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-flash-002', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
      const quotaStatuses: UserQuotaStatus[] = [];
      
      for (const model of models) {
        const status = await this.getUserQuotaStatus(userId, model);
        if (status) {
          quotaStatuses.push(status);
        }
      }
      
      return quotaStatuses;
    } catch (error) {
      this.logger.error('Failed to get user quota status for all models:', error);
      throw error;
    }
  }

  /**
   * Reset user's current usage (for testing/admin purposes)
   */
  async resetUserUsage(userId: string, modelName?: string): Promise<void> {
    try {
      const supabase = this.databaseService.getSupabaseClient();
      
      let updateQuery = supabase
        .from('user_token_usage_summary')
        .update({
          tokens_used_current_minute: 0,
          requests_made_current_minute: 0,
          tokens_used_current_hour: 0,
          requests_made_current_hour: 0,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      if (modelName) {
        updateQuery = updateQuery.eq('model_name', modelName);
      }
      
      const { error } = await updateQuery;
      
      if (error) {
        this.logger.error('Failed to reset user usage:', error);
        throw error;
      }
      
      this.logger.log(`🔄 Reset usage for user: ${userId}${modelName ? ` model: ${modelName}` : ''}`);
    } catch (error) {
      this.logger.error('Failed to reset user usage:', error);
      throw error;
    }
  }

  /**
   * Get warning level based on quota usage percentage
   */
  getWarningLevel(quotaPercentageUsed: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (quotaPercentageUsed >= 95) return 'CRITICAL';
    if (quotaPercentageUsed >= 80) return 'HIGH';
    if (quotaPercentageUsed >= 60) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Check if user should receive warning notification
   */
  shouldWarnUser(quotaStatus: UserQuotaStatus): boolean {
    return quotaStatus.warningLevel === 'HIGH' || quotaStatus.warningLevel === 'CRITICAL';
  }

  /**
   * Run cleanup of old records (should be called via cron job)
   */
  async cleanupOldRecords(): Promise<void> {
    try {
      const supabase = this.databaseService.getSupabaseClient();
      
      // Delete token usage records older than 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const { error: recordsError } = await supabase
        .from('token_usage_records')
        .delete()
        .lt('created_at', thirtyDaysAgo);
      
      if (recordsError) {
        this.logger.error('Failed to cleanup old token records:', recordsError);
        throw recordsError;
      }
      
      // Reset usage summaries that haven't been updated in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const { error: summaryError } = await supabase
        .from('user_token_usage_summary')
        .update({
          tokens_used_current_minute: 0,
          requests_made_current_minute: 0,
          tokens_used_current_hour: 0,
          requests_made_current_hour: 0,
          updated_at: new Date().toISOString()
        })
        .lt('updated_at', oneHourAgo);
      
      if (summaryError) {
        this.logger.error('Failed to reset old usage summaries:', summaryError);
        throw summaryError;
      }
      
      this.logger.log('🧹 Cleaned up old token usage records');
    } catch (error) {
      this.logger.error('Failed to cleanup old records:', error);
      throw error;
    }
  }

}