import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  UseGuards, 
  Req, 
  Headers,
  HttpStatus,
  BadRequestException,
  Logger,
  HttpCode
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { 
  SubscribeDto, 
  VerifyPaymentDto,
  SubscriptionResponseDto,
  PaymentInitializeResponseDto,
  MessageQuotaResponseDto,
  SubscriptionTierDto,
  PaymentTransactionDto,
  PaymentWebhookDto
} from './dto/subscription.dto';
import type { Request } from 'express';
import type { User } from '../database/database.service';

interface AuthenticatedRequest extends Request {
  user: User;
}

@ApiTags('Subscription')
@Controller('subscription')
export class SubscriptionController {
  private readonly logger = new Logger(SubscriptionController.name);

  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('tiers')
  @ApiOperation({
    summary: 'Get available subscription tiers',
    description: 'Retrieve all available subscription tiers with pricing and limits'
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription tiers retrieved successfully',
    type: [SubscriptionTierDto]
  })
  async getAvailableTiers(): Promise<SubscriptionTierDto[]> {
    return await this.subscriptionService.getAvailableTiers();
  }

  @Get('current')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user subscription',
    description: 'Get the current user\'s active subscription details'
  })
  @ApiResponse({
    status: 200,
    description: 'Current subscription retrieved successfully',
    type: SubscriptionResponseDto
  })
  async getCurrentSubscription(@Req() req: AuthenticatedRequest): Promise<SubscriptionResponseDto | null> {
    const subscription = await this.subscriptionService.getUserSubscription(req.user.id);
    
    if (!subscription || !subscription.tier) {
      return null;
    }

    return {
      id: subscription.id,
      user_id: subscription.user_id,
      tier_name: subscription.tier.name,
      tier_display_name: subscription.tier.display_name,
      price_ngn: subscription.tier.price_ngn,
      daily_message_limit: subscription.tier.daily_message_limit,
      status: subscription.status,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      paystack_subscription_code: subscription.paystack_subscription_code
    };
  }

  @Get('quota')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current message quota status',
    description: 'Check how many messages the user has sent today and remaining quota'
  })
  @ApiResponse({
    status: 200,
    description: 'Message quota status retrieved successfully',
    type: MessageQuotaResponseDto
  })
  async getMessageQuota(@Req() req: AuthenticatedRequest): Promise<MessageQuotaResponseDto> {
    const quotaStatus = await this.subscriptionService.getMessageQuota(req.user.id);
    const subscription = await this.subscriptionService.getUserSubscription(req.user.id);
    
    return {
      can_send_message: quotaStatus.can_send_message,
      messages_used: quotaStatus.messages_used,
      daily_limit: quotaStatus.daily_limit,
      messages_remaining: quotaStatus.messages_remaining,
      tier_name: subscription?.tier?.name || 'free',
      tier_display_name: subscription?.tier?.display_name || 'Free'
    };
  }

  @Post('subscribe')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Subscribe to a tier',
    description: 'Initialize payment for Pro subscription or activate Free subscription'
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription initiated successfully',
    type: PaymentInitializeResponseDto
  })
  @ApiResponse({
    status: 201,
    description: 'Free subscription activated successfully',
    type: SubscriptionResponseDto
  })
  async subscribe(
    @Body() subscribeDto: SubscribeDto,
    @Req() req: AuthenticatedRequest
  ): Promise<PaymentInitializeResponseDto | SubscriptionResponseDto> {
    if (subscribeDto.tier_name === 'free') {
      // Activate free subscription directly
      const tiers = await this.subscriptionService.getAvailableTiers();
      const freeTier = tiers.find(tier => tier.name === 'free');
      
      if (!freeTier) {
        throw new BadRequestException('Free tier not found');
      }

      const subscription = await this.subscriptionService.activateSubscription(
        req.user.id,
        freeTier.id
      );

      return {
        id: subscription.id,
        user_id: subscription.user_id,
        tier_name: freeTier.name,
        tier_display_name: freeTier.display_name,
        price_ngn: freeTier.price_ngn,
        daily_message_limit: freeTier.daily_message_limit,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        paystack_subscription_code: subscription.paystack_subscription_code
      };
    }

    // Initialize payment for paid tier
    const paymentResponse = await this.subscriptionService.initializePayment(
      req.user.id,
      subscribeDto.tier_name,
      subscribeDto.callback_url
    );

    return {
      authorization_url: paymentResponse.data.authorization_url,
      reference: paymentResponse.data.reference,
      access_code: paymentResponse.data.access_code
    };
  }

  @Post('verify')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify payment',
    description: 'Verify payment completion and activate subscription'
  })
  @ApiResponse({
    status: 200,
    description: 'Payment verified and subscription activated successfully',
    type: SubscriptionResponseDto
  })
  async verifyPayment(
    @Body() verifyDto: VerifyPaymentDto,
    @Req() req: AuthenticatedRequest
  ): Promise<{ success: boolean; subscription?: SubscriptionResponseDto }> {
    const result = await this.subscriptionService.verifyPayment(verifyDto.reference);
    
    if (!result.success || !result.subscription) {
      return { success: false };
    }

    const subscription = result.subscription;
    
    return {
      success: true,
      subscription: {
        id: subscription.id,
        user_id: subscription.user_id,
        tier_name: subscription.tier?.name || '',
        tier_display_name: subscription.tier?.display_name || '',
        price_ngn: subscription.tier?.price_ngn || 0,
        daily_message_limit: subscription.tier?.daily_message_limit || 0,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        paystack_subscription_code: subscription.paystack_subscription_code
      }
    };
  }

  @Post('cancel')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancel subscription',
    description: 'Cancel current subscription and revert to free tier'
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription canceled successfully'
  })
  async cancelSubscription(@Req() req: AuthenticatedRequest): Promise<{ message: string }> {
    await this.subscriptionService.cancelSubscription(req.user.id);
    return { message: 'Subscription canceled successfully' };
  }

  @Get('payments')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get payment history',
    description: 'Retrieve user\'s payment transaction history'
  })
  @ApiResponse({
    status: 200,
    description: 'Payment history retrieved successfully',
    type: [PaymentTransactionDto]
  })
  async getPaymentHistory(@Req() req: AuthenticatedRequest): Promise<PaymentTransactionDto[]> {
    const transactions = await this.subscriptionService.getPaymentHistory(req.user.id);
    
    return transactions.map(transaction => ({
      id: transaction.id,
      amount_ngn: transaction.amount_ngn,
      transaction_type: transaction.transaction_type,
      status: transaction.status,
      paystack_reference: transaction.paystack_reference,
      created_at: transaction.created_at
    }));
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Paystack webhook',
    description: 'Handle Paystack webhook events'
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully'
  })
  async handleWebhook(
    @Body() webhookData: PaymentWebhookDto,
    @Headers('x-paystack-signature') signature: string
  ): Promise<{ status: string }> {
    try {
      // Verify webhook signature
      const payload = JSON.stringify(webhookData);
      
      if (!this.subscriptionService.verifyWebhookSignature(payload, signature)) {
        this.logger.warn('Invalid webhook signature');
        throw new BadRequestException('Invalid signature');
      }

      // Handle the webhook event
      await this.subscriptionService.handleWebhook(webhookData.event, webhookData.data);

      return { status: 'success' };
    } catch (error) {
      this.logger.error('Webhook processing failed:', error);
      throw new BadRequestException('Webhook processing failed');
    }
  }
}