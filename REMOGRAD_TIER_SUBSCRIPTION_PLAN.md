# Remograd Multi-Tier Subscription System Implementation Plan

## Executive Summary

This document outlines the comprehensive plan to transform Remograd from a shared-token system to an industry-standard multi-tier subscription service with Paystack integration, tier-based model access controls, and Nigerian Naira pricing.

## Current Architecture Assessment

### Strengths
- ✅ **Sophisticated token tracking system** already implemented
- ✅ **Multi-agent AI orchestration** providing enterprise-grade capabilities
- ✅ **Robust Google OAuth authentication** with JWT session management
- ✅ **Multi-user isolation** at database and application levels
- ✅ **Real-time streaming** with AI SDK v5 integration
- ✅ **Document processing** and RAG functionality
- ✅ **Scalable NestJS architecture** with proper service separation

### Gaps Requiring Implementation
- ❌ **No subscription management system**
- ❌ **No payment processing integration**
- ❌ **No tier-based access controls**
- ❌ **No billing and invoice system**
- ❌ **No administrative tools**
- ❌ **No pricing structure**

## 1. Subscription Tier Structure Design

### Free Tier (₦0/month)
```typescript
interface FreeTier {
  name: "Free"
  price: { monthly: 0, yearly: 0 }
  limits: {
    tokensPerMonth: 50_000
    requestsPerDay: 10
    conversationsLimit: 3
    documentsUpload: 2
    modelAccess: ["gemini-1.5-flash-8b"] // Lowest tier model only
    features: [
      "Basic AI assistance",
      "Limited document upload",
      "Community support"
    ]
  }
  restrictions: {
    noGoogleSheetsIntegration: true
    noAdvancedResearch: true
    noEmailDrafting: true
    noRealTimeStreaming: false // Keep for UX
  }
}
```

### Professional Tier (₦15,000/month, ₦150,000/year)
```typescript
interface ProfessionalTier {
  name: "Professional"
  price: { monthly: 15000, yearly: 150000 } // 17% yearly discount
  limits: {
    tokensPerMonth: 500_000
    requestsPerDay: 100
    conversationsLimit: 25
    documentsUpload: 20
    modelAccess: ["gemini-1.5-flash-8b", "gemini-1.5-flash", "gemini-2.0-flash"]
    features: [
      "Advanced AI assistance",
      "Google Sheets integration",
      "Email drafting",
      "Professor research",
      "Program matching",
      "Priority support"
    ]
  }
  restrictions: {
    noPremiumModels: true // No access to Pro models
  }
}
```

### Premium Tier (₦35,000/month, ₦350,000/year)
```typescript
interface PremiumTier {
  name: "Premium"
  price: { monthly: 35000, yearly: 350000 } // 17% yearly discount
  limits: {
    tokensPerMonth: 2_000_000
    requestsPerDay: 500
    conversationsLimit: 100
    documentsUpload: 100
    modelAccess: ["gemini-1.5-flash-8b", "gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-exp"]
    features: [
      "All Professional features",
      "Advanced model access",
      "Bulk document processing",
      "Advanced analytics",
      "Priority queue",
      "Dedicated support",
      "API access (future)"
    ]
  }
  restrictions: {} // No restrictions
}
```

## 2. Database Schema Extensions

