# Subscription System API Guide

## Overview

The subscription system implements a simple 2-tier structure:
- **Free Tier**: 20 messages per day, ₦0/month
- **Pro Tier**: 100 messages per day, ₦3,000/month

All features are available to both tiers - the only difference is the daily message limit.

## Environment Variables

Add these to your `.env` file:

```bash
# Paystack Configuration
PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key_here
PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public_key_here
PAYSTACK_WEBHOOK_SECRET=your_paystack_webhook_secret_here
```

## Database Migration

Run the migration to set up subscription tables:

```sql
-- Execute the SQL file
psql -d your_database -f database/migrations/001_create_subscription_system.sql
```

## API Endpoints for Frontend

### 1. Get Available Subscription Tiers

```http
GET /subscription/tiers
```

**Response:**
```json
[
  {
    "id": "uuid-1",
    "name": "free",
    "display_name": "Free",
    "price_ngn": 0,
    "daily_message_limit": 20,
    "description": "Free tier with 20 messages per day",
    "is_active": true
  },
  {
    "id": "uuid-2", 
    "name": "pro",
    "display_name": "Pro",
    "price_ngn": 3000,
    "daily_message_limit": 100,
    "description": "Pro tier with 100 messages per day for ₦3,000/month",
    "is_active": true
  }
]
```

### 2. Get Current User Subscription

```http
GET /subscription/current
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "id": "sub-uuid",
  "user_id": "user-uuid",
  "tier_name": "pro",
  "tier_display_name": "Pro",
  "price_ngn": 3000,
  "daily_message_limit": 100,
  "status": "active",
  "current_period_start": "2025-01-23T00:00:00Z",
  "current_period_end": "2025-02-23T00:00:00Z",
  "paystack_subscription_code": "SUB_xxx"
}
```

### 3. Check Message Quota Status

```http
GET /subscription/quota
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "can_send_message": true,
  "messages_used": 15,
  "daily_limit": 100,
  "messages_remaining": 85,
  "tier_name": "pro",
  "tier_display_name": "Pro"
}
```

### 4. Subscribe to Pro Tier

```http
POST /subscription/subscribe
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "tier_name": "pro",
  "callback_url": "https://your-frontend.com/subscription/success"
}
```

**Response:**
```json
{
  "authorization_url": "https://checkout.paystack.com/...",
  "reference": "sub_userid_timestamp",
  "access_code": "access_code_here"
}
```

**For Free Tier:**
```http
POST /subscription/subscribe
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "tier_name": "free"
}
```

**Response:**
```json
{
  "id": "sub-uuid",
  "user_id": "user-uuid", 
  "tier_name": "free",
  "tier_display_name": "Free",
  "price_ngn": 0,
  "daily_message_limit": 20,
  "status": "active",
  "current_period_start": "2025-01-23T00:00:00Z",
  "current_period_end": "2125-01-23T00:00:00Z"
}
```

### 5. Verify Payment

```http
POST /subscription/verify
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "reference": "payment_reference_from_paystack"
}
```

**Response:**
```json
{
  "success": true,
  "subscription": {
    "id": "sub-uuid",
    "user_id": "user-uuid",
    "tier_name": "pro", 
    "tier_display_name": "Pro",
    "price_ngn": 3000,
    "daily_message_limit": 100,
    "status": "active",
    "current_period_start": "2025-01-23T00:00:00Z",
    "current_period_end": "2025-02-23T00:00:00Z"
  }
}
```

### 6. Cancel Subscription

```http
POST /subscription/cancel
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "message": "Subscription canceled successfully"
}
```

### 7. Get Payment History

```http
GET /subscription/payments
Authorization: Bearer <jwt_token>
```

**Response:**
```json
[
  {
    "id": "payment-uuid",
    "amount_ngn": 3000,
    "transaction_type": "subscription",
    "status": "success",
    "paystack_reference": "ref_123",
    "created_at": "2025-01-23T10:00:00Z"
  }
]
```

### 8. Get User Profile (includes subscription info)

