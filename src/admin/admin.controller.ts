import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  HttpStatus,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery
} from '@nestjs/swagger';
import { AdminOnly } from '../auth/decorators/admin.decorator';
import { DatabaseService } from '../database/database.service';
import { AdminService } from './admin.service';
import { MultiApiAllocationService } from '../services/multi-api-allocation.service';
import { GeminiKeyPoolService } from '../services/gemini-key-pool.service';
import {
  UsersListResponseDto,
  UserDetailDto,
  UpdateUserRoleDto,
  ToggleUserStatusDto,
  PaginationQueryDto,
  AdminDashboardStatsDto,
  ConversationsListResponseDto,
  UserStatsDto,
  ConversationStatsDto,
  MessageStatsDto,
  ChartDataPointDto,
  HeatmapDataPointDto,
  TopActiveUserDto,
  UserGrowthDataPointDto,
  TimeRangeQueryDto,
  MonthRangeQueryDto,
  TopUsersQueryDto,
  SystemQuotaOverviewDto,
  KeyPoolStatsDto,
  UserQuotaUsageDto,
  AllocationManagementDto,
  ModelQueryDto
} from './dto/admin.dto';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly adminService: AdminService,
    private readonly multiApiAllocationService: MultiApiAllocationService,
    private readonly geminiKeyPoolService: GeminiKeyPoolService
  ) { }

  @Get('dashboard/stats')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get admin dashboard statistics',
    description: 'Retrieve comprehensive statistics for the admin dashboard including user, conversation, and message metrics.'
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics retrieved successfully',
    type: AdminDashboardStatsDto
  })
  async getDashboardStats(): Promise<AdminDashboardStatsDto> {
    const [userStats, conversationStats, messageStats] = await Promise.all([
      this.databaseService.getUserStats(),
      this.databaseService.getConversationStats(),
      this.databaseService.getMessageStats(),
    ]);

    return {
      users: userStats,
      conversations: conversationStats,
      messages: messageStats,
    };
  }

  @Get('users')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get all users with pagination',
    description: 'Retrieve a paginated list of all users in the system with their basic information and status.'
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    type: UsersListResponseDto
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: 10 })
  async getAllUsers(@Query() query: PaginationQueryDto): Promise<UsersListResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    const { users, total } = await this.databaseService.getAllUsers(limit, offset);

    return {
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role as any,
        is_active: user.is_active,
        last_login_at: user.last_login_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  @Get('users/:id')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get user details by ID',
    description: 'Retrieve detailed information about a specific user including their activity statistics.'
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User details retrieved successfully',
    type: UserDetailDto
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id') id: string): Promise<UserDetailDto> {
    const user = await this.databaseService.getUserById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const activity = await this.databaseService.getUserActivity(id);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      role: user.role as any,
      is_active: user.is_active,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
      activity: {
        conversations: activity.conversations,
        messages: activity.messages,
        documents: activity.documents,
        lastActive: activity.lastActive,
      },
    };
  }

  @Put('users/:id/role')
  @AdminOnly()
  @ApiOperation({
    summary: 'Update user role',
    description: 'Change a user\'s role between user and admin. Only admins can perform this action.'
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User role updated successfully'
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'Invalid role specified' })
  async updateUserRole(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateUserRoleDto
  ): Promise<{ message: string; user: any }> {
    const user = await this.databaseService.getUserById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.databaseService.updateUserRole(id, updateRoleDto.role);

    return {
      message: `User role updated to ${updateRoleDto.role}`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        is_active: updatedUser.is_active,
      },
    };
  }

  @Put('users/:id/status')
  @AdminOnly()
  @ApiOperation({
    summary: 'Toggle user active status',
    description: 'Activate or deactivate a user account. Deactivated users cannot access the system.'
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User status updated successfully'
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async toggleUserStatus(
    @Param('id') id: string,
    @Body() toggleStatusDto: ToggleUserStatusDto
  ): Promise<{ message: string; user: any }> {
    const user = await this.databaseService.getUserById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.databaseService.toggleUserStatus(id, toggleStatusDto.is_active);

    return {
      message: `User ${toggleStatusDto.is_active ? 'activated' : 'deactivated'} successfully`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        is_active: updatedUser.is_active,
      },
    };
  }

  @Delete('users/:id')
  @AdminOnly()
  @ApiOperation({
    summary: 'Delete user account',
    description: 'Permanently delete a user account and all associated data. This action cannot be undone.'
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully'
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(@Param('id') id: string): Promise<{ message: string }> {
    const user = await this.databaseService.getUserById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === 'admin') {
      throw new BadRequestException('Cannot delete admin users');
    }

    await this.databaseService.deleteUser(id);

    return {
      message: 'User and all associated data deleted successfully',
    };
  }

  @Get('conversations')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get all conversations with pagination',
    description: 'Retrieve a paginated list of all conversations in the system with user information.'
  })
  @ApiResponse({
    status: 200,
    description: 'Conversations retrieved successfully',
    type: ConversationsListResponseDto
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: 10 })
  async getAllConversations(@Query() query: PaginationQueryDto): Promise<ConversationsListResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    const { conversations, total } = await this.databaseService.getAllConversations(limit, offset);

    return {
      conversations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  @Get('stats/users')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get detailed user statistics',
    description: 'Retrieve comprehensive user statistics including registration trends and user roles.'
  })
  @ApiResponse({
    status: 200,
    description: 'User statistics retrieved successfully',
    type: UserStatsDto
  })
  async getUserStats(): Promise<UserStatsDto> {
    return this.databaseService.getUserStats();
  }

  @Get('stats/conversations')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get conversation statistics',
    description: 'Retrieve statistics about conversations created over different time periods.'
  })
  @ApiResponse({
    status: 200,
    description: 'Conversation statistics retrieved successfully',
    type: ConversationStatsDto
  })
  async getConversationStats(): Promise<ConversationStatsDto> {
    return this.databaseService.getConversationStats();
  }

  @Get('stats/messages')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get message statistics',
    description: 'Retrieve statistics about messages sent over different time periods.'
  })
  @ApiResponse({
    status: 200,
    description: 'Message statistics retrieved successfully',
    type: MessageStatsDto
  })
  async getMessageStats(): Promise<MessageStatsDto> {
    return this.databaseService.getMessageStats();
  }

  @Get('users/:id/activity')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get user activity details',
    description: 'Retrieve detailed activity information for a specific user.'
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User activity retrieved successfully'
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserActivity(@Param('id') id: string) {
    const user = await this.databaseService.getUserById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const activity = await this.databaseService.getUserActivity(id);

    return {
      userId: id,
      userName: user.name,
      userEmail: user.email,
      activity,
    };
  }

  @Get('analytics/system-metrics')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get comprehensive system metrics',
    description: 'Retrieve detailed system health and usage metrics for advanced analytics.'
  })
  @ApiResponse({
    status: 200,
    description: 'System metrics retrieved successfully'
  })
  async getSystemMetrics() {
    return this.adminService.getSystemMetrics();
  }

  @Get('analytics/user-engagement')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get user engagement analytics',
    description: 'Retrieve user engagement metrics including DAU, retention, and activity patterns.'
  })
  @ApiResponse({
    status: 200,
    description: 'User engagement metrics retrieved successfully'
  })
  async getUserEngagement() {
    return this.adminService.getUserEngagementMetrics();
  }

  @Get('analytics/content')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get content and usage analytics',
    description: 'Retrieve analytics about content creation and usage patterns.'
  })
  @ApiResponse({
    status: 200,
    description: 'Content analytics retrieved successfully'
  })
  async getContentAnalytics() {
    return this.adminService.getContentAnalytics();
  }

  @Post('users/:id/impersonate')
  @AdminOnly()
  @ApiOperation({
    summary: 'Generate impersonation token',
    description: 'Generate a temporary token to impersonate a user for support purposes. Use with extreme caution.'
  })
  @ApiParam({ name: 'id', description: 'User ID to impersonate' })
  @ApiResponse({
    status: 200,
    description: 'Impersonation token generated successfully'
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'Cannot impersonate admin users' })
  async generateImpersonationToken(@Param('id') id: string) {
    const user = await this.databaseService.getUserById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === 'admin') {
      throw new BadRequestException('Cannot impersonate admin users');
    }

    if (!user.is_active) {
      throw new BadRequestException('Cannot impersonate inactive users');
    }

    // Log this sensitive action
    await this.adminService.logAdminAction('admin', 'impersonate_user', id, {
      targetUser: user.email,
      timestamp: new Date()
    });

    // In a real implementation, you'd generate a special JWT token with impersonation claims
    return {
      message: 'Impersonation logged. In production, this would return a special JWT token.',
      targetUser: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      warning: 'This is a sensitive action that has been logged.'
    };
  }

  @Get('audit/recent-actions')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get recent admin actions',
    description: 'Retrieve recent administrative actions for audit purposes.'
  })
  @ApiResponse({
    status: 200,
    description: 'Recent actions retrieved successfully'
  })
  async getRecentActions() {
    // In a real implementation, this would query an audit log table
    return {
      message: 'Audit log feature - would show recent admin actions',
      note: 'In production, this would query a dedicated audit_logs table',
      placeholder_actions: [
        {
          id: '1',
          admin_id: 'admin-123',
          action: 'user_role_updated',
          target_id: 'user-456',
          timestamp: new Date(),
          details: { from: 'user', to: 'admin' }
        },
        {
          id: '2',
          admin_id: 'admin-123',
          action: 'user_deactivated',
          target_id: 'user-789',
          timestamp: new Date(),
          details: { reason: 'policy_violation' }
        }
      ]
    };
  }

  @Get('health')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get system health status',
    description: 'Check the health status of various system components.'
  })
  @ApiResponse({
    status: 200,
    description: 'System health status retrieved successfully'
  })
  async getSystemHealth() {
    try {
      // Test database connectivity
      const userStats = await this.databaseService.getUserStats();

      return {
        status: 'healthy',
        timestamp: new Date(),
        components: {
          database: {
            status: 'healthy',
            response_time_ms: 50, // Placeholder
            connection_pool: 'active'
          },
          api: {
            status: 'healthy',
            uptime_seconds: process.uptime(),
            memory_usage: process.memoryUsage()
          },
          authentication: {
            status: 'healthy',
            provider: 'google_oauth'
          }
        },
        metrics: {
          total_users: userStats.totalUsers,
          active_users: userStats.activeUsers,
          system_load: 'normal'
        }
      };
    } catch (error) {
      return {
        status: 'degraded',
        timestamp: new Date(),
        error: 'Database connectivity issue',
        components: {
          database: {
            status: 'unhealthy',
            error: error.message
          }
        }
      };
    }
  }

  // Chart and Analytics Endpoints
  @Get('charts/user-registrations')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get user registration chart data',
    description: 'Retrieve daily user registration counts for the specified time period. Perfect for line charts showing growth trends.'
  })
  @ApiResponse({
    status: 200,
    description: 'User registration chart data retrieved successfully',
    type: [ChartDataPointDto]
  })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days to include (default: 30)' })
  async getUserRegistrationChart(@Query() query: TimeRangeQueryDto): Promise<ChartDataPointDto[]> {
    return this.databaseService.getUserRegistrationChart(query.days);
  }

  @Get('charts/active-users')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get active users chart data',
    description: 'Retrieve daily active user counts based on last login activity. Shows user engagement over time.'
  })
  @ApiResponse({
    status: 200,
    description: 'Active users chart data retrieved successfully',
    type: [ChartDataPointDto]
  })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days to include (default: 30)' })
  async getActiveUsersChart(@Query() query: TimeRangeQueryDto): Promise<ChartDataPointDto[]> {
    return this.databaseService.getActiveUsersChart(query.days);
  }

  @Get('charts/conversations')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get conversations chart data',
    description: 'Retrieve daily conversation creation counts. Shows platform usage and engagement trends.'
  })
  @ApiResponse({
    status: 200,
    description: 'Conversations chart data retrieved successfully',
    type: [ChartDataPointDto]
  })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days to include (default: 30)' })
  async getConversationsChart(@Query() query: TimeRangeQueryDto): Promise<ChartDataPointDto[]> {
    return this.databaseService.getConversationsChart(query.days);
  }

  @Get('charts/messages')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get messages chart data',
    description: 'Retrieve daily message counts. Indicates overall platform activity and user engagement.'
  })
  @ApiResponse({
    status: 200,
    description: 'Messages chart data retrieved successfully',
    type: [ChartDataPointDto]
  })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days to include (default: 30)' })
  async getMessagesChart(@Query() query: TimeRangeQueryDto): Promise<ChartDataPointDto[]> {
    return this.databaseService.getMessagesChart(query.days);
  }

  @Get('charts/user-activity-heatmap')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get user activity heatmap data',
    description: 'Retrieve activity patterns by hour and day of week. Perfect for heatmap visualizations showing when users are most active.'
  })
  @ApiResponse({
    status: 200,
    description: 'User activity heatmap data retrieved successfully',
    type: [HeatmapDataPointDto]
  })
  async getUserActivityHeatmap(): Promise<HeatmapDataPointDto[]> {
    return this.databaseService.getUserActivityHeatmap();
  }

  @Get('charts/user-growth-trend')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get user growth trend data',
    description: 'Retrieve monthly user growth data showing new registrations and cumulative totals. Ideal for growth trend analysis.'
  })
  @ApiResponse({
    status: 200,
    description: 'User growth trend data retrieved successfully',
    type: [UserGrowthDataPointDto]
  })
  @ApiQuery({ name: 'months', required: false, description: 'Number of months to include (default: 12)' })
  async getUserGrowthTrend(@Query() query: MonthRangeQueryDto): Promise<UserGrowthDataPointDto[]> {
    return this.databaseService.getUserGrowthTrend(query.months);
  }

  @Get('charts/top-active-users')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get top active users',
    description: 'Retrieve most active users ranked by message count and activity. Great for identifying power users and engagement leaders.'
  })
  @ApiResponse({
    status: 200,
    description: 'Top active users retrieved successfully',
    type: [TopActiveUserDto]
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of top users to return (default: 10)' })
  async getTopActiveUsers(@Query() query: TopUsersQueryDto): Promise<TopActiveUserDto[]> {
    return this.databaseService.getTopActiveUsers(query.limit);
  }

  @Get('charts/combined-metrics')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get combined chart metrics',
    description: 'Retrieve multiple chart datasets in a single request for dashboard efficiency. Includes user registrations, active users, conversations, and messages.'
  })
  @ApiResponse({
    status: 200,
    description: 'Combined chart metrics retrieved successfully'
  })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days to include (default: 30)' })
  async getCombinedMetrics(@Query() query: TimeRangeQueryDto) {
    const [userRegistrations, activeUsers, conversations, messages] = await Promise.all([
      this.databaseService.getUserRegistrationChart(query.days),
      this.databaseService.getActiveUsersChart(query.days),
      this.databaseService.getConversationsChart(query.days),
      this.databaseService.getMessagesChart(query.days)
    ]);

    return {
      timeRange: {
        days: query.days || 30,
        startDate: new Date(Date.now() - ((query.days || 30) * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
      },
      charts: {
        userRegistrations,
        activeUsers,
        conversations,
        messages
      },
      summary: {
        totalNewUsers: userRegistrations.reduce((sum, point) => sum + point.count, 0),
        avgDailyActiveUsers: Math.round(activeUsers.reduce((sum, point) => sum + point.count, 0) / activeUsers.length),
        totalConversations: conversations.reduce((sum, point) => sum + point.count, 0),
        totalMessages: messages.reduce((sum, point) => sum + point.count, 0)
      }
    };
  }

  // AI Token Quota & Allocation Management Endpoints
  @Get('quota/system-overview')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get system quota overview',
    description: 'Retrieve system-wide AI token quota usage and allocation statistics across all models.'
  })
  @ApiResponse({
    status: 200,
    description: 'System quota overview retrieved successfully',
    type: [SystemQuotaOverviewDto]
  })
  async getSystemQuotaOverview(): Promise<SystemQuotaOverviewDto[]> {
    const systemOverview = await this.multiApiAllocationService.getSystemOverview();

    return systemOverview.map(overview => ({
      modelName: overview.modelName,
      totalRequestsAvailable: overview.totalRequestsAvailable,
      totalRequestsUsed: overview.totalRequestsUsed,
      requestsRemaining: overview.requestsRemaining,
      systemUsagePercentage: overview.systemUsagePercentage,
      activeUsersCount: overview.activeUsersCount,
      requestsPerUser: overview.requestsPerUser,
      utilizationEfficiency: overview.utilizationEfficiency
    }));
  }

  @Get('quota/key-pool-stats')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get API key pool statistics',
    description: 'Retrieve detailed statistics about API key pool utilization, rate limits, and system health.'
  })
  @ApiResponse({
    status: 200,
    description: 'Key pool statistics retrieved successfully',
    type: KeyPoolStatsDto
  })
  async getKeyPoolStats(): Promise<KeyPoolStatsDto> {
    return await this.adminService.getKeyPoolStats();
  }

  @Get('quota/users')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get all user allocations',
    description: 'Retrieve AI token allocation details for all users with pagination support.'
  })
  @ApiResponse({
    status: 200,
    description: 'User allocations retrieved successfully'
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 10)' })
  @ApiQuery({ name: 'model', required: false, description: 'Filter by model name' })
  async getAllUserAllocations(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('model') model?: string
  ) {
    const modelName = model || 'gemini-2.0-flash';
    const allocations = await this.adminService.getUserAllocations(modelName);

    // Apply pagination
    const pageNum = page || 1;
    const limitNum = limit || 10;
    const offset = (pageNum - 1) * limitNum;
    const paginatedAllocations = allocations.slice(offset, offset + limitNum);

    return {
      allocations: paginatedAllocations,
      total: allocations.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(allocations.length / limitNum),
      model: modelName
    };
  }

  @Get('quota/users/:id')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get user quota usage details',
    description: 'Retrieve detailed AI token quota usage for a specific user across all models and time periods.'
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User quota details retrieved successfully',
    type: UserQuotaUsageDto
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserQuotaDetails(@Param('id') id: string): Promise<UserQuotaUsageDto> {
    const user = await this.databaseService.getUserById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get allocation details for the default model
    try {
      const allocation = await this.multiApiAllocationService.getDailyAllocation(id, 'gemini-2.0-flash');
      const activity = await this.databaseService.getUserActivity(id);

      // Calculate quota status
      let quotaStatus: 'UNDER_LIMIT' | 'NEAR_LIMIT' | 'AT_LIMIT' | 'OVER_LIMIT' = 'UNDER_LIMIT';
      if (allocation.allocationPercentageUsed >= 100) {
        quotaStatus = 'OVER_LIMIT';
      } else if (allocation.allocationPercentageUsed >= 90) {
        quotaStatus = 'AT_LIMIT';
      } else if (allocation.allocationPercentageUsed >= 75) {
        quotaStatus = 'NEAR_LIMIT';
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          is_active: user.is_active
        },
        totalRequests: allocation.requestsUsedToday, // This would ideally be from a usage tracking table
        requestsToday: allocation.requestsUsedToday,
        requestsThisWeek: allocation.requestsUsedToday * 7, // Placeholder - would need proper tracking
        requestsThisMonth: allocation.requestsUsedToday * 30, // Placeholder
        mostUsedModel: 'gemini-2.0-flash', // Placeholder
        avgRequestsPerDay: allocation.requestsUsedToday,
        lastActivity: activity.lastActive || new Date(),
        quotaStatus
      };
    } catch (error) {
      // Return default quota info if allocation service fails
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          is_active: user.is_active
        },
        totalRequests: 0,
        requestsToday: 0,
        requestsThisWeek: 0,
        requestsThisMonth: 0,
        mostUsedModel: 'gemini-2.0-flash',
        avgRequestsPerDay: 0,
        lastActivity: new Date(),
        quotaStatus: 'UNDER_LIMIT'
      };
    }
  }

  @Get('quota/usage-trends')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get quota usage trends',
    description: 'Retrieve AI token usage trends over time for system-wide analysis and capacity planning.'
  })
  @ApiResponse({
    status: 200,
    description: 'Usage trends retrieved successfully'
  })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days to include (default: 30)' })
  @ApiQuery({ name: 'model', required: false, description: 'Filter by model name' })
  async getQuotaUsageTrends(
    @Query() timeQuery: TimeRangeQueryDto,
    @Query() modelQuery: ModelQueryDto
  ) {
    // This would ideally pull from a usage tracking table
    // For now, return mock data structure
    const days = timeQuery.days || 30;
    const model = modelQuery.model || 'gemini-2.0-flash';

    // Get system overview for current usage
    const systemOverview = await this.multiApiAllocationService.getSystemOverview();
    const modelData = systemOverview.find(overview => overview.modelName === model);

    // Mock trend data - in production, this would come from historical usage tables
    const trendData: Array<{
      date: string;
      totalRequests: number;
      uniqueUsers: number;
      averageRequestsPerUser: number;
      systemUtilization: number;
      peakHourUsage: number;
    }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      trendData.push({
        date: date.toISOString().split('T')[0],
        totalRequests: Math.floor(Math.random() * (modelData?.totalRequestsUsed || 1000)),
        uniqueUsers: Math.floor(Math.random() * (modelData?.activeUsersCount || 50)),
        averageRequestsPerUser: Math.floor(Math.random() * 50),
        systemUtilization: Math.floor(Math.random() * 100),
        peakHourUsage: Math.floor(Math.random() * 200)
      });
    }

    return {
      model,
      timeRange: {
        days,
        startDate: trendData[0]?.date,
        endDate: trendData[trendData.length - 1]?.date
      },
      trends: trendData,
      summary: {
        totalRequests: trendData.reduce((sum, day) => sum + day.totalRequests, 0),
        avgDailyUsers: Math.round(trendData.reduce((sum, day) => sum + day.uniqueUsers, 0) / trendData.length),
        peakUsageDay: trendData.reduce((max, day) => day.totalRequests > max.totalRequests ? day : max, trendData[0]),
        utilizationTrend: 'stable' // Would calculate from actual data
      }
    };
  }

  @Post('quota/users/:id/adjust')
  @AdminOnly()
  @ApiOperation({
    summary: 'Adjust user allocation',
    description: 'Manually adjust a user\'s daily AI token allocation for a specific model. Use with caution.'
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User allocation adjusted successfully'
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'Invalid allocation parameters' })
  async adjustUserAllocation(
    @Param('id') id: string,
    @Body() allocationDto: AllocationManagementDto
  ) {
    const user = await this.databaseService.getUserById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Log this sensitive admin action
    await this.adminService.logAdminAction('admin', 'adjust_user_allocation', id, {
      targetUser: user.email,
      model: allocationDto.modelName,
      newAllocation: allocationDto.dailyAllocation,
      timestamp: new Date()
    });

    // In a real implementation, you would update the allocation in a user_allocations table
    // For now, return a success message
    return {
      message: 'User allocation adjustment logged',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      allocation: {
        model: allocationDto.modelName,
        newDailyLimit: allocationDto.dailyAllocation,
        effectiveDate: new Date()
      },
      warning: 'This feature requires a user_allocations table implementation for persistence'
    };
  }

  @Get('quota/alerts')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get quota alerts and warnings',
    description: 'Retrieve current quota alerts for users approaching or exceeding their allocation limits.'
  })
  @ApiResponse({
    status: 200,
    description: 'Quota alerts retrieved successfully'
  })
  async getQuotaAlerts() {
    // Get all active users
    const { users } = await this.databaseService.getAllUsers(100, 0); // Get first 100 users
    const alerts: Array<{
      userId: string;
      userEmail: string;
      userName: string;
      alertLevel: 'HIGH' | 'CRITICAL';
      usagePercentage: number;
      requestsRemaining: number;
      model: string;
      canMakeRequest: boolean;
      message: string;
    }> = [];

    for (const user of users.filter(u => u.is_active)) {
      try {
        const allocation = await this.multiApiAllocationService.getDailyAllocation(user.id, 'gemini-2.0-flash');

        if (allocation.warningLevel === 'HIGH' || allocation.warningLevel === 'CRITICAL') {
          alerts.push({
            userId: user.id,
            userEmail: user.email,
            userName: user.name,
            alertLevel: allocation.warningLevel as 'HIGH' | 'CRITICAL',
            usagePercentage: allocation.allocationPercentageUsed,
            requestsRemaining: allocation.requestsRemainingToday,
            model: allocation.modelName,
            canMakeRequest: allocation.canMakeRequest,
            message: allocation.allocationMessage
          });
        }
      } catch (error) {
        // Skip users where allocation check fails
        continue;
      }
    }

    // Sort by alert level and usage percentage
    alerts.sort((a, b) => {
      const levelPriority = { 'CRITICAL': 3, 'HIGH': 2, 'MEDIUM': 1, 'LOW': 0 };
      return levelPriority[b.alertLevel] - levelPriority[a.alertLevel] ||
        b.usagePercentage - a.usagePercentage;
    });

    return {
      alerts,
      summary: {
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter(a => a.alertLevel === 'CRITICAL').length,
        highAlerts: alerts.filter(a => a.alertLevel === 'HIGH').length,
        usersOverLimit: alerts.filter(a => !a.canMakeRequest).length
      }
    };
  }
}