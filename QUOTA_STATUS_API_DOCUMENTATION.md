# ⚠️ DEPRECATED - OLD QUOTA SYSTEM

**This documentation is for the OLD token-based quota system that has been REPLACED.**

## 🔄 Migration Notice

The token-based quota system described in this document has been **completely replaced** with a new tier-based subscription system.

### What Changed

- ❌ **OLD**: Complex token allocation divided among active users
- ✅ **NEW**: Simple tier-based daily message limits per user
- ❌ **OLD**: `/agent/tokens/*` endpoints for quota checking  
- ✅ **NEW**: `/subscription/*` endpoints for quota management

### Replacement Documentation

**Please use the new documentation instead:**
- **[SUBSCRIPTION_API_GUIDE.md](./SUBSCRIPTION_API_GUIDE.md)** - Complete API documentation for the new system
- **[MIGRATION_COMPLETE.md](./MIGRATION_COMPLETE.md)** - Migration guide and what changed

## New Quota System Summary

### Tier Structure
- **Free Tier**: 20 messages per day, ₦0/month
- **Pro Tier**: 100 messages per day, ₦3,000/month

### New Endpoints to Use Instead

| Old Endpoint (❌ Removed) | New Endpoint (✅ Use This) | Purpose |
|---------------------------|---------------------------|---------|
| `GET /agent/tokens/quota-status` | `GET /subscription/quota` | Check daily message quota |
| `GET /agent/tokens/user` | `GET /auth/profile` | Get user info with tier |
| `GET /agent/tokens/can-request/:tokens` | `GET /subscription/quota` | Check if can send message |
| `GET /agent/tokens/statistics` | `GET /subscription/current` | Get subscription info |

### New Response Format

**Old Format (No longer available):**
```json
{
  "tokensUsed": 1500,
  "tokensRemaining": 8500,
  "warningLevel": "LOW"
}
```

**New Format:**
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

## Frontend Migration Required

### Replace Old API Calls

```typescript
// ❌ REMOVE - These endpoints no longer exist
fetch('/api/agent/tokens/quota-status')
fetch('/api/agent/tokens/can-request/1000') 
fetch('/api/agent/tokens/user')
fetch('/api/agent/tokens/statistics')

// ✅ REPLACE WITH - New subscription endpoints
fetch('/api/subscription/quota')           // Check daily message quota
fetch('/api/auth/profile')                // Get user profile with tier
fetch('/api/subscription/current')        // Get subscription details
fetch('/api/subscription/tiers')          // Get available tiers
```

### Update Quota Display Logic

```typescript
// ❌ OLD - Remove this logic
interface OldQuotaStatus {
  tokensUsed: number;
  tokensRemaining: number;
  warningLevel: string;
}

// ✅ NEW - Use this instead
interface NewQuotaStatus {
  can_send_message: boolean;
  messages_used: number;
  daily_limit: number;
  messages_remaining: number;
  tier_name: string;
  tier_display_name: string;
}

// ✅ NEW - Usage example
async function checkQuota() {
  const response = await fetch('/api/subscription/quota', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const quota: NewQuotaStatus = await response.json();
  
  // Show quota in UI
  const percentage = (quota.messages_used / quota.daily_limit) * 100;
  updateQuotaBar(percentage);
  
  // Show upgrade prompt for free users near limit
  if (quota.tier_name === 'free' && quota.messages_remaining <= 2) {
    showUpgradePrompt();
  }
}
```

## Complete Migration Guide

For full details on migrating to the new system, see:
- **[SUBSCRIPTION_API_GUIDE.md](./SUBSCRIPTION_API_GUIDE.md)** - Complete API reference
- **[MIGRATION_COMPLETE.md](./MIGRATION_COMPLETE.md)** - Step-by-step migration guide

---

# OLD DOCUMENTATION (For Reference Only)

*The following is the old documentation, kept for reference during migration:*

## Overview (OLD SYSTEM)

The quota status system tracked token usage and request limits for users across different AI models. **This system has been completely replaced and these endpoints no longer exist.**

## Authentication (OLD SYSTEM)

All endpoints required JWT authentication via the `Authorization: Bearer <token>` header.

## Base URL (OLD SYSTEM)

All endpoints were prefixed with `/agent/tokens/` - **These endpoints have been removed.**

## Endpoints (OLD SYSTEM - NO LONGER AVAILABLE)

### 1. ❌ GET `/agent/tokens/statistics` (REMOVED)

**Status:** Endpoint removed, use `GET /subscription/current` instead

### 2. ❌ GET `/agent/tokens/user` (REMOVED) 

**Status:** Endpoint removed, use `GET /auth/profile` instead

### 3. ❌ POST `/agent/tokens/reset` (REMOVED)

**Status:** Endpoint removed, no replacement (quota resets daily automatically)

### 4. ❌ GET `/agent/tokens/quota-status` (REMOVED)

**Status:** Endpoint removed, use `GET /subscription/quota` instead

### 5. ❌ GET `/agent/tokens/can-request/:estimatedTokens` (REMOVED)

**Status:** Endpoint removed, use `GET /subscription/quota` instead

### 6. ❌ GET `/agent/tokens/warning-level` (REMOVED)

**Status:** Endpoint removed, quota status included in `GET /subscription/quota`

---

**Please update your frontend to use the new subscription system endpoints. The old token-based system is no longer available.**