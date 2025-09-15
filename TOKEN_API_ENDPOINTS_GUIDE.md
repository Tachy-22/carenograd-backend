# Token Quota API Endpoints Guide

## 📋 **Overview**
This document details all token tracking and quota management endpoints available for frontend integration. These endpoints enable real-time quota monitoring, usage warnings, and request permission checking.

---

## 🔍 **System Monitoring Endpoints**

### **GET /agent/tokens/statistics**
**Purpose**: Get comprehensive system-wide token usage overview  
**Usage**: Admin dashboards, system monitoring, capacity planning  
**Authentication**: Required (JWT Bearer token)  

**Parameters**: None

**Response Structure**:
```json
{
  "totalAvailableTokens": 2250000,
  "totalTokensUsed": 15420,
  "totalUsers": 3,
  "currentModel": "gemini-2.0-flash",
  "remainingTokens": 984580,
  "modelsStatus": {
    "gemini-2.0-flash": {
      "totalTokens": 1000000,
      "usedTokens": 15420,
      "remainingTokens": 984580,
      "requestsPerMinute": 15
    }
  },
  "topUsers": [
    {
      "userId": "uuid",
      "tokensUsed": 8420,
      "requestsMade": 12,
      "currentModel": "gemini-2.0-flash"
    }
  ]
}
```

**Use Cases**:
- Display system health dashboard
- Monitor overall capacity utilization
- Track which models are most used
- Identify heavy usage patterns

---

### **GET /agent/tokens/user**
**Purpose**: Get detailed token usage statistics for authenticated user  
**Usage**: User profile pages, personal usage tracking  
**Authentication**: Required (JWT Bearer token)

**Parameters**: None

**Response Structure**:
```json
{
  "tokensUsed": 8420,
  "requestsMade": 12,
  "currentModel": "gemini-2.0-flash",
  "percentageOfTotal": 54.6,
  "recentUsage": [
    {
      "promptTokens": 450,
      "completionTokens": 380,
      "totalTokens": 830,
      "model": "gemini-2.0-flash",
      "userId": "uuid",
      "timestamp": "2025-09-09T01:45:23.456Z"
    }
  ]
}
```

**Use Cases**:
- Show user their personal usage metrics
- Display usage history and patterns
- Track which models user prefers
- Calculate user's share of system resources

---

## ⚠️ **Frontend Warning System Endpoints**

### **GET /agent/tokens/quota-status**
**Purpose**: Get detailed quota status for frontend warning displays  
**Usage**: Real-time quota monitoring, progress bars, warning banners  
**Authentication**: Required (JWT Bearer token)

**Parameters**: None

**Response Structure**:
```json
{
  "tokensUsed": 8420,
  "requestsMade": 12,
  "currentModel": "gemini-2.0-flash",
  "percentageOfTotal": 54.6,
  "recentUsage": [...],
  "allocatedQuota": 15000,
  "remainingQuota": 6580,
  "resetTime": "2025-09-09T02:00:00.000Z"
}
```

**Use Cases**:
- Display quota usage progress bars
- Show time until quota reset
- Calculate estimated requests remaining
- Trigger preemptive UI warnings

---

### **GET /agent/tokens/warning-level**
**Purpose**: Get current warning level for user notifications  
**Usage**: Toast notifications, status indicators, blocking UI elements  
**Authentication**: Required (JWT Bearer token)

**Parameters**: None

**Response Structure**:
```json
{
  "warningLevel": "HIGH",
  "shouldWarn": true,
  "percentageUsed": 85.2,
  "tokensUsed": 8420,
  "currentModel": "gemini-2.0-flash",
  "message": "You are approaching your quota limit (85.2% used)"
}
```

**Warning Levels**:
- **LOW**: < 60% quota used - Normal operation
- **MEDIUM**: 60-79% quota used - Caution advised  
- **HIGH**: 80-94% quota used - Warning recommended
- **CRITICAL**: ≥ 95% quota used - Blocking recommended

**Use Cases**:
- Show colored status indicators (green/yellow/orange/red)
- Display warning toasts when threshold reached
- Enable/disable UI features based on quota level
- Provide user guidance on quota management

---

## 🚦 **Request Permission Endpoints**

### **GET /agent/tokens/can-request/:estimatedTokens**
**Purpose**: Check if user can make request with estimated token usage  
**Usage**: Pre-request validation, smart request queuing, model switching  
**Authentication**: Required (JWT Bearer token)

**Parameters**:
- **estimatedTokens** (URL parameter): Integer - Estimated tokens needed for request

**Example URLs**:
- `/agent/tokens/can-request/1000` - Check for 1000 tokens
- `/agent/tokens/can-request/5000` - Check for 5000 tokens