### New Core Tables
```sql
-- Subscription Plans Master Data
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE, -- 'free', 'professional', 'premium'
  description TEXT,
  price_monthly_ngn DECIMAL(12,2) NOT NULL DEFAULT 0,
  price_yearly_ngn DECIMAL(12,2) NOT NULL DEFAULT 0,
  
  -- Usage Limits
  tokens_per_month INTEGER NOT NULL DEFAULT 50000,
  requests_per_day INTEGER NOT NULL DEFAULT 10,
  conversations_limit INTEGER NOT NULL DEFAULT 3,
  documents_upload_limit INTEGER NOT NULL DEFAULT 2,
  
  -- Model Access
  allowed_models JSONB NOT NULL DEFAULT '["gemini-1.5-flash-8b"]',
  
  -- Feature Flags
  features JSONB NOT NULL DEFAULT '{}', -- {"googleSheets": true, "emailDrafting": true}
  restrictions JSONB NOT NULL DEFAULT '{}', -- {"noAdvancedResearch": true}
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Subscriptions
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  
  -- Subscription State
  status VARCHAR(20) NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'canceled', 'expired', 'suspended', 'payment_failed')),
  
  -- Billing Periods
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  billing_cycle VARCHAR(10) NOT NULL DEFAULT 'monthly' 
    CHECK (billing_cycle IN ('monthly', 'yearly')),
  
  -- Payment Info
  amount_paid DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
  next_billing_date TIMESTAMP WITH TIME ZONE,
  
  -- Paystack Integration
  paystack_plan_code VARCHAR(100),
  paystack_subscription_code VARCHAR(100),
  paystack_customer_code VARCHAR(100),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id) -- One active subscription per user
);

-- Payment Transactions
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  subscription_id UUID REFERENCES user_subscriptions(id),
  
  -- Transaction Details
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
  transaction_type VARCHAR(20) NOT NULL 
    CHECK (transaction_type IN ('subscription', 'upgrade', 'renewal', 'refund')),
  
  -- Paystack Data
  paystack_reference VARCHAR(255) NOT NULL UNIQUE,
  paystack_transaction_id VARCHAR(255),
  paystack_status VARCHAR(50),
  paystack_gateway_response TEXT,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed', 'abandoned')),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage Tracking Extensions
ALTER TABLE users ADD COLUMN current_subscription_id UUID REFERENCES user_subscriptions(id);
ALTER TABLE users ADD COLUMN selected_model VARCHAR(50) DEFAULT 'gemini-1.5-flash-8b';
ALTER TABLE users ADD COLUMN subscription_tier VARCHAR(20) DEFAULT 'free';
```

### Enhanced Quota Tables
```sql
-- Extend existing quota tracking for tier-based limits
ALTER TABLE user_token_quotas 
ADD COLUMN subscription_tier VARCHAR(20) DEFAULT 'free',
ADD COLUMN tier_tokens_limit INTEGER DEFAULT 50000,
ADD COLUMN tier_requests_limit INTEGER DEFAULT 10;

-- Monthly usage summaries for billing
CREATE TABLE user_monthly_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  month_year VARCHAR(7) NOT NULL, -- '2025-01'
  
  -- Usage Stats
  total_tokens_used INTEGER DEFAULT 0,
  total_requests_made INTEGER DEFAULT 0,
  total_conversations INTEGER DEFAULT 0,
  total_documents_uploaded INTEGER DEFAULT 0,
  
  -- Model Usage Breakdown
  model_usage JSONB DEFAULT '{}', -- {"gemini-2.0-flash": 45000, "gemini-1.5-flash": 5000}
  
  -- Billing
  overage_tokens INTEGER DEFAULT 0,
  overage_charges DECIMAL(12,2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, month_year)
);
```

## 3. Service Layer Architecture

### Subscription Management Service
```typescript
@Injectable()
export class SubscriptionService {
  // Core subscription operations
  async createSubscription(userId: string, planId: string, billingCycle: 'monthly' | 'yearly'): Promise<Subscription>
  async upgradeSubscription(userId: string, newPlanId: string): Promise<Subscription>
  async cancelSubscription(userId: string, reason?: string): Promise<void>
  async renewSubscription(subscriptionId: string): Promise<Subscription>
  
  // Plan management
  async getAvailablePlans(): Promise<SubscriptionPlan[]>
  async getUserSubscription(userId: string): Promise<Subscription | null>
  async getSubscriptionUsage(userId: string): Promise<UsageSummary>
  
  // Feature access control
  async canUserAccessFeature(userId: string, feature: string): Promise<boolean>
  async canUserSelectModel(userId: string, model: string): Promise<boolean>
  async getRemainingQuota(userId: string): Promise<QuotaStatus>
}
```

### Payment Processing Service
```typescript
@Injectable()
export class PaymentService {
  // Paystack integration
  async initializePayment(userId: string, planId: string, billingCycle: string): Promise<PaystackInitResponse>
  async verifyPayment(reference: string): Promise<PaymentVerification>
  async createPaystackCustomer(user: User): Promise<PaystackCustomer>
  async createPaystackPlan(plan: SubscriptionPlan): Promise<PaystackPlan>
  
  // Subscription payments
  async processSubscriptionPayment(paymentData: PaymentWebhook): Promise<void>
  async handleFailedPayment(subscriptionId: string): Promise<void>
  async processRefund(transactionId: string, amount: number): Promise<RefundResult>
  
  // Webhook handling
  async handlePaystackWebhook(webhookData: PaystackWebhook): Promise<void>
}
```

