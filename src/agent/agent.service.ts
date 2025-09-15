import { Injectable, Logger } from '@nestjs/common';
import { AgentOrchestrator } from '../../agent/orchestrator/agent-orchestrator';
import { DatabaseService, User } from '../database/database.service';
import { DatabaseTokenTrackerService } from './database-token-tracker.service';
import { AuthService } from '../auth/auth.service';

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
    private readonly authService: AuthService
  ) { }

  async chatStream(user: User, request: ChatRequest, onProgress: (update: string) => void): Promise<ChatResponse> {
    return this.chat(user, request, onProgress);
  }

  async chat(user: User, request: ChatRequest, onProgress?: (update: string) => void): Promise<ChatResponse> {
    const { message, conversationId } = request;

    // Create a new orchestrator instance for this user
    const orchestrator = new AgentOrchestrator();

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
    const userMessage = await this.databaseService.createMessage({
      conversation_id: conversation.id,
      user_id: user.id,
      role: 'user',
      content: message,
    });

    // Load conversation history for context
    const conversationMessages = await this.databaseService.getConversationMessages(conversation.id, user.id);
    const conversationHistory = conversationMessages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: new Date(msg.created_at)
    }));

    // Get a valid access token for Google API calls
    const validAccessToken = await this.authService.getValidAccessToken(user);
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
      const estimatedTokens = Math.min(8000, message.length * 4);
      const quotaCheck = await this.databaseTokenTrackerService.canUserMakeRequest(user.id, estimatedTokens);

      if (!quotaCheck.allowed && !quotaCheck.suggestedModel) {
        throw new Error(`Request blocked: ${quotaCheck.reason}. No alternative models available.`);
      }

      if (!quotaCheck.allowed && quotaCheck.suggestedModel) {
        this.logger.warn(`Quota exceeded for user ${user.id}: ${quotaCheck.reason}. Using suggested model: ${quotaCheck.suggestedModel}`);
        onProgress?.(`🔄 Switching to optimized model due to quota limits...`);
      }

      // Execute complex task through orchestrator
      const orchestrationResult = await orchestrator.executeComplexTask(message, userContext, (update) => {
        // Stream progress to client if callback provided
        if (onProgress) {
          onProgress(update);
        } else {
          // Fallback to logging
          this.logger.debug(`Orchestrator progress: ${update}`);
        }
      });

      if (!orchestrationResult.success) {
        throw new Error(`Orchestration failed: ${orchestrationResult.errors.join(', ')}`);
      }

      // Store assistant response
      const assistantMessage = await this.databaseService.createMessage({
        conversation_id: conversation.id,
        user_id: user.id,
        role: 'assistant',
        content: orchestrationResult.finalResponse,
        metadata: {
          orchestrationSteps: orchestrationResult.steps.length,
          executionTime: orchestrationResult.totalExecutionTime,
          specialistsUsed: orchestrationResult.steps.map(s => s.agentName),
          errors: orchestrationResult.errors
        },
      });

      // Record token usage (aggregate from all specialists)
      if (orchestrationResult.tokensUsed > 0) {
        await this.databaseTokenTrackerService.recordTokenUsage({
          promptTokens: Math.floor(orchestrationResult.tokensUsed * 0.7), // Rough estimate
          completionTokens: Math.floor(orchestrationResult.tokensUsed * 0.3),
          totalTokens: orchestrationResult.tokensUsed,
          model: 'gemini-2.0-flash', // Use standard model name for quota tracking
          userId: user.id,
          conversationId: conversation.id,
          messageId: assistantMessage.id
        });
      }

      // Update conversation timestamp
      await this.databaseService.updateConversation(
        conversation.id,
        user.id,
        { updated_at: new Date() }
      );

      return {
        response: orchestrationResult.finalResponse,
        conversationId: conversation.id,
        messageId: assistantMessage.id,
      };
    } catch (error) {
      this.logger.error('Orchestrator processing error:', error);

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