```http
GET /auth/profile
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "picture": "https://...",
  "role": "user",
  "is_active": true,
  "subscription_tier": "pro",
  "daily_message_limit": 100,
  "created_at": "2025-01-01T00:00:00Z"
}
```

## Message Quota Enforcement

The system automatically enforces message limits on these endpoints:

- `POST /agent/chat` - Chat with AI agent
- `POST /agent/chat/stream` - Streaming chat

When quota is exceeded, you'll receive:

```json
{
  "statusCode": 403,
  "message": "Daily message limit reached (20 messages/day for Free tier)",
  "error": "QUOTA_EXCEEDED",
  "quotaStatus": {
    "messages_used": 20,
    "daily_limit": 20,
    "messages_remaining": 0,
    "tier_name": "free"
  },
  "upgradeRequired": true
}
```

## Frontend Integration Example

### 1. Check User's Current Subscription

```typescript
async function getCurrentSubscription(token: string) {
  const response = await fetch('/api/subscription/current', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (response.ok) {
    return await response.json();
  }
  return null;
}
```

### 2. Check Message Quota Before Sending

```typescript
async function checkQuota(token: string) {
  const response = await fetch('/api/subscription/quota', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const quota = await response.json();
  
  if (!quota.can_send_message) {
    // Show upgrade prompt for free users
    if (quota.tier_name === 'free') {
      showUpgradeModal();
    } else {
      showDailyLimitMessage();
    }
    return false;
  }
  
  return true;
}
```

### 3. Initialize Pro Subscription

```typescript
async function subscribeToPro(token: string) {
  const response = await fetch('/api/subscription/subscribe', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tier_name: 'pro',
      callback_url: `${window.location.origin}/subscription/verify`
    })
  });
  
  const result = await response.json();
  
  // Redirect to Paystack
  window.location.href = result.authorization_url;
}
```

### 4. Verify Payment (on callback page)

```typescript
async function verifyPayment(reference: string, token: string) {
  const response = await fetch('/api/subscription/verify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reference })
  });
  
  const result = await response.json();
  
  if (result.success) {
    // Subscription activated successfully
    router.push('/dashboard?subscription=activated');
  } else {
    // Payment failed
    router.push('/subscription?error=payment_failed');
  }
}
```

### 5. Display Quota Status in UI

```typescript
function QuotaDisplay({ quota }: { quota: QuotaStatus }) {
  const percentage = (quota.messages_used / quota.daily_limit) * 100;
  
  return (
    <div className="quota-display">
      <div className="quota-bar">
        <div 
          className="quota-fill" 
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p>
        {quota.messages_used} / {quota.daily_limit} messages used today
        ({quota.tier_display_name} tier)
      </p>
      
      {quota.tier_name === 'free' && quota.messages_used >= quota.daily_limit * 0.8 && (
        <UpgradePrompt />
      )}
    </div>
  );
}
```

## Webhook Configuration (Optional)

If you want to handle Paystack webhooks for subscription status updates:

```http
POST /subscription/webhook
Content-Type: application/json
X-Paystack-Signature: <signature>

{
  "event": "charge.success",
  "data": {
    "reference": "ref_123",
    "status": "success",
    // ... other Paystack data
  }
}
```

Configure webhook URL in Paystack dashboard:
`https://your-backend.com/subscription/webhook`

## Testing

1. **Run Migration**: Execute the SQL migration file
2. **Set Environment Variables**: Add Paystack keys to `.env`
3. **Test Free Subscription**: All new users start with free tier
4. **Test Pro Upgrade**: Use Paystack test cards
5. **Test Quota Enforcement**: Send messages to hit daily limits
6. **Test Payment Verification**: Complete payment flow

## Common Test Scenarios

### Test Card Numbers (Paystack)
- **Success**: 4084084084084081
- **Insufficient Funds**: 4094094094094090
- **Invalid Card**: 4188888888888888

### Test Flow
1. Register new user → Should be on Free tier (20 messages/day)
2. Send 20 messages → 21st should be blocked
3. Upgrade to Pro → Payment flow should work
4. After payment → Should have 100 messages/day
5. Cancel subscription → Should revert to Free tier

This completes the implementation of the 2-tier subscription system with Paystack integration!