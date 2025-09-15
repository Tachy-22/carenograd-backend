import { Controller, Post, Get, Body, Param, UseGuards, Req, Res, HttpStatus, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AgentService } from './agent.service';
import { DatabaseTokenTrackerService } from './database-token-tracker.service';
import type { ChatRequest, ChatResponse } from './agent.service';
import type { User } from '../database/database.service';
import { 
  ChatRequestDto, 
  ChatResponseDto, 
  ConversationsResponseDto, 
  MessagesResponseDto,
  StreamingEventDto 
} from './dto/agent.dto';

interface AuthenticatedRequest {
  user: User;
}

@ApiTags('Agent')
@Controller('agent')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly databaseTokenTrackerService: DatabaseTokenTrackerService
  ) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Send message to AI agent',
    description: 'Send a message to the AI agent for graduate school application assistance. The agent can help with program research, document analysis, email drafting, and application tracking.'
  })
  @ApiBody({ type: ChatRequestDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Agent response received successfully',
    type: ChatResponseDto
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing JWT token' })
  async chat(
    @Req() req: AuthenticatedRequest,
    @Body() chatRequest: ChatRequest,
  ): Promise<ChatResponse> {
    const user = req.user;
    return await this.agentService.chat(user, chatRequest);
  }

  @Post('chat/stream')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Send message to AI agent with real-time streaming',
    description: 'Send a message to the AI agent and receive streaming response. Supports both Protocol V1 (AI SDK compatible) and V2 (enhanced separation). Use X-Stream-Protocol header to specify version.'
  })
  @ApiBody({ type: ChatRequestDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Streaming response with protocol version based on X-Stream-Protocol header (v1 or v2)'
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing JWT token' })
  async chatStream(
    @Req() req: AuthenticatedRequest,
    @Body() chatRequest: ChatRequest,
    @Res() res: any,
  ): Promise<void> {
    const user = req.user;
    
    // Set headers for AI SDK data stream protocol
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'x-vercel-ai-ui-message-stream': 'v1',
    });

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    let textBlockId = `text_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    try {
      // Send message start
      res.write(`data: ${JSON.stringify({ type: 'start', messageId })}\n\n`);
      
      // Send text start (single continuous block - AI SDK v1 compatible)
      res.write(`data: ${JSON.stringify({ type: 'text-start', id: textBlockId })}\n\n`);

      let accumulatedResponse = '';
      let currentToolCall: string | null = null;
      
      const response = await this.agentService.chatStream(user, chatRequest, (update: string) => {
        // Handle different types of progress updates
        if (update.startsWith('🔧')) {
          // Tool execution started
          const toolCallId = `tool_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          currentToolCall = toolCallId;
          
          // Send tool input start (simplified - tool name extraction could be enhanced)
          const toolNameMatch = update.match(/🔧\s+(.+)/);
          const toolDescription = toolNameMatch ? toolNameMatch[1] : 'AI tool';
          
          res.write(`data: ${JSON.stringify({ 
            type: 'tool-input-start', 
            toolCallId, 
            toolName: 'ai-tool'
          })}\n\n`);
          
          res.write(`data: ${JSON.stringify({ 
            type: 'tool-input-available', 
            toolCallId, 
            toolName: 'ai-tool',
            input: { description: toolDescription }
          })}\n\n`);
          
        } else if (update.startsWith('✅') && currentToolCall) {
          // Tool execution completed
          const outputMatch = update.match(/✅\s+(.+)/);
          const output = outputMatch ? outputMatch[1] : 'Tool completed successfully';
          
          res.write(`data: ${JSON.stringify({ 
            type: 'tool-output-available', 
            toolCallId: currentToolCall, 
            output: { result: output }
          })}\n\n`);
          
          currentToolCall = null;
        } else {
          // Regular progress update as text-delta (pure AI SDK v1)
          const delta = update + '\n';
          accumulatedResponse += delta;
          
          res.write(`data: ${JSON.stringify({ 
            type: 'text-delta', 
            id: textBlockId, 
            delta
          })}\n\n`);
        }
      });

      // Add separator and final response to the SAME text block
      if (response && response.response && !accumulatedResponse.includes(response.response)) {
        const separator = '\n\n---\n\n'; // Visual separator between progress and response
        const finalDelta = separator + response.response;
        
        res.write(`data: ${JSON.stringify({ 
          type: 'text-delta', 
          id: textBlockId, 
          delta: finalDelta
        })}\n\n`);
      }

      // Send conversation metadata as custom data part
      if (response && response.conversationId) {
        res.write(`data: ${JSON.stringify({ 
          type: 'data-conversation', 
          data: { 
            conversationId: response.conversationId,
            messageId: response.messageId
          }
        })}\n\n`);
      }

      // End the single text block
      res.write(`data: ${JSON.stringify({ type: 'text-end', id: textBlockId })}\n\n`);
      
      // Send message finish
      res.write(`data: ${JSON.stringify({ type: 'finish' })}\n\n`);
      
      // Send stream termination
      res.write('data: [DONE]\n\n');
    } catch (error) {
      // Send error part
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        errorText: error instanceof Error ? error.message : 'Unknown error' 
      })}\n\n`);
      
      res.write('data: [DONE]\n\n');
    }

    res.end();
  }

  @Get('conversations')
  @ApiOperation({ 
    summary: 'Get user conversations',
    description: 'Retrieve all conversations for the authenticated user, ordered by most recent activity.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Conversations retrieved successfully',
    type: ConversationsResponseDto
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing JWT token' })
  async getConversations(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    const conversations = await this.agentService.getConversations(user);
    return { conversations };
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ 
    summary: 'Get conversation messages',
    description: 'Retrieve all messages from a specific conversation, ordered chronologically.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Messages retrieved successfully',
    type: MessagesResponseDto
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing JWT token' })
  @ApiResponse({ status: 404, description: 'Conversation not found or access denied' })
  async getConversationMessages(
    @Req() req: AuthenticatedRequest,
    @Param('id') conversationId: string,
  ) {
    const user = req.user;
    const messages = await this.agentService.getConversationMessages(user, conversationId);
    return { messages };
  }

  @Get('tokens/statistics')
  @ApiOperation({ 
    summary: 'Get comprehensive token usage statistics',
    description: 'Get system-wide token usage statistics including total available tokens, tokens used, number of users, current model, and per-model status.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Token statistics retrieved successfully'
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing JWT token' })
  async getTokenStatistics() {
    return await this.databaseTokenTrackerService.getSystemTokenOverview();
  }

  @Get('tokens/user')
  @ApiOperation({ 
    summary: 'Get user-specific token usage statistics',
    description: 'Get token usage statistics for the authenticated user including tokens used, requests made, current model, and recent usage history.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User token statistics retrieved successfully'
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing JWT token' })
  async getUserTokenStatistics(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    const quotaStatus = await this.databaseTokenTrackerService.getUserQuotaStatus(user.id);
    const tokenHistory = await this.databaseTokenTrackerService.getUserTokenHistory(user.id, 10);
    
    return {
      tokensUsed: quotaStatus?.tokensUsedCurrentMinute || 0,
      requestsMade: quotaStatus?.requestsMadeCurrentMinute || 0,
      currentModel: 'gemini-2.0-flash',
      percentageOfTotal: quotaStatus?.quotaPercentageUsed || 0,
      recentUsage: tokenHistory
    };
  }

  @Post('tokens/reset')
  @ApiOperation({ 
    summary: 'Reset user token usage',
    description: 'Reset token usage statistics for the authenticated user. Useful for testing or administrative purposes.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User token usage reset successfully'
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing JWT token' })
  async resetUserTokenUsage(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    await this.databaseTokenTrackerService.resetUserUsage(user.id);
    return { message: 'User token usage reset successfully', userId: user.id };
  }

  @Get('tokens/quota-status')
  @ApiOperation({ 
    summary: 'Get user quota status for frontend warnings',
    description: 'Get detailed quota status including warning levels and remaining capacity. Used by frontend to show quota warnings.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User quota status retrieved successfully'
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing JWT token' })
  async getUserQuotaStatus(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    return await this.databaseTokenTrackerService.getUserQuotaStatus(user.id);
  }

  @Get('tokens/can-request/:estimatedTokens')
  @ApiOperation({ 
    summary: 'Check if user can make request with estimated tokens',
    description: 'Frontend can call this before making requests to check quota availability and get warnings.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Request permission check completed'
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing JWT token' })
  async canUserMakeRequest(
    @Req() req: AuthenticatedRequest,
    @Param('estimatedTokens') estimatedTokens: string
  ) {
    const user = req.user;
    const tokens = parseInt(estimatedTokens, 10);
    
    if (isNaN(tokens) || tokens <= 0) {
      return {
        allowed: false,
        reason: 'Invalid token estimate provided'
      };
    }

    return await this.databaseTokenTrackerService.canUserMakeRequest(user.id, tokens);
  }

  @Get('tokens/warning-level')
  @ApiOperation({ 
    summary: 'Get current warning level for frontend notifications',
    description: 'Returns warning level (LOW, MEDIUM, HIGH, CRITICAL) for frontend to show appropriate warnings.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Warning level retrieved successfully'
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing JWT token' })
  async getWarningLevel(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    const quotaStatus = await this.databaseTokenTrackerService.getUserQuotaStatus(user.id);
    
    if (!quotaStatus) {
      return {
        warningLevel: 'LOW',
        shouldWarn: false,
        percentageUsed: 0,
        tokensUsed: 0,
        currentModel: 'gemini-2.0-flash',
        message: 'No quota data available'
      };
    }
    
    const shouldWarn = this.databaseTokenTrackerService.shouldWarnUser(quotaStatus);
    
    return {
      warningLevel: quotaStatus.warningLevel,
      shouldWarn,
      percentageUsed: quotaStatus.quotaPercentageUsed,
      tokensUsed: quotaStatus.tokensUsedCurrentMinute,
      currentModel: quotaStatus.modelName,
      message: shouldWarn ? 
        `You are approaching your quota limit (${quotaStatus.quotaPercentageUsed.toFixed(1)}% used)` : 
        'Quota usage is within normal limits'
    };
  }
}