### Tier Enforcement Service
```typescript
@Injectable()
export class TierEnforcementService {
  // Access control
  async enforceModelAccess(userId: string, requestedModel: string): Promise<string> // Returns allowed model or throws
  async enforceDailyRequestLimit(userId: string): Promise<boolean>
  async enforceMonthlyTokenLimit(userId: string, estimatedTokens: number): Promise<boolean>
  async enforceConversationLimit(userId: string): Promise<boolean>
  async enforceDocumentUploadLimit(userId: string): Promise<boolean>
  
  // Feature gating
  async checkFeatureAccess(userId: string, feature: FeatureName): Promise<boolean>
  async getAvailableFeatures(userId: string): Promise<FeatureName[]>
  async getModelSelectionOptions(userId: string): Promise<ModelOption[]>
}
```

### Billing Service
```typescript
@Injectable()
export class BillingService {
  // Invoice management
  async generateInvoice(subscriptionId: string): Promise<Invoice>
  async sendInvoiceEmail(userId: string, invoiceId: string): Promise<void>
  async calculateOverageCharges(userId: string, month: string): Promise<number>
  
  // Usage reporting
  async generateUsageReport(userId: string, period: DateRange): Promise<UsageReport>
  async exportBillingData(userId: string, year: number): Promise<BillingExport>
  
  // Payment reminders
  async sendPaymentReminder(userId: string): Promise<void>
  async handleDunning(userId: string): Promise<void> // Failed payment recovery
}
```

## 4. API Endpoint Structure

### Subscription Management API (`/subscription`)
```typescript
// Plan discovery
GET    /subscription/plans                    // Get available plans
GET    /subscription/plans/:planId           // Get specific plan details

// User subscriptions
GET    /subscription/current                 // Get user's current subscription
POST   /subscription/subscribe               // Subscribe to a plan
PUT    /subscription/upgrade                 // Upgrade/downgrade plan
DELETE /subscription/cancel                  // Cancel subscription
GET    /subscription/usage                   // Get current usage stats

// Model selection
GET    /subscription/models                  // Get available models for user
PUT    /subscription/select-model           // Update user's selected model
```

### Payment API (`/billing`)
```typescript
// Payment processing
POST   /billing/initialize                   // Initialize payment with Paystack
POST   /billing/verify                      // Verify payment completion
POST   /billing/webhook                     // Paystack webhook endpoint

// Billing history
GET    /billing/transactions                // Get payment history
GET    /billing/invoices                    // Get invoice history
GET    /billing/invoice/:id                 // Download specific invoice
GET    /billing/usage-report               // Get detailed usage report
```

### Admin API (`/admin`)
```typescript
// Plan management
POST   /admin/plans                        // Create new plan
PUT    /admin/plans/:id                    // Update plan
DELETE /admin/plans/:id                    // Deactivate plan

// User management
GET    /admin/users                        // List users with subscription status
PUT    /admin/users/:id/subscription       // Admin override subscription
POST   /admin/users/:id/credit             // Add usage credits

// Analytics
GET    /admin/analytics/revenue            // Revenue analytics
GET    /admin/analytics/usage              // System usage analytics
GET    /admin/analytics/churn              // Churn analysis
```

### Enhanced Agent API
```typescript
// Modified existing endpoints with tier enforcement
POST   /agent/chat                         // Now checks tier limits before processing
POST   /agent/chat/stream                  // Enforces real-time tier limits
GET    /agent/models                       // Returns models available to user's tier
PUT    /agent/select-model                 // Updates user's model preference
```

## 5. Frontend Integration Points

### Subscription Management Components
```typescript
// Plan Selection
<PlanSelector 
  plans={availablePlans}
  currentPlan={userSubscription}
  onSelectPlan={(plan) => handlePlanSelection(plan)}
/>

// Payment Processing
<PaymentForm 
  plan={selectedPlan}
  billingCycle={billingCycle}
  onPaymentSuccess={(reference) => verifyAndActivate(reference)}
/>

// Usage Dashboard
<UsageDashboard
  usage={currentUsage}
  limits={subscriptionLimits}
  tier={userTier}
  onUpgrade={() => showUpgradeModal()}
/>

// Model Selection
<ModelSelector
  availableModels={getUserAvailableModels()}
  selectedModel={userModel}
  onModelChange={(model) => updateUserModel(model)}
/>
```

