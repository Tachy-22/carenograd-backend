import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, IsUUID, IsBoolean, IsEnum, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export class UserSummaryDto {
  @ApiProperty({ description: 'User unique identifier' })
  id: string;

  @ApiProperty({ description: 'User email address' })
  email: string;

  @ApiProperty({ description: 'User full name' })
  name: string;

  @ApiPropertyOptional({ description: 'User profile picture URL' })
  picture?: string;

  @ApiProperty({ enum: UserRole, description: 'User role' })
  role: UserRole;

  @ApiProperty({ description: 'Whether user account is active' })
  is_active: boolean;

  @ApiPropertyOptional({ description: 'Last login timestamp' })
  last_login_at?: Date;

  @ApiProperty({ description: 'Account creation timestamp' })
  created_at: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updated_at: Date;
}

export class UserActivityDto {
  @ApiProperty({ description: 'Number of conversations' })
  conversations: number;

  @ApiProperty({ description: 'Number of messages' })
  messages: number;

  @ApiProperty({ description: 'Number of documents' })
  documents: number;

  @ApiPropertyOptional({ description: 'Last activity timestamp' })
  lastActive: Date | null;
}

export class UserDetailDto extends UserSummaryDto {
  @ApiProperty({ description: 'User activity statistics' })
  activity: UserActivityDto;
}

export class UsersListResponseDto {
  @ApiProperty({ type: [UserSummaryDto], description: 'List of users' })
  users: UserSummaryDto[];

  @ApiProperty({ description: 'Total number of users' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;
}

export class UpdateUserRoleDto {
  @ApiProperty({ enum: UserRole, description: 'New user role' })
  @IsEnum(UserRole)
  role: UserRole;
}

export class ToggleUserStatusDto {
  @ApiProperty({ description: 'User active status' })
  @IsBoolean()
  is_active: boolean;
}

export class UserStatsDto {
  @ApiProperty({ description: 'Total number of users' })
  totalUsers: number;

  @ApiProperty({ description: 'Number of active users' })
  activeUsers: number;

  @ApiProperty({ description: 'Number of admin users' })
  adminUsers: number;

  @ApiProperty({ description: 'New users registered today' })
  newUsersToday: number;

  @ApiProperty({ description: 'New users registered this week' })
  newUsersThisWeek: number;

  @ApiProperty({ description: 'New users registered this month' })
  newUsersThisMonth: number;
}

export class ConversationStatsDto {
  @ApiProperty({ description: 'Total number of conversations' })
  totalConversations: number;

  @ApiProperty({ description: 'Conversations created today' })
  conversationsToday: number;

  @ApiProperty({ description: 'Conversations created this week' })
  conversationsThisWeek: number;

  @ApiProperty({ description: 'Conversations created this month' })
  conversationsThisMonth: number;
}

export class MessageStatsDto {
  @ApiProperty({ description: 'Total number of messages' })
  totalMessages: number;

  @ApiProperty({ description: 'Messages sent today' })
  messagesToday: number;

  @ApiProperty({ description: 'Messages sent this week' })
  messagesThisWeek: number;

  @ApiProperty({ description: 'Messages sent this month' })
  messagesThisMonth: number;
}

export class AdminDashboardStatsDto {
  @ApiProperty({ description: 'User statistics' })
  users: UserStatsDto;

  @ApiProperty({ description: 'Conversation statistics' })
  conversations: ConversationStatsDto;

  @ApiProperty({ description: 'Message statistics' })
  messages: MessageStatsDto;
}

export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Number of items per page', minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export class ConversationWithUserDto {
  @ApiProperty({ description: 'Conversation ID' })
  id: string;

  @ApiProperty({ description: 'User ID' })
  user_id: string;

  @ApiProperty({ description: 'Conversation title' })
  title: string;

  @ApiProperty({ description: 'Creation timestamp' })
  created_at: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updated_at: Date;

  @ApiProperty({ description: 'User information' })
  users: {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };
}

export class ConversationsListResponseDto {
  @ApiProperty({ type: [ConversationWithUserDto], description: 'List of conversations' })
  conversations: ConversationWithUserDto[];

