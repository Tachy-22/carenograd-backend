# Gemini API Keys Setup Guide

## Overview

This guide explains how to configure your 15 Gemini API keys for automatic rotation and load balancing.

## Environment Variables Setup

Add the following 15 API keys to your `.env` file:

```env
# Gemini API Keys (15 keys for maximum capacity)
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

## How to Get Gemini API Keys

1. **Visit Google AI Studio**: https://makersuite.google.com/app/apikey
2. **Create 15 separate API keys** (recommended to create them from different Google accounts if possible)
3. **Copy each key** and add them to your `.env` file

## Key Pool Features

### 🔄 **Automatic Rotation**
- **Round-robin distribution**: Requests are distributed evenly across all 15 keys
- **Rate limit detection**: Automatically switches to next key when limits are hit
- **Error recovery**: Retries with different keys on failures

### 📊 **Rate Limit Management**
- **Per-key tracking**: Monitors usage for each individual key
- **Daily quotas**: Tracks 200 requests per day per key (3,000 total)
- **Per-minute limits**: Manages 15 requests per minute per key (225 total)
- **Token limits**: Handles 1M tokens per minute per key (15M total)

### 🛡️ **Intelligent Failover**
- **Real-time monitoring**: Continuously tracks key availability
- **Automatic retry**: Uses different keys when one fails
- **Rate limit detection**: Recognizes 429 errors and switches keys
- **Daily reset**: Automatically resets counters at midnight

## Usage in Your Application

### 1. Add Services to Module

```typescript
// Add to your app.module.ts or relevant module
import { GeminiKeyPoolService } from './src/services/gemini-key-pool.service';
import { GeminiWithKeyPoolService } from './src/services/gemini-with-key-pool.service';

@Module({
  providers: [
    GeminiKeyPoolService,
    GeminiWithKeyPoolService,
    // ... other providers
  ],
  // ...
})
```

### 2. Use in Your Agents

```typescript
// In your agent service
constructor(
  private readonly geminiKeyPool: GeminiWithKeyPoolService
) {}

// Generate text with automatic key rotation
const result = await this.geminiKeyPool.generateTextWithKeyRotation({
  prompt: "Your prompt here",
  system: "Your system message",
  temperature: 0.7
});

// Stream text with automatic key rotation
const stream = await this.geminiKeyPool.streamTextWithKeyRotation({
  messages: conversationHistory,
  system: systemPrompt,
  tools: availableTools,
  stopWhen: stepCountIs(50)
});
```

### 3. Monitor Key Usage

```typescript
// Get key pool statistics
const stats = this.geminiKeyPool.getKeyPoolStats();
console.log('System stats:', stats.systemStats);
console.log('Individual key stats:', stats.keyStats);

// Check if keys are available
if (!this.geminiKeyPool.hasAvailableKeys()) {
  console.log('All keys are currently rate limited');
}
```

## API Endpoints for Monitoring

Add these endpoints to monitor your key pool:

```typescript
@Get('admin/key-pool/stats')
async getKeyPoolStats() {
  return this.geminiKeyPool.getKeyPoolStats();
}

@Get('admin/key-pool/system')
async getSystemStats() {
  const stats = this.geminiKeyPool.getKeyPoolStats();
  return stats.systemStats;
}

@Post('admin/key-pool/reset/:keyIndex')
async resetKey(@Param('keyIndex') keyIndex: string) {
  this.geminiKeyPool.resetKey(parseInt(keyIndex));
  return { message: `Key ${keyIndex} reset successfully` };
}
```

## Expected Performance

### With 15 API Keys:
- **Daily Capacity**: 3,000 requests (200 × 15)
- **Per-Minute Capacity**: 225 requests (15 × 15)
- **Token Capacity**: 15M tokens per minute (1M × 15)

### User Experience:
- **100 users**: Each gets 30 requests per day
- **50 users**: Each gets 60 requests per day  
- **10 users**: Each gets 300 requests per day
- **1 user**: Gets all 3,000 requests per day

## Monitoring Dashboard Data

```json
{
  "systemStats": {
    "totalKeys": 15,
    "activeKeys": 15,
    "totalDailyCapacity": 3000,
    "totalDailyUsed": 1247,
    "totalMinuteCapacity": 225,
    "availableKeys": 12,
    "nextResetTime": "2024-01-02T00:00:00.000Z"
  },
  "keyStats": [
    {
      "keyIndex": 0,
      "requestsUsedToday": 83,
      "requestsPerMinute": 2,
      "lastUsed": "2024-01-01T15:30:45.123Z",
      "status": "available"
    },
    // ... 14 more keys
  ]
}
```

## Troubleshooting

### Common Issues:

1. **Keys Not Loading**
   ```
   ❌ Missing GEMINI_API_KEY_1 in environment
   ```
   **Solution**: Ensure all 15 keys are in your `.env` file

2. **All Keys Rate Limited**
   ```
   ⚠️ All API keys are currently rate limited or exhausted
   ```
   **Solution**: Wait for daily reset or add more keys

3. **Invalid API Key**
   ```
   ❌ Key 3 failed: API_KEY_INVALID
   ```
   **Solution**: Check that the API key is valid and active

### Debug Commands:

```bash
# Check key pool status
curl http://localhost:3000/admin/key-pool/stats

# Reset a specific key
curl -X POST http://localhost:3000/admin/key-pool/reset/0
```

## Security Best Practices

1. **Environment Variables**: Never commit API keys to version control
2. **Key Rotation**: Regularly rotate your API keys
3. **Access Control**: Limit access to admin endpoints
4. **Monitoring**: Set up alerts for quota exhaustion
5. **Backup Keys**: Keep spare keys for emergency use

## Success Metrics

✅ **15 keys loaded successfully**
✅ **Automatic rotation working**
✅ **Rate limits properly managed**
✅ **Daily quotas tracked accurately**
✅ **Failover working on errors**
✅ **Performance improved 15x over single key**

Your system now efficiently uses all 15 API keys to maximize capacity and provide the best user experience possible!