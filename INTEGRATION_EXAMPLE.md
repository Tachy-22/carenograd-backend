# Multi-API Allocation System Integration Guide

## Overview

This integration provides dynamic API quota allocation and 15-key rotation for Gemini 2.5 with minimal changes to your existing agent-monolith system.

## 🔧 Simple Integration Steps

### 1. Add to Your App Module

```typescript
// src/app.module.ts
import { AllocationModule } from './allocation/allocation.module';

@Module({
  imports: [
    // ... your existing modules
    AllocationModule,
  ],
  // ...
})
export class AppModule {}
```

### 2. Update Your Agent Service (Minimal Changes)

```typescript
// src/agent/agent.service.ts
import { Injectable } from '@nestjs/common';
import { AgentAllocationIntegrationService } from '../services/agent-allocation-integration.service';

@Injectable()
export class AgentService {
  constructor(
    // ... your existing dependencies
    private readonly allocationService: AgentAllocationIntegrationService, // Add this
  ) {}

  async chat(request: ChatRequest, user: User): Promise<ChatResponse> {
    try {
      // OLD CODE: Direct AI SDK call
      // const result = await generateText({
      //   model: openai('gpt-4'),
      //   prompt: request.message,
      // });

      // NEW CODE: Use allocation service (just replace the AI call)
      const response = await this.allocationService.makeRequest({
        prompt: request.message,
        system: 'You are a helpful assistant',
        userId: user.id, // Required for quota tracking
        temperature: 0.7,
      });

      if (!response.success) {
        if (response.error?.includes('QUOTA_EXCEEDED')) {
          return {
            message: `Daily request limit reached. ${response.error}`,
            conversationId: request.conversationId,
            messageId: crypto.randomUUID(),
          };
        }
        throw new Error(response.error);
      }

      // Continue with your existing logic
      return {
        message: response.result.text,
        conversationId: request.conversationId,
        messageId: crypto.randomUUID(),
        // Optional: Include allocation info in response
        meta: {
          remainingRequests: response.allocationInfo?.remainingRequests,
          warningLevel: response.allocationInfo?.warningLevel,
        },
      };

    } catch (error) {
      // Your existing error handling
      throw error;
    }
  }

  // For streaming responses
  async streamChat(request: ChatRequest, user: User) {
    const response = await this.allocationService.makeRequest({
      messages: request.messages || [{ role: 'user', content: request.message }],
      system: 'You are a helpful assistant',
      userId: user.id,
      streaming: true, // Enable streaming
      tools: request.tools,
      stopWhen: request.stopWhen,
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    return response.result; // This is the streaming response
  }
}
```

### 3. Add Environment Variables

```env
# Add these 15 Gemini API keys to your .env file
GEMINI_API_KEY_1=your_first_api_key_here
GEMINI_API_KEY_2=your_second_api_key_here
GEMINI_API_KEY_3=your_third_api_key_here
GEMINI_API_KEY_4=your_fourth_api_key_here
GEMINI_API_KEY_5=your_fifth_api_key_here
GEMINI_API_KEY_6=your_sixth_api_key_here
GEMINI_API_KEY_7=your_seventh_api_key_here
GEMINI_API_KEY_8=your_eighth_api_key_here
GEMINI_API_KEY_9=your_ninth_api_key_here
GEMINI_API_KEY_10=your_tenth_api_key_here
GEMINI_API_KEY_11=your_eleventh_api_key_here
GEMINI_API_KEY_12=your_twelfth_api_key_here
GEMINI_API_KEY_13=your_thirteenth_api_key_here
GEMINI_API_KEY_14=your_fourteenth_api_key_here
GEMINI_API_KEY_15=your_fifteenth_api_key_here
```

### 4. Run Database Schema

```bash
# Execute the SQL schema in your Supabase database
# File: MULTI_API_ALLOCATION_SCHEMA.sql
```

## 🔥 Benefits You Get Immediately

### ✅ **Dynamic Allocation**
- **1 user**: Gets 3,000 requests/day
- **10 users**: Each gets 300 requests/day
- **50 users**: Each gets 60 requests/day
- **100 users**: Each gets 30 requests/day (minimum guaranteed)

### ✅ **15x API Capacity**
- **15 API keys** automatically rotated
- **3,000 total daily requests** (200 × 15)
- **225 requests/minute** (15 × 15)
- **Auto-failover** when keys hit limits

### ✅ **Zero Downtime**
- Automatic key rotation
- Rate limit detection and switching
- Error recovery with retries

## 📊 Monitoring Endpoints

### User Endpoints
```bash
# Check user's allocation
GET /allocation/daily?model=gemini-2.5

# Check if user can make request
GET /allocation/can-request?model=gemini-2.5
```

### Admin Endpoints
```bash
# System overview
GET /allocation/system-overview

# Key pool statistics
GET /allocation/key-pool/stats

# System health
GET /allocation/key-pool/available
```

## 🚀 Optional: Frontend Integration

### React Hook Example
```typescript
// hooks/useAllocation.ts
export function useAllocation() {
  const [allocation, setAllocation] = useState(null);

  useEffect(() => {
    fetch('/api/allocation/daily', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(setAllocation);
  }, []);

  return allocation;
}

// Usage in component
const allocation = useAllocation();
return (
  <div>
    Requests remaining: {allocation?.requestsRemainingToday}/{allocation?.allocatedRequestsToday}
  </div>
);
```

## 🛠 What Changes in Your Existing Code

### BEFORE (Your current code):
```typescript
const result = await generateText({
  model: openai('gpt-4'),
  prompt: userMessage,
});
```

### AFTER (New allocation-aware code):
```typescript
const response = await this.allocationService.makeRequest({
  prompt: userMessage,
  userId: user.id, // Just add userId
});

if (!response.success) {
  throw new Error(response.error);
}

const result = response.result; // Same result structure
```

## 🔒 Security & Low Coupling

- **No changes to your database schema** (uses separate allocation tables)
- **No changes to your auth system** (uses existing guards)
- **No changes to your API responses** (optional allocation info)
- **Drop-in replacement** for AI SDK calls
- **Graceful degradation** if allocation service fails

## 📈 Scaling

- **Current setup**: Supports up to 100 users with 30+ requests/day each
- **To scale further**: Just add more API keys (each key = +10 users at 30 req/day)
- **200 users**: Need 20 API keys
- **500 users**: Need 50 API keys

Your agent-monolith system remains completely unchanged except for the AI request calls! 🎯