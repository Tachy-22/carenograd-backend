# Quota Status API Documentation

## Overview

The quota status system tracks token usage and request limits for users across different AI models. This document provides comprehensive details about all quota-related endpoints, their parameters, and return values.

## Authentication

All endpoints require JWT authentication via the `Authorization: Bearer <token>` header.

## Base URL

All endpoints are prefixed with `/agent/tokens/`

## Endpoints

### 1. GET `/agent/tokens/statistics`

**Summary:** Get comprehensive system-wide token usage statistics

**Description:** Returns system-wide token usage statistics including total available tokens, tokens used, number of users, current model, and per-model status.

**Authentication:** Required (JWT Bearer token)

**Parameters:** None

**Response:**
```typescript
SystemTokenOverview[] = [
  {
    modelName: string;                     // e.g., "gemini-2.0-flash"
    totalTokensPerMinute: number;          // Total system capacity per minute
    totalTokensUsedCurrentMinute: number;  // Currently used tokens this minute
    systemTokensRemaining: number;         // Remaining system tokens this minute
    activeUsersCount: number;              // Number of active users
    tokensPerUser: number;                 // Allocated tokens per user
    systemUsagePercentage: number;         // System usage as percentage (0-100)
  }
]
```

**Example Response:**
```json
[
  {
    "modelName": "gemini-2.0-flash",
    "totalTokensPerMinute": 1000000,
    "totalTokensUsedCurrentMinute": 150000,
    "systemTokensRemaining": 850000,
    "activeUsersCount": 25,
    "tokensPerUser": 40000,
    "systemUsagePercentage": 15.0
  }
]
```

### 2. GET `/agent/tokens/user`

**Summary:** Get user-specific token usage statistics

**Description:** Returns token usage statistics for the authenticated user including tokens used, requests made, current model, and recent usage history.

**Authentication:** Required (JWT Bearer token)

**Parameters:** None

**Response:**
```typescript
{
  tokensUsed: number;          // Tokens used in current minute
  requestsMade: number;        // Requests made in current minute
  currentModel: string;        // Current model being used ("gemini-2.0-flash")
  percentageOfTotal: number;   // Quota usage percentage (0-100)
  recentUsage: TokenUsageHistory[]; // Last 10 usage records
}

TokenUsageHistory = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  model_name: string;
  conversation_id?: string;
  message_id?: string;
  created_at: string;  // ISO date string
}
```

**Example Response:**
```json
{
  "tokensUsed": 1250,
  "requestsMade": 3,
  "currentModel": "gemini-2.0-flash",
  "percentageOfTotal": 3.125,
  "recentUsage": [
    {
      "prompt_tokens": 300,
      "completion_tokens": 150,
      "total_tokens": 450,
      "model_name": "gemini-2.0-flash",
      "conversation_id": "conv_123",
      "message_id": "msg_456",
      "created_at": "2025-01-15T14:30:00Z"
    }
  ]
}
```

### 3. POST `/agent/tokens/reset`

**Summary:** Reset user token usage

**Description:** Reset token usage statistics for the authenticated user. Useful for testing or administrative purposes.

**Authentication:** Required (JWT Bearer token)

**Parameters:** None

**Response:**
```typescript
{
  message: string;  // Success message
  userId: string;   // User ID that was reset
}
```

**Example Response:**
```json
{
  "message": "User token usage reset successfully",
  "userId": "user_123"
}
```

### 4. GET `/agent/tokens/quota-status`

**Summary:** Get detailed user quota status for frontend warnings

**Description:** Returns detailed quota status including warning levels and remaining capacity. Used by frontend to show quota warnings.

**Authentication:** Required (JWT Bearer token)

**Parameters:** None

**Response:**
```typescript
UserQuotaStatus = {
  userId: string;                          // User ID
  modelName: string;                       // Model name (e.g., "gemini-2.0-flash")
  allocatedTokensPerMinute: number;        // Total allocated tokens per minute
  allocatedRequestsPerMinute: number;      // Total allocated requests per minute
  tokensUsedCurrentMinute: number;         // Tokens used in current minute
  requestsMadeCurrentMinute: number;       // Requests made in current minute
  tokensRemainingCurrentMinute: number;    // Tokens remaining this minute
  requestsRemainingCurrentMinute: number;  // Requests remaining this minute
  quotaPercentageUsed: number;            // Usage percentage (0-100)
  warningLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; // Warning level
  canMakeRequest: boolean;                // Whether user can make another request
}
```

**Example Response:**
```json
{
  "userId": "user_123",
  "modelName": "gemini-2.0-flash",
  "allocatedTokensPerMinute": 40000,
  "allocatedRequestsPerMinute": 15,
  "tokensUsedCurrentMinute": 1250,
  "requestsMadeCurrentMinute": 3,
  "tokensRemainingCurrentMinute": 38750,
  "requestsRemainingCurrentMinute": 12,
  "quotaPercentageUsed": 3.125,
  "warningLevel": "LOW",
  "canMakeRequest": true
}
```