### Paystack Integration Flow
```typescript
// Payment initialization
async function initializePayment(planId: string, billingCycle: 'monthly' | 'yearly') {
  const response = await fetch('/api/billing/initialize', {
    method: 'POST',
    body: JSON.stringify({ planId, billingCycle }),
    headers: { 'Authorization': `Bearer ${jwt}` }
  });
  
  const { authorization_url, reference } = await response.json();
  
  // Redirect to Paystack
  window.location.href = authorization_url;
}

// Payment verification (callback page)
async function verifyPayment(reference: string) {
  const response = await fetch('/api/billing/verify', {
    method: 'POST',
    body: JSON.stringify({ reference }),
    headers: { 'Authorization': `Bearer ${jwt}` }
  });
  
  const result = await response.json();
  
  if (result.success) {
    // Redirect to dashboard with success message
    router.push('/dashboard?subscription=activated');
  } else {
    // Handle payment failure
    router.push('/subscription?error=payment_failed');
  }
}
```

## 6. Tier Enforcement Strategy

### Model Access Control
```typescript
// In AgentService before orchestration
async function enforceModelAccess(user: User, requestedModel?: string): Promise<string> {
  const subscription = await getUserSubscription(user.id);
  const allowedModels = subscription.plan.allowedModels;
  
  // Use user's selected model or default to tier's best model
  const targetModel = requestedModel || user.selectedModel || allowedModels[0];
  
  if (!allowedModels.includes(targetModel)) {
    // Downgrade to best available model for user's tier
    const fallbackModel = allowedModels[allowedModels.length - 1]; // Assume array is ordered by capability
    logger.warn(`User ${user.id} attempted to use ${targetModel}, downgraded to ${fallbackModel}`);
    return fallbackModel;
  }
  
  return targetModel;
}
```

### Request Rate Limiting
```typescript
// Enhanced quota checking with tier limits
async function checkTierLimits(user: User, estimatedTokens: number): Promise<TierCheckResult> {
  const subscription = await getUserSubscription(user.id);
  const usage = await getCurrentUsage(user.id);
  
  // Check daily request limit
  if (usage.requestsToday >= subscription.plan.requestsPerDay) {
    return {
      allowed: false,
      reason: `Daily request limit exceeded (${subscription.plan.requestsPerDay} requests/day)`,
      upgradeRequired: true
    };
  }
  
  // Check monthly token limit
  if (usage.tokensThisMonth + estimatedTokens > subscription.plan.tokensPerMonth) {
    return {
      allowed: false,
      reason: `Monthly token limit would be exceeded (${subscription.plan.tokensPerMonth} tokens/month)`,
      upgradeRequired: true
    };
  }
  
  return { allowed: true };
}
```

### Feature Gating
```typescript
// Feature access control throughout the application
async function checkFeatureAccess(user: User, feature: FeatureName): Promise<boolean> {
  const subscription = await getUserSubscription(user.id);
  const features = subscription.plan.features;
  
  switch (feature) {
    case 'googleSheetsIntegration':
      return features.googleSheets === true;
    case 'emailDrafting':
      return features.emailDrafting === true;
    case 'advancedResearch':
      return subscription.plan.slug !== 'free';
    case 'documentUpload':
      return true; // All tiers have some document upload
    default:
      return false;
  }
}
```

## 7. Paystack Integration Architecture

### Webhook Processing
```typescript
@Post('/billing/webhook')
async handlePaystackWebhook(@Body() webhookData: PaystackWebhook, @Headers('x-paystack-signature') signature: string) {
  // Verify webhook signature
  if (!verifyPaystackSignature(webhookData, signature)) {
    throw new UnauthorizedException('Invalid webhook signature');
  }
  
  switch (webhookData.event) {
    case 'subscription.create':
      await activateUserSubscription(webhookData.data);
      break;
    
    case 'subscription.disable':
      await suspendUserSubscription(webhookData.data);
      break;
    
    case 'invoice.payment_failed':
      await handleFailedPayment(webhookData.data);
      break;
    
    case 'charge.success':
      await recordSuccessfulPayment(webhookData.data);
      break;
  }
  
  return { status: 'success' };
}
```

### Customer Management
```typescript
// Create Paystack customer for new subscribers
async function createPaystackCustomer(user: User): Promise<PaystackCustomer> {
  const customerData = {
    email: user.email,
    first_name: user.name.split(' ')[0],
    last_name: user.name.split(' ').slice(1).join(' '),
    metadata: {
      user_id: user.id,
      registration_date: user.createdAt
    }
  };
  
  const response = await paystack.customer.create(customerData);
  
  // Store customer code in user record
  await updateUser(user.id, {
    paystackCustomerCode: response.data.customer_code
  });
  
  return response.data;
}
```

## 8. Administrative Tools and Analytics

