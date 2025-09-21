import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService, User } from '../database/database.service';
import { DatabaseTokenTrackerService } from './database-token-tracker.service';
import { AuthService } from '../auth/auth.service';
import { AgentCacheService } from './agent-cache.service';

export interface ChatRequest {
  message: string;
  conversationId?: string;
}

export interface ChatResponse {
  response: string;
  conversationId: string;
  messageId: string;
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly databaseTokenTrackerService: DatabaseTokenTrackerService,
    private readonly authService: AuthService,
    private readonly agentCacheService: AgentCacheService
  ) { }

  async chatStream(user: User, request: ChatRequest, onProgress: (update: string) => void): Promise<ChatResponse> {
    return this.chat(user, request, onProgress);
  }

  async chat(user: User, request: ChatRequest, onProgress?: (update: string) => void): Promise<ChatResponse> {
    const { message, conversationId } = request;

    // Get cached agent instance for this user (avoids tool reloading)
    const agent = this.agentCacheService.getAgent(user.id);

    // Get or create conversation
    let conversation;
    if (conversationId) {
      // Verify conversation belongs to user
      const conversations = await this.databaseService.getUserConversations(user.id);
      conversation = conversations.find(c => c.id === conversationId);
      if (!conversation) {
        // Create new conversation if not found
        conversation = await this.databaseService.createConversation(user.id, this.generateConversationTitle(message));
      }
    } else {
      // Create new conversation
      conversation = await this.databaseService.createConversation(user.id, this.generateConversationTitle(message));
    }

    // Store user message
    await this.databaseService.createMessage({
      conversation_id: conversation.id,
      user_id: user.id,
      role: 'user',
      content: message,
    });

    // Load conversation history for context (limit to last 20 messages for performance)
    const [conversationMessages, validAccessToken] = await Promise.all([
      this.databaseService.getConversationMessages(conversation.id, user.id, 20), // Limit history
      this.authService.getValidAccessToken(user)
    ]);

    const conversationHistory = conversationMessages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: new Date(msg.created_at)
    }));

    console.log(`🔍 User ${JSON.stringify(user)} access token:`, validAccessToken ? validAccessToken.substring(0, 20) + '...' : 'NULL');
    console.log(`🔍 User token expires at:`, user.token_expires_at);

    // Create user context for orchestrator
    const userContext = {
      userId: user.id,
      accessToken: validAccessToken || undefined,
      tokenExpiresAt: user.token_expires_at || undefined,
      conversationHistory
    };

    try {
      // Check quota before making request
      const estimatedTokensForQuota = Math.min(8000, message.length * 4);
      const quotaCheck = await this.databaseTokenTrackerService.canUserMakeRequest(user.id, estimatedTokensForQuota);

      if (!quotaCheck.allowed && !quotaCheck.suggestedModel) {
        throw new Error(`Request blocked: ${quotaCheck.reason}. No alternative models available.`);
      }

      if (!quotaCheck.allowed && quotaCheck.suggestedModel) {
        this.logger.warn(`Quota exceeded for user ${user.id}: ${quotaCheck.reason}. Using suggested model: ${quotaCheck.suggestedModel}`);
        onProgress?.(`🔄 Switching to optimized model due to quota limits...`);
      }

      // Execute task through monolithic agent with complete workflow capability
      const agentResult = await agent.executeTask(message, userContext, (update) => {
        // Stream progress to client if callback provided
        if (onProgress) {
          onProgress(update.message);
        } else {
          // Fallback to logging
          this.logger.debug(`Agent progress: ${update.message}`);
        }
      });

      if (!agentResult.success) {
        throw new Error(`Agent execution failed: ${agentResult.errors?.join(', ') || 'Unknown error'}`);
      }

      // Store assistant response and record usage in parallel
      const assistantMessage = await this.databaseService.createMessage({
        conversation_id: conversation.id,
        user_id: user.id,
        role: 'assistant',
        content: agentResult.response,
        metadata: {
          stepsUsed: agentResult.stepsUsed,
          executionTime: agentResult.executionTime,
          toolsUsed: agentResult.toolsUsed,
          errors: agentResult.errors
        },
      });

      // Record token usage and update conversation in parallel (don't block response)
      const estimatedTokens = Math.max(100, message.length * 2 + agentResult.response.length);
      Promise.all([
        this.databaseTokenTrackerService.recordTokenUsage({
          promptTokens: Math.floor(estimatedTokens * 0.7),
          completionTokens: Math.floor(estimatedTokens * 0.3),
          totalTokens: estimatedTokens,
          model: 'gemini-2.5-flash',
          userId: user.id,
          conversationId: conversation.id,
          messageId: assistantMessage.id
        }),
        this.databaseService.updateConversation(
          conversation.id,
          user.id,
          { updated_at: new Date() }
        )
      ]).catch(error => this.logger.error('Background task failed:', error));

      return {
        response: agentResult.response,
        conversationId: conversation.id,
        messageId: assistantMessage.id,
      };
    } catch (error) {
      this.logger.error('Agent processing error:', error);

      // Store error response
      const errorMessage = await this.databaseService.createMessage({
        conversation_id: conversation.id,
        user_id: user.id,
        role: 'assistant',
        content: `I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { error: true },
      });

      return {
        response: `I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        conversationId: conversation.id,
        messageId: errorMessage.id,
      };
    }
  }

  private generateConversationTitle(message: string): string {
    // Generate a title based on the first message (truncate to 50 chars)
    const title = message.length > 50 ? message.substring(0, 50) + '...' : message;
    return title;
  }

  async getConversations(user: User) {
    return await this.databaseService.getUserConversations(user.id);
  }

  async getConversationMessages(user: User, conversationId: string) {
    return await this.databaseService.getConversationMessages(conversationId, user.id);
  }
}