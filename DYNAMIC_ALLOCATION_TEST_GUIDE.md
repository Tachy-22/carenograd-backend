# Dynamic RPD Allocation System - Testing Guide

## Overview

This guide explains how to test the new dynamic RPD allocation system that allocates daily requests based on active user count.

## System Components

### 1. Database Schema (`DYNAMIC_RPD_ALLOCATION_SCHEMA.sql`)
- **user_daily_allocations**: Tracks each user's daily allocation
- **system_daily_tracking**: Tracks system-wide daily usage
- **PostgreSQL functions**: Handle dynamic allocation calculations

### 2. Services
- **DynamicRpdTrackerService**: Core allocation logic
- **DynamicAllocationGuard**: Middleware to enforce limits

### 3. API Endpoints
- `POST /agent/chat` - Protected by allocation guard
- `POST /agent/chat/stream` - Protected by allocation guard  
- `GET /agent/allocation/daily` - User's current allocation
- `GET /agent/allocation/system-overview` - System overview
- `GET /agent/allocation/can-request` - Check if user can request

## Testing Steps

### Step 1: Setup Database Schema

```bash
# Run the schema update
psql -d your_database -f DYNAMIC_RPD_ALLOCATION_SCHEMA.sql
```

### Step 2: Start the Application

```bash
npm run start:dev
```

### Step 3: Test Dynamic Allocation

#### Single User Test
1. **Login as first user**
2. **Check allocation**: `GET /agent/allocation/daily`
   - Should show ~3000 requests allocated (you're the only user)
   - `activeUsersCount: 1`

3. **Make a chat request**: `POST /agent/chat`
   - Should succeed
   - Check allocation again - should show 2999 remaining

#### Multiple Users Test
1. **Login as second user** (different account)
2. **Make a request** to trigger allocation
3. **Check both users' allocations**:
   - Each should now have ~1500 requests (3000 ÷ 2)
   - `activeUsersCount: 2`

4. **Add third user**:
   - Each user should now have ~1000 requests (3000 ÷ 3)
   - `activeUsersCount: 3`

### Step 4: Test Allocation Limits

1. **Exhaust user's allocation**:
   ```bash
   # Make requests until limit reached
   for i in {1..1000}; do
     curl -X POST /agent/chat \
       -H "Authorization: Bearer $JWT_TOKEN" \
       -H "Content-Type: application/json" \
       -d '{"message": "test"}'
   done
   ```

2. **Verify blocking**:
   - Next request should return 403 with allocation message
   - `GET /agent/allocation/can-request` should return `allowed: false`

### Step 5: Test Real-time Updates

1. **Monitor system overview**: `GET /agent/allocation/system-overview`
2. **Add new users** and watch allocation adjust in real-time
3. **Check allocation history**: `GET /agent/allocation/history`

## Expected Behavior

### Dynamic Allocation Formula
```
requests_per_user = max(30, 3000 ÷ active_users_count)
```

### Test Scenarios
| Active Users | Requests Per User | Total Usage |
|--------------|-------------------|-------------|
| 1            | 3,000            | 100%        |
| 2            | 1,500            | 100%        |
| 10           | 300              | 100%        |
| 50           | 60               | 100%        |
| 100          | 30               | 100%        |

### User Experience Messages
- **1 user**: "🚀 You're the only active user today! Enjoy 3000 requests."
- **5 users**: "🔥 Premium allocation! 299/300 requests remaining. Only 5 active users today."
- **50 users**: "✅ 59/60 requests remaining today. Shared among 50 active users."
- **Limit reached**: "🚫 Daily limit reached! You've used all 60 requests today. Allocation resets tomorrow."

## API Testing Examples

### Check User Allocation
```bash
curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:3000/agent/allocation/daily
```

### Check System Overview
```bash
curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:3000/agent/allocation/system-overview
```

### Make Protected Chat Request
```bash
curl -X POST \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, test the allocation system"}' \
  http://localhost:3000/agent/chat
```

### Reset User Usage (Admin)
```bash
curl -X POST \
  -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:3000/agent/allocation/reset-user/USER_ID
```

## Verification Checklist

- [ ] Database schema applied successfully
- [ ] Single user gets ~3000 requests
- [ ] Multiple users split allocation evenly
- [ ] Minimum 30 requests guaranteed per user
- [ ] Requests blocked when limit exceeded
- [ ] Allocation updates in real-time as users join
- [ ] System overview shows correct statistics
- [ ] User allocation history tracks over time
- [ ] Error messages are user-friendly
- [ ] Chat endpoints protected by allocation guard

## Troubleshooting

### Common Issues

1. **PostgreSQL Functions Not Found**
   - Ensure schema was applied to correct database
   - Check function creation with `\df` in psql

2. **Allocation Not Updating**
   - Check if users are making requests (triggers allocation)
   - Verify system_daily_tracking table has current date records

3. **Guard Not Working**
   - Ensure DynamicAllocationGuard is imported in AgentModule
   - Check guard is applied to chat endpoints

### Debug Queries

```sql
-- Check current allocations
SELECT * FROM user_daily_allocations WHERE allocation_date = CURRENT_DATE;

-- Check system tracking
SELECT * FROM system_daily_tracking WHERE tracking_date = CURRENT_DATE;

-- Manual allocation calculation
SELECT * FROM calculate_daily_allocation('gemini-2.5-flash');
```

## Success Criteria

✅ **Dynamic allocation working**: Users get different allocations based on active count
✅ **Real-time updates**: Allocation changes when new users join
✅ **Limit enforcement**: Requests blocked when allocation exceeded
✅ **Perfect efficiency**: Always uses 100% of available 3000 RPD
✅ **User experience**: Clear, friendly messages about allocation status
✅ **API endpoints**: All allocation endpoints working correctly

The system successfully transforms the brutal RPD constraint into a smart, user-friendly resource sharing system!