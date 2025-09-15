# Token Quota System Implementation

## 🎯 **Goal Achieved**
Frontend can now receive real-time warnings when AI agent quota is running low. The system dynamically allocates tokens among active users and provides comprehensive quota monitoring.

## 📊 **System Overview**

### **Dynamic User Allocation**
- **Total tokens divided by active users**: `20 tokens ÷ 4 active users = 5 tokens per user`
- **Real-time reallocation**: When users become active/inactive, quotas automatically adjust
- **Fair distribution**: All active users get equal shares of available quota

### **Warning System**
- **LOW**: < 60% quota used
- **MEDIUM**: 60-79% quota used  
- **HIGH**: 80-94% quota used
- **CRITICAL**: ≥ 95% quota used

## 🏗️ **Database Schema Created**

### **Core Tables**
1. **`token_pools`** - Global token limits per model
2. **`user_token_quotas`** - Allocated quotas per user per model
3. **`token_usage_records`** - Historical usage tracking
4. **`user_token_usage_summary`** - Real-time usage summaries
5. **`system_token_usage_summary`** - System-wide usage tracking

### **PostgreSQL Functions**
1. **`record_token_usage()`** - Records usage and updates all summaries
2. **`allocate_user_quotas()`** - Dynamically redistributes quotas
3. **`get_user_quota_status()`** - Returns quota status with warning levels
4. **`get_system_token_overview()`** - System-wide statistics
5. **`cleanup_old_token_records()`** - Maintenance cleanup

## 🔌 **API Endpoints Created**

### **System Monitoring**
- `GET /agent/tokens/statistics` - System-wide token overview
- `GET /agent/tokens/user` - User-specific usage statistics

### **Frontend Warning System** 
- `GET /agent/tokens/quota-status` - Detailed quota status for warnings
- `GET /agent/tokens/warning-level` - Current warning level (LOW/MEDIUM/HIGH/CRITICAL)
- `GET /agent/tokens/can-request/:tokens` - Check if request can proceed

### **Administration**
- `POST /agent/tokens/reset` - Reset user usage (testing/admin)

## 🚀 **Setup Instructions**

### **1. Database Setup**
```bash
# Run the SQL schema in your PostgreSQL database
psql -d your_database -f DATABASE_TOKEN_SCHEMA.sql
```

### **2. Environment Variables**
Ensure these are set in your `.env`:
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### **3. Update Agent Module**
The system uses the existing `DatabaseTokenTrackerService` but you'll need to replace the current `TokenTrackerService` in production.

### **4. Frontend Integration**
Use these endpoints to show quota warnings:

```typescript
// Check warning level before user interactions
const checkQuotaWarning = async () => {
  const response = await fetch('/agent/tokens/warning-level', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const { warningLevel, shouldWarn, message } = await response.json();
  
  if (shouldWarn) {
    showWarningToast(message, warningLevel);
  }
};

// Check before making expensive requests
const canMakeRequest = async (estimatedTokens: number) => {
  const response = await fetch(`/agent/tokens/can-request/${estimatedTokens}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const { allowed, reason } = await response.json();
  
  if (!allowed) {
    showErrorMessage(`Request blocked: ${reason}`);
    return false;
  }
  return true;
};
```

## 📱 **Frontend Warning Examples**

### **Warning Toast Messages**
- **MEDIUM**: "⚠️ You've used 65% of your quota this minute"
- **HIGH**: "🔶 Warning: 85% quota used - requests may be limited soon"
- **CRITICAL**: "🚨 Critical: 98% quota used - requests will be blocked"

### **UI Indicators**
```typescript
const getQuotaColor = (warningLevel: string) => {
  switch(warningLevel) {
    case 'LOW': return 'green';
    case 'MEDIUM': return 'yellow'; 
    case 'HIGH': return 'orange';
    case 'CRITICAL': return 'red';
  }
};
```

## 🔄 **How Token Allocation Works**

### **Step 1: Active User Detection**
```sql
-- Counts users who made requests in last 24 hours
SELECT COUNT(DISTINCT user_id) FROM token_usage_records 
WHERE created_at > NOW() - INTERVAL '24 hours';
```

### **Step 2: Quota Distribution**
```sql
-- Each model's tokens divided by active users
tokens_per_user = total_tokens_per_minute / active_user_count
```

### **Step 3: Usage Tracking**
Every request triggers:
1. **Record usage** in `token_usage_records`
2. **Update summaries** in `user_token_usage_summary`
3. **Reallocate quotas** based on new usage patterns

### **Step 4: Frontend Notifications**
The warning system checks:
- **Current usage** vs **allocated quota**
- **Time-based windows** (per minute/hour/day)
- **Model-specific limits**

## 🎛️ **Configuration**

### **Model Limits** (in `token_pools` table)
```sql
INSERT INTO token_pools (model_name, total_tokens_per_minute, total_requests_per_minute) VALUES
('gemini-2.0-flash', 1000000, 15),
('gemini-1.5-flash', 250000, 15);
```

### **Warning Thresholds** (customizable in service)
```typescript
const getWarningLevel = (percentage: number) => {
  if (percentage >= 95) return 'CRITICAL';  // Customizable
  if (percentage >= 80) return 'HIGH';      // Customizable  
  if (percentage >= 60) return 'MEDIUM';    // Customizable
  return 'LOW';
};
```

## 🧪 **Testing**

### **Test Quota Allocation**
```bash
# 1. Make several chat requests to consume tokens
POST /agent/chat { "message": "Hello" }

# 2. Check your quota status
GET /agent/tokens/quota-status

# 3. Test warning levels
GET /agent/tokens/warning-level

# 4. Test request blocking
GET /agent/tokens/can-request/999999999
```

### **Test Dynamic Reallocation**
1. **Single user**: Gets full quota allocation
2. **Add second user**: Both get 50% of total quota
3. **Third user joins**: All get 33% of total quota
4. **User goes inactive**: Remaining users get larger shares

## 📈 **Monitoring & Analytics**

### **Real-time Dashboard Data**
```typescript
const dashboardData = {
  systemOverview: await fetch('/agent/tokens/statistics'),
  userQuota: await fetch('/agent/tokens/quota-status'),
  warningLevel: await fetch('/agent/tokens/warning-level')
};
```

### **Usage Patterns**
- **Peak hours**: Track when most tokens are consumed
- **User distribution**: See how quota is allocated across users
- **Model efficiency**: Compare token usage across different models

## 🔧 **Maintenance**

### **Daily Cleanup** (Cron Job)
```sql
-- Run this daily to clean old records
SELECT cleanup_old_token_records();
```

### **Manual Quota Reset**
```sql
-- Emergency quota reset for all users
UPDATE user_token_usage_summary SET 
  tokens_used_current_minute = 0,
  requests_made_current_minute = 0;
```

## ✅ **Implementation Status**

- ✅ PostgreSQL database schema created
- ✅ Dynamic user allocation system
- ✅ Real-time usage tracking
- ✅ Frontend warning API endpoints
- ✅ Request permission checking
- ✅ Comprehensive testing endpoints
- ✅ Documentation and setup instructions

## 🎯 **Next Steps**

1. **Run `DATABASE_TOKEN_SCHEMA.sql`** in your PostgreSQL database
2. **Test endpoints** using `rest-cli-test/token-endpoints.rest`
3. **Integrate frontend warnings** using the API endpoints
4. **Set up monitoring dashboard** with real-time quota display
5. **Configure alerts** for critical quota situations

The system now provides complete frontend quota awareness with dynamic allocation and real-time warnings! 🚀