export interface SubscriptionTier {
  id: string;
  name: string;
  display_name: string;
  price_ngn: number;
  daily_message_limit: number;
  description?: string;
  is_active: boolean;
  paystack_plan_code?: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  tier_id: string;
  status: 'active' | 'canceled' | 'expired' | 'payment_failed' | 'past_due';
  current_period_start: Date;
  current_period_end: Date;
  paystack_subscription_code?: string;
  paystack_customer_code?: string;
  paystack_authorization_code?: string;
  auto_renew?: boolean;
  failed_payment_count?: number;
  last_payment_attempt?: Date;
  grace_period_end?: Date;
  created_at: Date;
  updated_at: Date;
  tier?: SubscriptionTier;
}

export interface DailyMessageUsage {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  message_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentTransaction {
  id: string;
  user_id: string;
  subscription_id?: string;
  amount_ngn: number;
  transaction_type: 'subscription' | 'renewal' | 'upgrade';
  paystack_reference: string;
  paystack_transaction_id?: string;
  paystack_status?: string;
  paystack_gateway_response?: string;
  paystack_plan_code?: string;
  subscription_cycle?: number;
  status: 'pending' | 'success' | 'failed' | 'abandoned';
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface MessageQuotaStatus {
  can_send_message: boolean;
  messages_used: number;
  daily_limit: number;
  messages_remaining: number;
}

export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    amount: number;
    message: string;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    ip_address: string;
    metadata: Record<string, any>;
    log: Record<string, any>;
    fees: number;
    fees_split: any;
    authorization: {
      authorization_code: string;
      bin: string;
      last4: string;
      exp_month: string;
      exp_year: string;
      channel: string;
      card_type: string;
      bank: string;
      country_code: string;
      brand: string;
      reusable: boolean;
      signature: string;
      account_name: string;
    };
    customer: {
      id: number;
      first_name: string;
      last_name: string;
      email: string;
      customer_code: string;
      phone: string;
      metadata: Record<string, any>;
      risk_action: string;
      international_format_phone: string;
    };
    plan: Record<string, any>;
    split: Record<string, any>;
    order_id: string;
    paidAt: string;
    createdAt: string;
    requested_amount: number;
    pos_transaction_data: any;
    source: Record<string, any>;
    fees_breakdown: any;
  };
}

export const TIER_NAMES = {
  FREE: 'free',
  PRO: 'pro'
} as const;

export type TierName = typeof TIER_NAMES[keyof typeof TIER_NAMES];