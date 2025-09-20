import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MultiApiAllocationService } from '../services/multi-api-allocation.service';
import { GeminiKeyPoolService } from '../services/gemini-key-pool.service';

@Controller('allocation')
@UseGuards(AuthGuard('jwt'))
export class AllocationController {
  private readonly logger = new Logger(AllocationController.name);

  constructor(
    private readonly allocationService: MultiApiAllocationService,
    private readonly keyPoolService: GeminiKeyPoolService,
  ) {}

  /**
   * Get user's daily allocation status
   * GET /allocation/daily?model=gemini-2.5
   */
  @Get('daily')
  async getDailyAllocation(
    @Request() req: any,
    @Query('model') model: string = 'gemini-2.5',
  ) {
    try {
      const userId = req.user?.id || req.user?.sub;
      
      if (!userId) {
        throw new HttpException('User ID not found in token', HttpStatus.UNAUTHORIZED);
      }

      const allocation = await this.allocationService.getDailyAllocation(userId, model);
      
      this.logger.debug(`Daily allocation for user ${userId}: ${allocation.requestsRemainingToday}/${allocation.allocatedRequestsToday}`);
      
      return allocation;
    } catch (error) {
      this.logger.error('Failed to get daily allocation:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Failed to retrieve allocation information',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Check if user can make a request
   * GET /allocation/can-request?model=gemini-2.5
   */
  @Get('can-request')
  async canUserMakeRequest(
    @Request() req: any,
    @Query('model') model: string = 'gemini-2.5',
  ) {
    try {
      const userId = req.user?.id || req.user?.sub;
      
      if (!userId) {
        throw new HttpException('User ID not found in token', HttpStatus.UNAUTHORIZED);
      }

      const allocationCheck = await this.allocationService.canUserMakeRequest(userId, model);
      
      this.logger.debug(`Can user ${userId} make request: ${allocationCheck.allowed}`);
      
      return allocationCheck;
    } catch (error) {
      this.logger.error('Failed to check user allocation:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Failed to check allocation status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get system overview (all models)
   * GET /allocation/system-overview
   */
  @Get('system-overview')
  async getSystemOverview() {
    try {
      const systemOverview = await this.allocationService.getSystemOverview();
      
      this.logger.debug(`System overview: ${systemOverview.length} models`);
      
      return systemOverview;
    } catch (error) {
      this.logger.error('Failed to get system overview:', error);
      throw new HttpException(
        'Failed to retrieve system overview',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get key pool statistics (admin endpoint)
   * GET /allocation/key-pool/stats
   */
  @Get('key-pool/stats')
  async getKeyPoolStats() {
    try {
      const stats = this.keyPoolService.getKeyPoolStats();
      
      this.logger.debug(`Key pool stats: ${stats.systemStats.availableKeys}/${stats.systemStats.totalKeys} keys available`);
      
      return stats;
    } catch (error) {
      this.logger.error('Failed to get key pool stats:', error);
      throw new HttpException(
        'Failed to retrieve key pool statistics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get system stats only (lighter endpoint)
   * GET /allocation/key-pool/system
   */
  @Get('key-pool/system')
  async getSystemStats() {
    try {
      const stats = this.keyPoolService.getKeyPoolStats();
      
      return stats.systemStats;
    } catch (error) {
      this.logger.error('Failed to get system stats:', error);
      throw new HttpException(
        'Failed to retrieve system statistics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Check if API keys are available
   * GET /allocation/key-pool/available
   */
  @Get('key-pool/available')
  async checkKeysAvailable() {
    try {
      const hasAvailableKeys = this.keyPoolService.hasAvailableKeys();
      
      return {
        available: hasAvailableKeys,
        message: hasAvailableKeys 
          ? 'API keys are available' 
          : 'All API keys are currently rate limited or exhausted',
      };
    } catch (error) {
      this.logger.error('Failed to check key availability:', error);
      throw new HttpException(
        'Failed to check key availability',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}