**Response Structure (Allowed)**:
```json
{
  "allowed": true,
  "estimatedTokens": 1000,
  "remainingAfterRequest": 4580,
  "quotaStatus": {
    "allocatedQuota": 15000,
    "currentUsage": 8420,
    "warningLevel": "MEDIUM"
  }
}
```

**Response Structure (Blocked)**:
```json
{
  "allowed": false,
  "reason": "Insufficient tokens. Need: 5000, Available: 1580",
  "estimatedTokens": 5000,
  "suggestedModel": "gemini-1.5-flash",
  "retryAfter": "2025-09-09T02:00:00.000Z"
}
```

**Use Cases**:
- Validate requests before sending to backend
- Show "Request too large" warnings
- Suggest alternative models when primary is exhausted
- Implement smart request queuing
- Display accurate "Submit" button states

---

## 🔧 **Administrative Endpoints**

### **POST /agent/tokens/reset**
**Purpose**: Reset user's token usage counters  
**Usage**: Testing, debugging, administrative quota management  
**Authentication**: Required (JWT Bearer token)

**Parameters**: None (resets current user's usage)

**Response Structure**:
```json
{
  "message": "User token usage reset successfully",
  "userId": "8b276f6f-ac2d-43db-a776-ce976629d3f1",
  "resetTimestamp": "2025-09-09T01:45:00.000Z"
}
```

**Use Cases**:
- Development testing and debugging
- Administrative quota resets
- Emergency quota clearance
- User support interventions

---

## 🎯 **Frontend Integration Patterns**

### **1. Real-time Monitoring**
```
Poll /agent/tokens/warning-level every 30 seconds
→ Update UI indicators based on warningLevel
→ Show toast notifications when shouldWarn = true
```

### **2. Pre-request Validation**
```
User clicks "Send Message" 
→ Call /agent/tokens/can-request/1500 (estimated tokens)
→ If allowed=false, show warning and block request
→ If allowed=true, proceed with actual request
```

### **3. Progressive Warnings**
```
Check /agent/tokens/quota-status
→ percentageUsed < 60%: Green indicator, no warnings
→ percentageUsed 60-79%: Yellow indicator, subtle warning
→ percentageUsed 80-94%: Orange indicator, prominent warning  
→ percentageUsed ≥ 95%: Red indicator, block new requests
```

### **4. Smart Model Switching**
```
Request blocked on primary model
→ API returns suggestedModel in response
→ Frontend offers "Switch to [model]?" option
→ User confirms and request proceeds on alternative model
```

---

## ⏱️ **Timing and Refresh Patterns**

### **High Frequency** (Every 10-30 seconds)
- `/agent/tokens/warning-level` - For real-time warnings
- `/agent/tokens/quota-status` - For progress indicators

### **Medium Frequency** (Every 1-2 minutes)  
- `/agent/tokens/user` - For usage statistics updates
- `/agent/tokens/can-request/*` - Before large operations

### **Low Frequency** (Every 5-10 minutes)
- `/agent/tokens/statistics` - For admin dashboards

### **Event-Driven** (After specific actions)
- After chat messages sent
- After file uploads completed
- After bulk operations finished

---

## 🚨 **Error Handling**

### **Common Error Responses**:
```json
{
  "statusCode": 401,
  "message": "Unauthorized - invalid or missing JWT token"
}
```

```json
{
  "statusCode": 400, 
  "message": "Invalid token estimate provided"
}
```

```json
{
  "statusCode": 500,
  "message": "Internal server error - quota service unavailable"
}
```

### **Frontend Error Handling**:
- **401 Unauthorized**: Redirect to login
- **400 Bad Request**: Show validation error to user
- **500 Server Error**: Show "Service temporarily unavailable" message
- **Network Error**: Show "Check connection" and retry option

---

## 📱 **Mobile Considerations**

### **Reduced Polling**
- Use longer intervals on mobile (60+ seconds)
- Implement background/foreground polling adjustment
- Cache responses to reduce battery drain

### **Simplified UI**
- Show essential warnings only
- Use simpler progress indicators
- Prioritize critical notifications

---

## 🔐 **Security Notes**

### **Authentication Required**
All endpoints require valid JWT Bearer token in Authorization header:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **Rate Limiting**
- Quota endpoints themselves are not rate-limited
- But excessive polling should be avoided
- Implement client-side request debouncing

### **Data Privacy**
- User statistics are user-specific only
- System statistics don't expose individual user data
- Admin endpoints may require elevated permissions

---

This comprehensive guide provides everything needed to integrate token quota monitoring into any frontend application! 🚀