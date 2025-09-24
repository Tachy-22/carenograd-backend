import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class SubscribeDto {
  @ApiProperty({ description: 'Subscription tier name', enum: ['free', 'pro'] })
  @IsEnum(['free', 'pro'])
  @IsNotEmpty()
  tier_name: 'free' | 'pro';

  @ApiPropertyOptional({ description: 'Callback URL after payment' })
  @IsOptional()
  @IsString()
  callback_url?: string;
}

export class VerifyPaymentDto {
  @ApiProperty({ description: 'Paystack payment reference' })
  @IsString()
  @IsNotEmpty()
  reference: string;
}

export class SubscriptionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  user_id: string;

  @ApiProperty()
  tier_name: string;

  @ApiProperty()
  tier_display_name: string;

  @ApiProperty()
  price_ngn: number;

  @ApiProperty()
  daily_message_limit: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  current_period_start: Date;

  @ApiProperty()
  current_period_end: Date;

  @ApiPropertyOptional()
  paystack_subscription_code?: string;
}

export class PaymentInitializeResponseDto {
  @ApiProperty()
  authorization_url: string;

  @ApiProperty()
  reference: string;

  @ApiProperty()
  access_code: string;
}

export class MessageQuotaResponseDto {
  @ApiProperty({ description: 'Whether user can send more messages today' })
  can_send_message: boolean;

  @ApiProperty({ description: 'Number of messages used today' })
  messages_used: number;

  @ApiProperty({ description: 'Daily message limit for user tier' })
  daily_limit: number;

  @ApiProperty({ description: 'Number of messages remaining today' })
  messages_remaining: number;

  @ApiProperty({ description: 'User subscription tier' })
  tier_name: string;

  @ApiProperty({ description: 'Tier display name' })
  tier_display_name: string;
}

export class SubscriptionTierDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  display_name: string;

  @ApiProperty()
  price_ngn: number;

  @ApiProperty()
  daily_message_limit: number;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  is_active: boolean;
}

export class PaymentTransactionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  amount_ngn: number;

  @ApiProperty()
  transaction_type: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  paystack_reference: string;

  @ApiProperty()
  created_at: Date;
}

export class PaymentWebhookDto {
  @ApiProperty()
  event: string;

  @ApiProperty()
  data: Record<string, any>;
}