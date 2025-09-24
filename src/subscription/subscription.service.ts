import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { 
  SubscriptionTier, 
  UserSubscription, 
  PaymentTransaction, 
  MessageQuotaStatus,
  PaystackInitializeResponse,
  PaystackVerifyResponse,
  TIER_NAMES
} from './subscription.types';
import * as crypto from 'crypto';

const paystack = require('paystack');

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly paystackClient: any;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    const secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY');
    if (!secretKey) {
      throw new Error('PAYSTACK_SECRET_KEY environment variable is required');
    }
    this.paystackClient = paystack(secretKey);
  }

  /**
   * Get all available subscription tiers
   */
  async getAvailableTiers(): Promise<SubscriptionTier[]> {
    const supabase = this.databaseService.getSupabaseClient();
    
    const { data, error } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('is_active', true)
      .order('price_ngn', { ascending: true });

    if (error) {
      this.logger.error('Failed to get subscription tiers:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get user's current subscription
   */
  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    const supabase = this.databaseService.getSupabaseClient();
    
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        tier:subscription_tiers(*)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error('Failed to get user subscription:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get user's current message quota status
   */
  async getMessageQuota(userId: string): Promise<MessageQuotaStatus> {
    const supabase = this.databaseService.getSupabaseClient();
    
    // Use the PostgreSQL function we created
    const { data, error } = await supabase.rpc('check_daily_message_quota', {
      user_uuid: userId
    });

    if (error) {
      this.logger.error('Failed to check message quota:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      // Default to free tier limits if no data found
      return {
        can_send_message: true,
        messages_used: 0,
        daily_limit: 20,
        messages_remaining: 20
      };
    }

    return data[0];
  }


  /**
   * Increment user's daily message count
   */
  async incrementMessageCount(userId: string): Promise<void> {
    const supabase = this.databaseService.getSupabaseClient();
    
    const { error } = await supabase.rpc('increment_daily_message_count', {
      user_uuid: userId
    });

    if (error) {
      this.logger.error('Failed to increment message count:', error);
      throw error;
    }
  }

  /**
   * Create or get Paystack subscription plan
   */
  async createOrGetPaystackPlan(tier: SubscriptionTier): Promise<string> {
    // Check if plan already exists in our database
    if (tier.paystack_plan_code) {
      return tier.paystack_plan_code;
    }

    // Create plan in Paystack
    const planData = {
      name: `${tier.display_name} Monthly`,
      amount: tier.price_ngn * 100, // Convert to kobo
      interval: 'monthly',
      description: tier.description || `${tier.display_name} tier subscription`,
      send_invoices: true,
      send_sms: false,
      currency: 'NGN'
    };

    const result = await this.paystackClient.plan.create(planData);

    if (!result.status) {
      throw new BadRequestException('Failed to create subscription plan in Paystack');
    }

    // Save plan code to our database
    const supabase = this.databaseService.getSupabaseClient();
    await supabase
      .from('subscription_tiers')
      .update({ paystack_plan_code: result.data.plan_code })
      .eq('id', tier.id);

    return result.data.plan_code;
  }

  /**
   * Initialize payment for Pro subscription (now with recurring billing)
   */
  async initializePayment(
    userId: string,
    tierName: string,
    callbackUrl?: string
  ): Promise<PaystackInitializeResponse> {
    // Get user info
    const user = await this.databaseService.getUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get tier info
    const tier = await this.getTierByName(tierName);
    if (!tier) {
      throw new BadRequestException('Invalid subscription tier');
    }

    if (tier.name === TIER_NAMES.FREE) {
      throw new BadRequestException('Free tier does not require payment');
    }

    // Check if user already has an active subscription to this tier
    const currentSubscription = await this.getUserSubscription(userId);
    if (currentSubscription && currentSubscription.tier?.name === tierName && currentSubscription.status === 'active') {
      throw new BadRequestException('User already has an active subscription to this tier');
    }

    // Create or get Paystack subscription plan
    const planCode = await this.createOrGetPaystackPlan(tier);

    // Generate unique reference
    const reference = `sub_${userId}_${Date.now()}`;

    // Create customer on Paystack if not exists
    let customer;
    try {
      customer = await this.paystackClient.customer.create({
        email: user.email,
        first_name: user.name.split(' ')[0] || 'User',
        last_name: user.name.split(' ').slice(1).join(' ') || '',
        phone: '', // Optional
        metadata: {
          user_id: userId,
          tier_name: tierName
        }
      });
    } catch (error) {
      // Customer might already exist
      const customers = await this.paystackClient.customer.list({
        email: user.email
      });
      
      if (customers.status && customers.data.length > 0) {
        customer = { data: customers.data[0] };
      } else {
        throw error;
      }
    }

    // Initialize subscription payment (first payment)
    const paymentData = {
      amount: tier.price_ngn * 100, // Paystack expects amount in kobo
      email: user.email,
      reference,
      plan: planCode, // This makes it a subscription payment
      callback_url: callbackUrl || `${this.configService.get('FRONTEND_URL')}/subscription/verify`,
      metadata: {
        user_id: userId,
        tier_name: tierName,
        tier_id: tier.id,
        customer_code: customer.data.customer_code,
        plan_code: planCode,
        subscription_type: 'recurring'
      }
    };

    const result = await this.paystackClient.transaction.initialize(paymentData);

    if (!result.status) {
      throw new BadRequestException('Failed to initialize subscription payment');
    }

    // Save transaction record
    await this.createPaymentTransaction({
      user_id: userId,
      amount_ngn: tier.price_ngn,
      transaction_type: 'subscription',
      paystack_reference: reference,
      status: 'pending',
      paystack_plan_code: planCode,
      subscription_cycle: 1,
      metadata: {
        tier_name: tierName,
        tier_id: tier.id,
        customer_code: customer.data.customer_code,
        plan_code: planCode,
        subscription_type: 'recurring'
      }
    });

    return result;
  }

  /**
   * Verify payment and activate subscription (now handles recurring subscriptions)
   */
  async verifyPayment(reference: string): Promise<{ success: boolean; subscription?: UserSubscription }> {
    // Verify with Paystack
    const verification = await this.paystackClient.transaction.verify(reference);
    
    if (!verification.status) {
      throw new BadRequestException('Payment verification failed');
    }

    const paymentData = verification.data;

    // Update transaction record
    await this.updatePaymentTransaction(reference, {
      paystack_transaction_id: paymentData.id.toString(),
      paystack_status: paymentData.status,
      paystack_gateway_response: paymentData.gateway_response,
      status: paymentData.status === 'success' ? 'success' : 'failed'
    });

    if (paymentData.status !== 'success') {
      return { success: false };
    }

    // Get transaction metadata
    const userId = paymentData.metadata.user_id;
    const tierName = paymentData.metadata.tier_name;
    const tierIdFromMetadata = paymentData.metadata.tier_id;
    const planCode = paymentData.metadata.plan_code;

    if (!userId || !tierName) {
      throw new BadRequestException('Invalid payment metadata');
    }

    // For subscription payments, get the subscription details from Paystack
    let paystackSubscriptionCode = null;
    let authorizationCode = null;

    if (paymentData.plan && planCode) {
      // This was a subscription payment, get the subscription details
      try {
        // Get the authorization code for future charges
        if (paymentData.authorization && paymentData.authorization.authorization_code) {
          authorizationCode = paymentData.authorization.authorization_code;
        }

        // List subscriptions for the customer to find the one we just created
        const subscriptions = await this.paystackClient.subscription.list({
          customer: paymentData.customer.customer_code,
          plan: planCode
        });

        if (subscriptions.status && subscriptions.data.length > 0) {
          // Find the most recent subscription for this plan
          const latestSubscription = subscriptions.data
            .filter((sub: any) => sub.plan.plan_code === planCode)
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
          
          if (latestSubscription) {
            paystackSubscriptionCode = latestSubscription.subscription_code;
          }
        }
      } catch (error) {
        this.logger.warn('Could not fetch subscription details from Paystack:', error);
        // Continue without subscription code - we can still activate the subscription
      }
    }

    // Create or update subscription
    const subscription = await this.activateSubscription(
      userId,
      tierIdFromMetadata,
      paymentData.customer.customer_code,
      reference,
      paystackSubscriptionCode || undefined,
      authorizationCode || undefined,
      planCode || undefined
    );

    return { success: true, subscription };
  }

  /**
   * Activate subscription for a user (updated for recurring subscriptions)
   */
  async activateSubscription(
    userId: string,
    tierId: string,
    customerCode?: string,
    paystackReference?: string,
    paystackSubscriptionCode?: string,
    authorizationCode?: string,
    planCode?: string
  ): Promise<UserSubscription> {
    const supabase = this.databaseService.getSupabaseClient();

    // Handle existing subscription by updating instead of creating new
    const { data: existingSubscription } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existingSubscription) {
      // Update existing subscription
      const { data: updatedSubscription, error } = await supabase
        .from('user_subscriptions')
        .update({
          tier_id: tierId,
          status: 'active',
          current_period_start: new Date(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          paystack_customer_code: customerCode,
          paystack_subscription_code: paystackSubscriptionCode,
          paystack_authorization_code: authorizationCode,
          auto_renew: true,
          failed_payment_count: 0,
          grace_period_end: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSubscription.id)
        .select(`
          *,
          tier:subscription_tiers(*)
        `)
        .single();

      if (error) {
        this.logger.error('Failed to update subscription:', error);
        throw error;
      }

      // Log subscription update event
      await supabase.from('subscription_events').insert({
        subscription_id: updatedSubscription.id,
        event_type: 'updated',
        event_data: {
          tier_id: tierId,
          plan_code: planCode,
          paystack_subscription_code: paystackSubscriptionCode,
          payment_reference: paystackReference
        }
      });

      // Update user's subscription_tier_id
      await this.databaseService.updateUser(userId, { subscription_tier_id: tierId });

      // Update payment transaction with subscription ID if reference provided
      if (paystackReference) {
        await this.updatePaymentTransaction(paystackReference, {
          subscription_id: updatedSubscription.id
        });
      }

      this.logger.log(`Subscription updated for user ${userId} with Paystack subscription: ${paystackSubscriptionCode}`);
      return updatedSubscription;
    }


    // Create new subscription with recurring billing support
    const subscriptionData = {
      user_id: userId,
      tier_id: tierId,
      status: 'active',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      paystack_customer_code: customerCode,
      paystack_subscription_code: paystackSubscriptionCode,
      paystack_authorization_code: authorizationCode,
      auto_renew: true,
      failed_payment_count: 0,
    };

    const { data, error } = await supabase
      .from('user_subscriptions')
      .insert(subscriptionData)
      .select(`
        *,
        tier:subscription_tiers(*)
      `)
      .single();

    if (error) {
      this.logger.error('Failed to create subscription:', error);
      throw error;
    }

    // Update user's subscription_tier_id
    await this.databaseService.updateUser(userId, { subscription_tier_id: tierId });

    // Update payment transaction with subscription ID
    if (paystackReference) {
      await this.updatePaymentTransaction(paystackReference, {
        subscription_id: data.id
      });
    }

    // Log subscription creation event
    await supabase.from('subscription_events').insert({
      subscription_id: data.id,
      event_type: 'created',
      event_data: {
        tier_id: tierId,
        plan_code: planCode,
        paystack_subscription_code: paystackSubscriptionCode,
        initial_payment_reference: paystackReference
      }
    });

    this.logger.log(`Recurring subscription activated for user ${userId} with Paystack subscription: ${paystackSubscriptionCode}`);
    return data;
  }

  /**
   * Cancel user subscription
   */
  async cancelSubscription(userId: string): Promise<void> {
    const supabase = this.databaseService.getSupabaseClient();

    const { error } = await supabase
      .from('user_subscriptions')
      .update({ 
        status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      this.logger.error('Failed to cancel subscription:', error);
      throw error;
    }

    // Set user back to free tier
    const freeTier = await this.getTierByName(TIER_NAMES.FREE);
    if (freeTier) {
      await this.databaseService.updateUser(userId, { subscription_tier_id: freeTier.id });
      
      // Create free subscription
      await this.activateSubscription(userId, freeTier.id);
    }

    this.logger.log(`Subscription canceled for user ${userId}`);
  }

  /**
   * Get tier by name
   */
  private async getTierByName(name: string): Promise<SubscriptionTier | null> {
    const supabase = this.databaseService.getSupabaseClient();
    
    const { data, error } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('name', name)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error('Failed to get tier by name:', error);
      throw error;
    }

    return data;
  }

  /**
   * Create payment transaction record
   */
  private async createPaymentTransaction(transactionData: Partial<PaymentTransaction>): Promise<PaymentTransaction> {
    const supabase = this.databaseService.getSupabaseClient();
    
    const { data, error } = await supabase
      .from('payment_transactions')
      .insert(transactionData)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create payment transaction:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update payment transaction record
   */
  private async updatePaymentTransaction(reference: string, updates: Partial<PaymentTransaction>): Promise<void> {
    const supabase = this.databaseService.getSupabaseClient();
    
    const { error } = await supabase
      .from('payment_transactions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('paystack_reference', reference);

    if (error) {
      this.logger.error('Failed to update payment transaction:', error);
      throw error;
    }
  }

  /**
   * Get user's payment history
   */
  async getPaymentHistory(userId: string, limit: number = 10): Promise<PaymentTransaction[]> {
    const supabase = this.databaseService.getSupabaseClient();
    
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error('Failed to get payment history:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Verify webhook signature from Paystack
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const hash = crypto
      .createHmac('sha512', this.configService.get<string>('PAYSTACK_WEBHOOK_SECRET') || '')
      .update(payload)
      .digest('hex');

    return hash === signature;
  }

  /**
   * Handle Paystack webhook events (updated for recurring subscriptions)
   */
  async handleWebhook(event: string, data: any): Promise<void> {
    this.logger.log(`Received webhook event: ${event}`, { subscription_code: data.subscription_code, customer: data.customer?.customer_code });

    switch (event) {
      case 'charge.success':
        await this.handleChargeSuccess(data);
        break;
      case 'subscription.create':
        await this.handleSubscriptionCreated(data);
        break;
      case 'subscription.not_renew':
        await this.handleSubscriptionNotRenew(data);
        break;
      case 'subscription.disable':
        await this.handleSubscriptionDisabled(data);
        break;
      case 'invoice.create':
        await this.handleInvoiceCreated(data);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(data);
        break;
      case 'invoice.update':
        await this.handleInvoiceUpdated(data);
        break;
      default:
        this.logger.log(`Unhandled webhook event: ${event}`, data);
    }
  }

  private async handleChargeSuccess(data: any): Promise<void> {
    const reference = data.reference;
    const subscriptionCode = data.subscription?.subscription_code;
    
    if (reference && !subscriptionCode) {
      // This is a one-time payment, verify normally
      await this.verifyPayment(reference);
    } else if (subscriptionCode) {
      // This is a subscription renewal payment
      await this.handleSubscriptionRenewal(data);
    }
  }

  private async handleSubscriptionCreated(data: any): Promise<void> {
    this.logger.log('Subscription created via webhook:', {
      subscription_code: data.subscription_code,
      customer: data.customer?.customer_code,
      plan: data.plan?.plan_code
    });
    
    // Log the subscription creation event
    const supabase = this.databaseService.getSupabaseClient();
    
    // Find the subscription in our database
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('paystack_subscription_code', data.subscription_code)
      .single();

    if (subscription) {
      await supabase.from('subscription_events').insert({
        subscription_id: subscription.id,
        event_type: 'created',
        event_data: data,
        paystack_event_id: data.subscription_code
      });
    }
  }

  private async handleSubscriptionRenewal(data: any): Promise<void> {
    const subscriptionCode = data.subscription?.subscription_code;
    
    if (!subscriptionCode) {
      this.logger.warn('Subscription renewal event missing subscription code');
      return;
    }

    const supabase = this.databaseService.getSupabaseClient();
    
    // Find the subscription in our database
    const { data: subscription, error } = await supabase
      .from('user_subscriptions')
      .select('id, user_id, current_period_end')
      .eq('paystack_subscription_code', subscriptionCode)
      .single();

    if (error || !subscription) {
      this.logger.warn(`Subscription not found for renewal: ${subscriptionCode}`);
      return;
    }

    // Calculate new billing period
    const newPeriodStart = new Date();
    const newPeriodEnd = new Date(newPeriodStart.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Renew the subscription using the PostgreSQL function
    await supabase.rpc('renew_subscription', {
      subscription_uuid: subscription.id,
      new_period_start: newPeriodStart.toISOString(),
      new_period_end: newPeriodEnd.toISOString()
    });

    // Record the payment transaction
    const nextCycle = await this.getNextSubscriptionCycle(subscription.id);
    await this.createPaymentTransaction({
      user_id: subscription.user_id,
      subscription_id: subscription.id,
      amount_ngn: data.amount / 100, // Convert from kobo
      transaction_type: 'renewal',
      paystack_reference: data.reference,
      paystack_transaction_id: data.id?.toString(),
      status: 'success',
      subscription_cycle: nextCycle,
      metadata: {
        subscription_code: subscriptionCode,
        renewal: true
      }
    });

    this.logger.log(`Subscription renewed for user ${subscription.user_id}: ${subscriptionCode}`);
  }

  private async getNextSubscriptionCycle(subscriptionId: string): Promise<number> {
    const supabase = this.databaseService.getSupabaseClient();
    
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('subscription_cycle')
      .eq('subscription_id', subscriptionId)
      .order('subscription_cycle', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return 1; // First cycle
    }

    return (data.subscription_cycle || 0) + 1;
  }

  private async handlePaymentFailed(data: any): Promise<void> {
    const subscriptionCode = data.subscription?.subscription_code;
    
    if (!subscriptionCode) {
      this.logger.warn('Payment failed event missing subscription code');
      return;
    }

    const supabase = this.databaseService.getSupabaseClient();
    
    // Find the subscription in our database
    const { data: subscription, error } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('paystack_subscription_code', subscriptionCode)
      .single();

    if (error || !subscription) {
      this.logger.warn(`Subscription not found for failed payment: ${subscriptionCode}`);
      return;
    }

    // Handle failed payment using PostgreSQL function (3-day grace period)
    await supabase.rpc('handle_failed_payment', {
      subscription_uuid: subscription.id,
      grace_period_days: 3
    });

    this.logger.log(`Payment failed for subscription: ${subscriptionCode}. Grace period activated.`);
  }

  private async handleSubscriptionNotRenew(data: any): Promise<void> {
    this.logger.log('Subscription will not renew:', data.subscription_code);
    // This means the subscription will not auto-renew (user or system canceled)
    // We can update the auto_renew flag in our database
    
    const supabase = this.databaseService.getSupabaseClient();
    
    await supabase
      .from('user_subscriptions')
      .update({ auto_renew: false, updated_at: new Date().toISOString() })
      .eq('paystack_subscription_code', data.subscription_code);
  }

  private async handleSubscriptionDisabled(data: any): Promise<void> {
    const subscriptionCode = data.subscription_code;
    
    this.logger.log('Subscription disabled:', subscriptionCode);
    
    const supabase = this.databaseService.getSupabaseClient();
    
    // Find and update the subscription
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('id, user_id')
      .eq('paystack_subscription_code', subscriptionCode)
      .single();

    if (subscription) {
      // Update subscription status
      await supabase
        .from('user_subscriptions')
        .update({ 
          status: 'canceled',
          auto_renew: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id);

      // Revert user to free tier
      const freeTier = await this.getTierByName(TIER_NAMES.FREE);
      if (freeTier) {
        await this.databaseService.updateUser(subscription.user_id, { 
          subscription_tier_id: freeTier.id 
        });
      }

      // Log cancellation event
      await supabase.from('subscription_events').insert({
        subscription_id: subscription.id,
        event_type: 'canceled',
        event_data: data,
        paystack_event_id: subscriptionCode
      });
    }
  }

  private async handleInvoiceCreated(data: any): Promise<void> {
    this.logger.log('Invoice created:', data.invoice_code);
    // Log invoice creation - can be used for tracking billing cycles
  }

  private async handleInvoiceUpdated(data: any): Promise<void> {
    this.logger.log('Invoice updated:', data.invoice_code, data.status);
    // Handle invoice status updates if needed
  }
}