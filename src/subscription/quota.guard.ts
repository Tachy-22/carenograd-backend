import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import type { User } from '../database/database.service';

interface AuthenticatedRequest extends Request {
  user: User;
}

@Injectable()
export class QuotaGuard implements CanActivate {
  private readonly logger = new Logger(QuotaGuard.name);

  constructor(private readonly subscriptionService: SubscriptionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      this.logger.warn('QuotaGuard: No user found in request');
      return false;
    }

    try {
      this.logger.log(`QuotaGuard: Checking quota for user ${user.id}`);
      
      // Use the NEW tier-based quota system (not the old token-based system)
      const quotaStatus = await this.subscriptionService.getMessageQuota(user.id);
      
      if (!quotaStatus.can_send_message) {
        const subscription = await this.subscriptionService.getUserSubscription(user.id);
        const tierName = subscription?.tier?.display_name || 'Free';
        
        this.logger.warn(`QuotaGuard: Daily message limit exceeded for user ${user.id} (${quotaStatus.messages_used}/${quotaStatus.daily_limit})`);
        
        throw new ForbiddenException({
          message: `Daily message limit reached (${quotaStatus.daily_limit} messages/day for ${tierName} tier)`,
          error: 'QUOTA_EXCEEDED',
          quotaStatus: {
            messages_used: quotaStatus.messages_used,
            daily_limit: quotaStatus.daily_limit,
            messages_remaining: quotaStatus.messages_remaining,
            tier_name: subscription?.tier?.name || 'free'
          },
          upgradeRequired: subscription?.tier?.name === 'free'
        });
      }

      // Increment the message count BEFORE allowing the request
      // This ensures the quota is enforced immediately
      await this.subscriptionService.incrementMessageCount(user.id);
      
      // Get updated quota status after increment
      const updatedQuotaStatus = await this.subscriptionService.getMessageQuota(user.id);
      
      // Attach quota status to request for use in controllers
      (request as any).quotaStatus = updatedQuotaStatus;

      this.logger.log(`QuotaGuard: Quota check passed for user ${user.id} (${updatedQuotaStatus.messages_used}/${updatedQuotaStatus.daily_limit})`);
      return true;
      
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      
      this.logger.error('QuotaGuard: Error checking quota:', error);
      // In case of error with the new system, allow request to proceed to avoid breaking the app
      // But log the error for monitoring
      return true;
    }
  }
}