### 5. GET `/agent/tokens/can-request/:estimatedTokens`

**Summary:** Check if user can make request with estimated tokens

**Description:** Frontend can call this before making requests to check quota availability and get warnings.

**Authentication:** Required (JWT Bearer token)

**Parameters:**
- `estimatedTokens` (path parameter): Number of tokens the request is estimated to use

**Response:**
```typescript
{
  allowed: boolean;              // Whether the request is allowed
  reason?: string;               // Reason for denial (if not allowed)
  quotaStatus?: UserQuotaStatus; // Current quota status
  suggestedModel?: string;       // Alternative model suggestion (if quota exceeded)
}
```

**Example Response (Allowed):**
```json
{
  "allowed": true,
  "quotaStatus": {
    "userId": "user_123",
    "modelName": "gemini-2.0-flash",
    "allocatedTokensPerMinute": 40000,
    "tokensUsedCurrentMinute": 1250,
    "tokensRemainingCurrentMinute": 38750,
    "quotaPercentageUsed": 3.125,
    "warningLevel": "LOW",
    "canMakeRequest": true
  }
}
```

**Example Response (Denied with Suggestion):**
```json
{
  "allowed": false,
  "reason": "Insufficient tokens. Need: 50000, Available: 38750",
  "quotaStatus": { /* quota status object */ },
  "suggestedModel": "gemini-1.5-flash"
}
```

**Example Response (Invalid Input):**
```json
{
  "allowed": false,
  "reason": "Invalid token estimate provided"
}
```

### 6. GET `/agent/tokens/warning-level`

**Summary:** Get current warning level for frontend notifications

**Description:** Returns warning level (LOW, MEDIUM, HIGH, CRITICAL) for frontend to show appropriate warnings.

**Authentication:** Required (JWT Bearer token)

**Parameters:** None

**Response:**
```typescript
{
  warningLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; // Current warning level
  shouldWarn: boolean;           // Whether frontend should show warning
  percentageUsed: number;        // Current usage percentage
  tokensUsed: number;           // Tokens used in current minute
  currentModel: string;         // Current model name
  message: string;              // Human-readable status message
}
```

**Example Response:**
```json
{
  "warningLevel": "HIGH",
  "shouldWarn": true,
  "percentageUsed": 85.2,
  "tokensUsed": 34080,
  "currentModel": "gemini-2.0-flash",
  "message": "You are approaching your quota limit (85.2% used)"
}
```

## Warning Levels

The system uses four warning levels based on quota usage percentage:

- **LOW** (0-59%): Normal usage, no warnings
- **MEDIUM** (60-79%): Moderate usage, informational notice
- **HIGH** (80-94%): High usage, warning recommended
- **CRITICAL** (95-100%): Near or at limit, immediate action required

## Error Responses

All endpoints may return these error codes:

- **401 Unauthorized**: Invalid or missing JWT token
- **500 Internal Server Error**: Database or system error

Error response format:
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

## Model Names

Currently supported models (in order of preference):

1. `gemini-2.0-flash` (1M TPM, 15 RPM - highest limit)
2. `gemini-1.5-flash` (250K TPM, 15 RPM)
3. `gemini-1.5-flash-8b` (250K TPM, 15 RPM)
4. `gemini-1.5-flash-002` (250K TPM, 15 RPM)
5. `gemini-2.5-flash-lite` (250K TPM, 15 RPM)
6. `gemini-2.5-flash` (250K TPM, 10 RPM - lowest limit)

## Usage Notes

1. **Time-based Resets**: Quotas are reset every minute automatically
2. **Multi-user System**: Token pools are shared among all active users
3. **Dynamic Allocation**: User quotas are dynamically allocated based on active user count
4. **Fallback Models**: System automatically suggests alternative models when quotas are exceeded
5. **Real-time Tracking**: All usage is tracked in real-time and reflected immediately in endpoints

## Integration Example

```typescript
// Check quota before making a request
async function checkQuotaBeforeRequest(estimatedTokens: number) {
  const response = await fetch(`/agent/tokens/can-request/${estimatedTokens}`, {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  
  const result = await response.json();
  
  if (!result.allowed) {
    if (result.suggestedModel) {
      console.log(`Quota exceeded. Try using ${result.suggestedModel}`);
    } else {
      console.log(`Request denied: ${result.reason}`);
    }
    return false;
  }
  
  return true;
}

// Get current warning level for UI
async function getWarningLevel() {
  const response = await fetch('/agent/tokens/warning-level', {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  
  const warning = await response.json();
  
  if (warning.shouldWarn) {
    showWarningUI(warning.message, warning.warningLevel);
  }
}
```

## Database Schema Dependencies

The quota system relies on these database tables:

- `token_pools`: System-wide token capacity configuration
- `user_token_quotas`: Per-user quota allocations
- `user_token_usage_summary`: Real-time usage tracking
- `token_usage_records`: Historical usage records

All quota data is automatically maintained by the system with proper time-based resets and dynamic allocation.