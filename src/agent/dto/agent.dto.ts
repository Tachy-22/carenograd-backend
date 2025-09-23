import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID } from 'class-validator';

export class ChatRequestDto {
  @ApiProperty({
    example: 'Hello! Can you help me find graduate programs in machine learning?',
    description: 'Message to send to the AI agent'
  })
  @IsString()
  message: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Optional conversation ID to continue existing conversation',
    required: false
  })
  @IsOptional()
  // @IsUUID()
  @IsString()

  conversationId?: string;
}

export class ChatResponseDto {
  @ApiProperty({
    example: 'I\'d be happy to help you find graduate programs in machine learning! Let me start by checking your background...',
    description: 'AI agent response message'
  })
  @IsString()
  response: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Conversation ID for this chat session'
  })
  //  @IsUUID()
  @IsString()
  conversationId: string;

  @ApiProperty({
    example: '660f9500-f39c-51e5-b827-557766551001',
    description: 'Message ID for this specific response'
  })
  @IsUUID()
  messageId: string;
}

export class ConversationDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Conversation unique identifier' })
  //@IsUUID()
  @IsString()

  id: string;

  @ApiProperty({ example: '8b276f6f-ac2d-43db-a776-ce976629d3f1', description: 'User ID who owns the conversation' })
  @IsUUID()
  user_id: string;

  @ApiProperty({ example: 'Graduate Programs Discussion', description: 'Conversation title' })
  @IsString()
  title: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Conversation creation date' })
  created_at: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Last message timestamp' })
  updated_at: Date;
}

export class MessageDto {
  @ApiProperty({ example: '660f9500-f39c-51e5-b827-557766551001', description: 'Message unique identifier' })
  @IsUUID()
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Conversation this message belongs to' })
  @IsUUID()
  conversation_id: string;

  @ApiProperty({ example: '8b276f6f-ac2d-43db-a776-ce976629d3f1', description: 'User ID who sent/received the message' })
  @IsUUID()
  user_id: string;

  @ApiProperty({ example: 'user', enum: ['user', 'assistant'], description: 'Message sender role' })
  @IsString()
  role: 'user' | 'assistant';

  @ApiProperty({ example: 'What are the best machine learning programs?', description: 'Message content' })
  @IsString()
  content: string;

  @ApiProperty({
    example: { toolCalls: [], usage: { totalTokens: 150 } },
    description: 'Additional message metadata',
    required: false
  })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Message creation timestamp' })
  created_at: Date;
}

export class ConversationsResponseDto {
  @ApiProperty({ type: [ConversationDto], description: 'List of user conversations' })
  conversations: ConversationDto[];
}

export class MessagesResponseDto {
  @ApiProperty({ type: [MessageDto], description: 'List of conversation messages' })
  messages: MessageDto[];
}

export class StreamingEventDto {
  @ApiProperty({
    example: 'progress',
    enum: ['progress', 'response', 'error'],
    description: 'Type of streaming event'
  })
  type: 'progress' | 'response' | 'error';

  @ApiProperty({
    example: '🔧 Searching the web for "machine learning programs" to gather relevant information',
    description: 'Event content or message'
  })
  content: string | ChatResponseDto;
}