### Admin Dashboard Components
```typescript
// Revenue Analytics
interface RevenueAnalytics {
  monthlyRevenue: number;
  yearlyRevenue: number;
  revenueByTier: { [tier: string]: number };
  monthOverMonthGrowth: number;
  churnRate: number;
  averageRevenuePerUser: number;
}

// Usage Analytics
interface UsageAnalytics {
  totalActiveUsers: number;
  usersByTier: { [tier: string]: number };
  averageTokensPerUser: number;
  mostPopularModels: ModelUsageStats[];
  peakUsageHours: UsageHourStats[];
}

// Subscription Analytics
interface SubscriptionAnalytics {
  newSubscriptions: number;
  canceledSubscriptions: number;
  upgrades: number;
  downgrades: number;
  conversionRate: number; // Free to paid
  retentionRate: { [period: string]: number };
}
```

### Administrative Actions
```typescript
// Admin overrides and management
@Controller('/admin')
export class AdminController {
  @Post('/users/:id/grant-credits')
  async grantUsageCredits(@Param('id') userId: string, @Body() credits: CreditGrant) {
    // Grant additional tokens/requests for customer support
  }
  
  @Put('/users/:id/override-subscription')
  async overrideSubscription(@Param('id') userId: string, @Body() override: SubscriptionOverride) {
    // Admin can manually change user subscription for support cases
  }
  
  @Get('/analytics/revenue')
  async getRevenueAnalytics(@Query() filters: AnalyticsFilters) {
    // Comprehensive revenue reporting
  }
  
  @Post('/plans/:id/price-change')
  async schedulePriceChange(@Param('id') planId: string, @Body() priceChange: PriceChangeSchedule) {
    // Schedule future price changes with user notifications
  }
}
```

## 9. Migration Strategy

### Phase 1: Foundation (Weeks 1-2)
1. **Database schema migration**
   - Create new subscription tables
   - Migrate existing users to "free" tier
   - Set up Paystack integration tables

2. **Core service implementation**
   - SubscriptionService basic operations
   - PaymentService Paystack integration
   - TierEnforcementService basic controls

### Phase 2: Payment Integration (Weeks 3-4)
1. **Paystack integration**
   - Payment initialization and verification
   - Webhook handling
   - Customer management

2. **Frontend payment flow**
   - Plan selection UI
   - Payment processing components
   - Success/failure handling

### Phase 3: Tier Enforcement (Weeks 5-6)
1. **Access control implementation**
   - Model access restrictions
   - Feature gating
   - Usage limit enforcement

2. **Enhanced quota system**
   - Tier-based limits
   - Real-time enforcement
   - Overage handling

### Phase 4: Admin Tools and Analytics (Weeks 7-8)
1. **Administrative interface**
   - Subscription management
   - User management
   - Analytics dashboard

2. **Billing and invoicing**
   - Invoice generation
   - Usage reporting
   - Payment reminders

### Phase 5: Testing and Launch (Weeks 9-10)
1. **Comprehensive testing**
   - Payment flow testing
   - Tier enforcement validation
   - Load testing with different tiers

2. **Soft launch preparation**
   - Documentation
   - Support processes
   - Monitoring and alerting

## 10. Success Metrics and KPIs

### Financial Metrics
- **Monthly Recurring Revenue (MRR)**
- **Annual Recurring Revenue (ARR)**
- **Average Revenue Per User (ARPU)**
- **Customer Lifetime Value (CLV)**
- **Churn Rate** by tier
- **Conversion Rate** (free to paid)

### Product Metrics
- **Feature adoption** by tier
- **Model usage distribution**
- **Support ticket volume** by tier
- **User satisfaction** scores
- **Usage efficiency** (tokens per conversation)

### Operational Metrics
- **Payment success rate**
- **Subscription renewal rate**
- **Failed payment recovery rate**
- **Support response time**
- **System uptime and performance**

## Conclusion

This comprehensive plan transforms Remograd into a professional, industry-standard SaaS platform with multi-tier subscriptions, integrated payment processing, and sophisticated access controls. The implementation leverages the existing robust architecture while adding essential business functionality for sustainable growth and monetization.

The tier structure provides clear value progression, the Paystack integration ensures reliable payment processing for the Nigerian market, and the comprehensive administrative tools enable effective business management and analytics.

**Estimated Implementation Timeline: 10 weeks**
**Total Development Effort: ~400-500 hours**
**Key Technologies: NestJS, Supabase, Paystack API, TypeScript, React/Next.js**