  @ApiProperty({ description: 'Total number of conversations' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;
}

// Chart Data DTOs
export class ChartDataPointDto {
  @ApiProperty({ description: 'Date in YYYY-MM-DD format' })
  date: string;

  @ApiProperty({ description: 'Count for this date' })
  count: number;
}

export class HeatmapDataPointDto {
  @ApiProperty({ description: 'Hour of day (0-23)' })
  hour: number;

  @ApiProperty({ description: 'Day of week (0=Sunday, 6=Saturday)' })
  day: number;

  @ApiProperty({ description: 'Activity count for this hour/day combination' })
  count: number;
}

export class TopActiveUserDto {
  @ApiProperty({ description: 'User information' })
  user: {
    id: string;
    email: string;
    name: string;
    picture?: string;
    role: 'user' | 'admin';
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
  };

  @ApiProperty({ description: 'Number of messages sent' })
  messageCount: number;

  @ApiProperty({ description: 'Number of conversations created' })
  conversationCount: number;

  @ApiProperty({ description: 'Last activity timestamp' })
  lastActivity: Date;
}

export class UserGrowthDataPointDto {
  @ApiProperty({ description: 'Month in YYYY-MM format' })
  month: string;

  @ApiProperty({ description: 'New users registered this month' })
  newUsers: number;

  @ApiProperty({ description: 'Total users up to this month' })
  totalUsers: number;
}

export class TimeRangeQueryDto {
  @ApiPropertyOptional({
    description: 'Number of days to include in the chart',
    minimum: 1,
    maximum: 365,
    default: 30
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(365)
  days?: number = 30;
}

export class MonthRangeQueryDto {
  @ApiPropertyOptional({
    description: 'Number of months to include in the chart',
    minimum: 1,
    maximum: 24,
    default: 12
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(24)
  months?: number = 12;
}

export class TopUsersQueryDto {
  @ApiPropertyOptional({
    description: 'Number of top users to return',
    minimum: 1,
    maximum: 50,
    default: 10
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

// AI Token Quota & Allocation DTOs
export class UserAllocationDto {
  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'User email' })
  userEmail: string;

  @ApiProperty({ description: 'User name' })
  userName: string;

  @ApiProperty({ description: 'Model name' })
  modelName: string;

  @ApiProperty({ description: 'Allocated requests per day' })
  allocatedRequestsToday: number;

  @ApiProperty({ description: 'Requests used today' })
  requestsUsedToday: number;

  @ApiProperty({ description: 'Requests remaining today' })
  requestsRemainingToday: number;

  @ApiProperty({ description: 'Allocation percentage used' })
  allocationPercentageUsed: number;

  @ApiProperty({ description: 'Whether user can make requests' })
  canMakeRequest: boolean;

  @ApiProperty({ description: 'Warning level', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  warningLevel: string;

  @ApiProperty({ description: 'Last request timestamp' })
  lastRequestAt?: Date;
}

export class SystemQuotaOverviewDto {
  @ApiProperty({ description: 'Model name' })
  modelName: string;

  @ApiProperty({ description: 'Total daily requests available' })
  totalRequestsAvailable: number;

  @ApiProperty({ description: 'Total requests used today' })
  totalRequestsUsed: number;

  @ApiProperty({ description: 'Requests remaining today' })
  requestsRemaining: number;

  @ApiProperty({ description: 'System usage percentage' })
  systemUsagePercentage: number;

  @ApiProperty({ description: 'Number of active users' })
  activeUsersCount: number;

  @ApiProperty({ description: 'Average requests per user' })
  requestsPerUser: number;

  @ApiProperty({ description: 'System utilization efficiency' })
  utilizationEfficiency: number;
}

export class KeyPoolStatsDto {
  @ApiProperty({ description: 'Total number of API keys' })
  totalKeys: number;

  @ApiProperty({ description: 'Number of available keys' })
  availableKeys: number;

  @ApiProperty({ description: 'Number of rate-limited keys' })
  rateLimitedKeys: number;

  @ApiProperty({ description: 'Number of exhausted keys' })
  exhaustedKeys: number;

  @ApiProperty({ description: 'Overall system health', enum: ['HEALTHY', 'WARNING', 'CRITICAL'] })
  systemHealth: string;

  @ApiProperty({ description: 'Key utilization percentage' })
  keyUtilization: number;

  @ApiProperty({ description: 'Estimated recovery time for rate-limited keys' })
  estimatedRecoveryTime?: string;
}

export class UserQuotaUsageDto {
  @ApiProperty({ description: 'User information' })
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    is_active: boolean;
  };

  @ApiProperty({ description: 'Total requests across all models' })
  totalRequests: number;

  @ApiProperty({ description: 'Requests made today' })
  requestsToday: number;

  @ApiProperty({ description: 'Requests made this week' })
  requestsThisWeek: number;

  @ApiProperty({ description: 'Requests made this month' })
  requestsThisMonth: number;

  @ApiProperty({ description: 'Most used model' })
  mostUsedModel: string;

  @ApiProperty({ description: 'Average requests per day' })
  avgRequestsPerDay: number;

  @ApiProperty({ description: 'Last activity timestamp' })
  lastActivity: Date;

  @ApiProperty({ description: 'Current quota status' })
  quotaStatus: 'UNDER_LIMIT' | 'NEAR_LIMIT' | 'AT_LIMIT' | 'OVER_LIMIT';
}

export class AllocationManagementDto {
  @ApiProperty({ description: 'User ID to update allocation for' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Model name' })
  @IsString()
  modelName: string;

  @ApiProperty({ description: 'New daily request allocation' })
  @IsNumber()
  @Min(0)
  @Max(1000)
  dailyAllocation: number;
}

export class ModelQueryDto {
  @ApiPropertyOptional({
    description: 'Model name to filter by',
    default: 'gemini-2.0-flash'
  })
  @IsOptional()
  @IsString()
  model?: string = 'gemini-2.0-flash';
}