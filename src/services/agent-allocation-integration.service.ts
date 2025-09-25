import { Injectable, Logger } from '@nestjs/common';
import { GeminiWithKeyPoolService } from './gemini-with-key-pool.service';
import { MultiApiAllocationService } from './multi-api-allocation.service';

export interface AgentRequestOptions {
  prompt?: string;
  messages?: any[];
  system?: string;
  tools?: any;
  stopWhen?: any;
  temperature?: number;
  userId: string; // Required for allocation tracking
  streaming?: boolean;
}

export interface AgentResponse {
  success: boolean;
  result?: any;
  error?: string;
  allocationInfo?: {
    remainingRequests: number;
    totalAllocation: number;
    warningLevel: string;
  };
}

/**
 * Low-coupling integration service for existing agent system
 * This service provides a simple interface to use the Multi-API allocation system
 * without disrupting your existing agent-monolith architecture
 */
@Injectable()
export class AgentAllocationIntegrationService {
  private readonly logger = new Logger(AgentAllocationIntegrationService.name);

  constructor(
    private readonly geminiService: GeminiWithKeyPoolService,
    private readonly allocationService: MultiApiAllocationService,
  ) { }

  /**
   * Main method to make AI requests with automatic allocation and key pool management
   * This is the only method your existing agent system needs to call
   */
  async makeRequest(options: AgentRequestOptions): Promise<AgentResponse> {
    try {
      // 1. Check allocation first
      const allocationCheck = await this.allocationService.canUserMakeRequest(
        options.userId,
        'gemini-2.0-flash'
      );

      if (!allocationCheck.allowed) {
        return {
          success: false,
          error: `QUOTA_EXCEEDED: ${allocationCheck.reason}`,
          allocationInfo: allocationCheck.allocation ? {
            remainingRequests: allocationCheck.allocation.requestsRemainingToday,
            totalAllocation: allocationCheck.allocation.allocatedRequestsToday,
            warningLevel: allocationCheck.allocation.warningLevel,
          } : undefined,
        };
      }

      // 2. Make the AI request with automatic key rotation
      let result;

      if (options.streaming && options.messages) {
        // Streaming request
        result = await this.geminiService.streamTextWithKeyRotation({
          messages: options.messages,
          system: options.system,
          tools: options.tools,
          stopWhen: options.stopWhen,
          temperature: options.temperature,
          userId: options.userId,
        });
      } else if (options.prompt) {
        // Simple text generation
        result = await this.geminiService.generateTextWithKeyRotation({
          prompt: options.prompt,
          system: options.system,
          temperature: options.temperature,
          userId: options.userId,
        });
      } else if (options.messages) {
        // Messages-based generation (convert to streamText)
        result = await this.geminiService.streamTextWithKeyRotation({
          messages: options.messages,
          system: options.system,
          tools: options.tools,
          stopWhen: options.stopWhen,
          temperature: options.temperature,
          userId: options.userId,
        });
      } else {
        throw new Error('Either prompt or messages must be provided');
      }

      // 3. Get updated allocation info
      const updatedAllocation = await this.allocationService.getDailyAllocation(
        options.userId,
        'gemini-2.0-flash'
      );

      this.logger.debug(`Request successful for user ${options.userId}. Remaining: ${updatedAllocation.requestsRemainingToday}/${updatedAllocation.allocatedRequestsToday}`);

      return {
        success: true,
        result,
        allocationInfo: {
          remainingRequests: updatedAllocation.requestsRemainingToday,
          totalAllocation: updatedAllocation.allocatedRequestsToday,
          warningLevel: updatedAllocation.warningLevel,
        },
      };

    } catch (error) {
      this.logger.error(`Request failed for user ${options.userId}:`, error);

      // Handle quota exceeded errors specially
      if (error.message && error.message.includes('DAILY_LIMIT_EXCEEDED')) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: false,
        error: `AI_REQUEST_FAILED: ${error.message || 'Unknown error'}`,
      };
    }
  }

  /**
   * Quick method to check if user can make a request (for pre-checks)
   */
  async canMakeRequest(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const check = await this.allocationService.canUserMakeRequest(userId, 'gemini-2.0-flash');
      return {
        allowed: check.allowed,
        reason: check.reason,
      };
    } catch (error) {
      this.logger.error(`Failed to check allocation for user ${userId}:`, error);
      return {
        allowed: false,
        reason: 'Failed to check allocation',
      };
    }
  }

  /**
   * Get user's current allocation status
   */
  async getAllocationStatus(userId: string): Promise<any> {
    try {
      return await this.allocationService.getDailyAllocation(userId, 'gemini-2.0-flash');
    } catch (error) {
      this.logger.error(`Failed to get allocation status for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<{ healthy: boolean; details: any }> {
    try {
      const keyPoolStats = this.geminiService.getKeyPoolStats();
      const systemOverview = await this.allocationService.getSystemOverview();

      const healthy = keyPoolStats.systemStats.availableKeys > 0;

      return {
        healthy,
        details: {
          availableKeys: keyPoolStats.systemStats.availableKeys,
          totalKeys: keyPoolStats.systemStats.totalKeys,
          systemCapacity: systemOverview[0]?.requestsRemaining || 0,
          activeUsers: systemOverview[0]?.activeUsersCount || 0,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get system health:', error);
      return {
        healthy: false,
        details: { error: error.message },
      };
    }
  }
}