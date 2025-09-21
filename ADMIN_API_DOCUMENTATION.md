# Admin API Documentation

## Overview

The Admin API provides comprehensive administrative capabilities for monitoring users, managing system settings, and accessing detailed analytics. All admin endpoints require authentication and admin role privileges.

## Base URL
```
/admin
```

## Authentication

All admin endpoints require:
1. Valid JWT token in Authorization header: `Authorization: Bearer <token>`
2. User must have `role: 'admin'`
3. User account must be active (`is_active: true`)

## Database Schema Updates Required

Before using the admin functionality, ensure your database schema includes these columns in the `users` table:

```sql
-- Add these columns to your users table
ALTER TABLE users ADD COLUMN role VARCHAR(10) DEFAULT 'user' CHECK (role IN ('user', 'admin'));
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP;

-- Create index for better performance
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);
```

## API Endpoints

### Dashboard & Analytics

#### Chart Data Endpoints

All chart endpoints support time range parameters and return data optimized for visualization libraries like Chart.js, D3.js, or Recharts.

#### GET /admin/dashboard/stats
Get comprehensive dashboard statistics including user, conversation, and message metrics.

**Response:**
```json
{
  "users": {
    "totalUsers": 150,
    "activeUsers": 120,
    "adminUsers": 5,
    "newUsersToday": 3,
    "newUsersThisWeek": 12,
    "newUsersThisMonth": 45
  },
  "conversations": {
    "totalConversations": 850,
    "conversationsToday": 25,
    "conversationsThisWeek": 180,
    "conversationsThisMonth": 650
  },
  "messages": {
    "totalMessages": 5200,
    "messagesToday": 150,
    "messagesThisWeek": 1100,
    "messagesThisMonth": 4200
  }
}
```

#### GET /admin/analytics/system-metrics
Get detailed system health and usage metrics with growth rates and calculated KPIs.

#### GET /admin/analytics/user-engagement
Get user engagement analytics including DAU, retention rates, and activity patterns.

#### GET /admin/analytics/content
Get content creation and usage analytics with trend data.

### AI Token Quota & Allocation Management

#### GET /admin/quota/system-overview
Get system-wide AI token quota usage and allocation statistics across all models.

**Response:**
```json
[
  {
    "modelName": "gemini-2.5-flash",
    "totalRequestsAvailable": 3000,
    "totalRequestsUsed": 1250,
    "requestsRemaining": 1750,
    "systemUsagePercentage": 41.7,
    "activeUsersCount": 25,
    "requestsPerUser": 50,
    "utilizationEfficiency": 83.5
  }
]
```

#### GET /admin/quota/key-pool-stats
Get detailed statistics about API key pool utilization, rate limits, and system health.

**Response:**
```json
{
  "totalKeys": 15,
  "availableKeys": 12,
  "rateLimitedKeys": 2,
  "exhaustedKeys": 1,
  "systemHealth": "HEALTHY",
  "keyUtilization": 78.5,
  "estimatedRecoveryTime": "2 hours"
}
```

#### GET /admin/quota/users
Get AI token allocation details for all users with pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `model` (optional): Filter by model name (default: 'gemini-2.5-flash')

**Response:**
```json
{
  "allocations": [
    {
      "userId": "uuid",
      "userEmail": "user@example.com",
      "userName": "John Doe",
      "modelName": "gemini-2.5-flash",
      "allocatedRequestsToday": 50,
      "requestsUsedToday": 32,
      "requestsRemainingToday": 18,
      "allocationPercentageUsed": 64.0,
      "canMakeRequest": true,
      "warningLevel": "MEDIUM",
      "lastRequestAt": "2024-01-17T10:30:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 10,
  "totalPages": 15,
  "model": "gemini-2.5-flash"
}
```

#### GET /admin/quota/users/:id
Get detailed AI token quota usage for a specific user.

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "is_active": true
  },
  "totalRequests": 850,
  "requestsToday": 32,
  "requestsThisWeek": 180,
  "requestsThisMonth": 750,
  "mostUsedModel": "gemini-2.5-flash",
  "avgRequestsPerDay": 25,
  "lastActivity": "2024-01-17T10:30:00Z",
  "quotaStatus": "NEAR_LIMIT"
}
```

#### GET /admin/quota/usage-trends
Get AI token usage trends over time for system analysis.

**Query Parameters:**
- `days` (optional): Number of days to include (default: 30)
- `model` (optional): Filter by model name

**Response:**
```json
{
  "model": "gemini-2.5-flash",
  "timeRange": {
    "days": 30,
    "startDate": "2023-12-18",
    "endDate": "2024-01-17"
  },
  "trends": [
    {
      "date": "2024-01-15",
      "totalRequests": 450,
      "uniqueUsers": 25,
      "averageRequestsPerUser": 18,
      "systemUtilization": 75,
      "peakHourUsage": 65
    }
  ],
  "summary": {
    "totalRequests": 13500,
    "avgDailyUsers": 22,
    "peakUsageDay": {
      "date": "2024-01-10",
      "totalRequests": 520
    },
    "utilizationTrend": "stable"
  }
}
```

#### POST /admin/quota/users/:id/adjust
Manually adjust a user's daily AI token allocation.

**Request Body:**
```json
{
  "userId": "uuid",
  "modelName": "gemini-2.5-flash",
  "dailyAllocation": 75
}
```

**Response:**
```json
{
  "message": "User allocation adjustment logged",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "allocation": {
    "model": "gemini-2.5-flash",
    "newDailyLimit": 75,
    "effectiveDate": "2024-01-17T10:30:00Z"
  },
  "warning": "This feature requires a user_allocations table implementation for persistence"
}
```

#### GET /admin/quota/alerts
Get current quota alerts for users approaching or exceeding limits.

**Response:**
```json
{
  "alerts": [
    {
      "userId": "uuid",
      "userEmail": "user@example.com",
      "userName": "John Doe",
      "alertLevel": "CRITICAL",
      "usagePercentage": 98.5,
      "requestsRemaining": 1,
      "model": "gemini-2.5-flash",
      "canMakeRequest": true,
      "message": "User is very close to daily limit"
    }
  ],
  "summary": {
    "totalAlerts": 5,
    "criticalAlerts": 2,
    "highAlerts": 3,
    "usersOverLimit": 1
  }
}
```

### Chart Data Endpoints

#### GET /admin/charts/user-registrations
Get daily user registration counts for line charts.

**Query Parameters:**
- `days` (optional): Number of days to include (default: 30, max: 365)

**Response:**
```json
[
  { "date": "2024-01-15", "count": 5 },
  { "date": "2024-01-16", "count": 8 },
  { "date": "2024-01-17", "count": 3 }
]
```

#### GET /admin/charts/active-users
Get daily active user counts based on login activity.

**Query Parameters:**
- `days` (optional): Number of days to include (default: 30, max: 365)

**Response:**
```json
[
  { "date": "2024-01-15", "count": 120 },
  { "date": "2024-01-16", "count": 135 },
  { "date": "2024-01-17", "count": 118 }
]
```

#### GET /admin/charts/conversations
Get daily conversation creation counts.

**Query Parameters:**
- `days` (optional): Number of days to include (default: 30, max: 365)

**Response:**
```json
[
  { "date": "2024-01-15", "count": 45 },
  { "date": "2024-01-16", "count": 52 },
  { "date": "2024-01-17", "count": 38 }
]
```

#### GET /admin/charts/messages
Get daily message counts.

**Query Parameters:**
- `days` (optional): Number of days to include (default: 30, max: 365)

**Response:**
```json
[
  { "date": "2024-01-15", "count": 280 },
  { "date": "2024-01-16", "count": 310 },
  { "date": "2024-01-17", "count": 225 }
]
```

#### GET /admin/charts/user-activity-heatmap
Get user activity patterns by hour and day for heatmap visualization.

**Response:**
```json
[
  { "hour": 0, "day": 0, "count": 5 },
  { "hour": 1, "day": 0, "count": 2 },
  { "hour": 9, "day": 1, "count": 45 },
  { "hour": 14, "day": 1, "count": 52 }
]
```

**Day mapping:** 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday

#### GET /admin/charts/user-growth-trend
Get monthly user growth data showing new registrations and cumulative totals.

**Query Parameters:**
- `months` (optional): Number of months to include (default: 12, max: 24)

**Response:**
```json
[
  { "month": "2023-02", "newUsers": 45, "totalUsers": 145 },
  { "month": "2023-03", "newUsers": 52, "totalUsers": 197 },
  { "month": "2023-04", "newUsers": 38, "totalUsers": 235 }
]
```

#### GET /admin/charts/top-active-users
Get most active users ranked by activity.

**Query Parameters:**
- `limit` (optional): Number of top users to return (default: 10, max: 50)

**Response:**
```json
[
  {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user",
      "is_active": true
    },
    "messageCount": 150,
    "conversationCount": 25,
    "lastActivity": "2024-01-17T10:30:00Z"
  }
]
```

#### GET /admin/charts/combined-metrics
Get multiple chart datasets in a single request for dashboard efficiency.

**Query Parameters:**
- `days` (optional): Number of days to include (default: 30, max: 365)

**Response:**
```json
{
  "timeRange": {
    "days": 30,
    "startDate": "2023-12-18",
    "endDate": "2024-01-17"
  },
  "charts": {
    "userRegistrations": [
      { "date": "2024-01-15", "count": 5 }
    ],
    "activeUsers": [
      { "date": "2024-01-15", "count": 120 }
    ],
    "conversations": [
      { "date": "2024-01-15", "count": 45 }
    ],
    "messages": [
      { "date": "2024-01-15", "count": 280 }
    ]
  },
  "summary": {
    "totalNewUsers": 125,
    "avgDailyActiveUsers": 118,
    "totalConversations": 1350,
    "totalMessages": 8500
  }
}
```

### User Management

#### GET /admin/users
Get paginated list of all users with their basic information.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)

**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "picture": "https://...",
      "role": "user",
      "is_active": true,
      "last_login_at": "2024-01-15T10:30:00Z",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 10,
  "totalPages": 15
}
```

#### GET /admin/users/:id
Get detailed information about a specific user including activity statistics.

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "user",
  "is_active": true,
  "last_login_at": "2024-01-15T10:30:00Z",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-15T10:30:00Z",
  "activity": {
    "conversations": 25,
    "messages": 150,
    "documents": 8,
    "lastActive": "2024-01-15T10:30:00Z"
  }
}
```

#### PUT /admin/users/:id/role
Update a user's role between 'user' and 'admin'.

**Request Body:**
```json
{
  "role": "admin"
}
```

#### PUT /admin/users/:id/status
Activate or deactivate a user account.

**Request Body:**
```json
{
  "is_active": false
}
```

#### DELETE /admin/users/:id
Permanently delete a user account and all associated data. Cannot delete admin users.

**Response:**
```json
{
  "message": "User and all associated data deleted successfully"
}
```

#### GET /admin/users/:id/activity
Get detailed activity information for a specific user.

### Conversation Management

#### GET /admin/conversations
Get paginated list of all conversations with user information.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)

**Response:**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "title": "Conversation Title",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T12:00:00Z",
      "users": {
        "id": "uuid",
        "email": "user@example.com",
        "name": "John Doe",
        "picture": "https://..."
      }
    }
  ],
  "total": 850,
  "page": 1,
  "limit": 10,
  "totalPages": 85
}
```

### Statistics Endpoints

#### GET /admin/stats/users
Get detailed user registration and activity statistics.

#### GET /admin/stats/conversations
Get conversation creation statistics over different time periods.

#### GET /admin/stats/messages
Get message sending statistics over different time periods.

### System Management

#### GET /admin/health
Check system health status and component availability.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "components": {
    "database": {
      "status": "healthy",
      "response_time_ms": 50,
      "connection_pool": "active"
    },
    "api": {
      "status": "healthy",
      "uptime_seconds": 86400,
      "memory_usage": {
        "rss": 50331648,
        "heapTotal": 29360128,
        "heapUsed": 20478936
      }
    },
    "authentication": {
      "status": "healthy",
      "provider": "google_oauth"
    }
  },
  "metrics": {
    "total_users": 150,
    "active_users": 120,
    "system_load": "normal"
  }
}
```

### Advanced Features

#### POST /admin/users/:id/impersonate
Generate an impersonation token for support purposes (use with extreme caution).

**Response:**
```json
{
  "message": "Impersonation logged. In production, this would return a special JWT token.",
  "targetUser": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "warning": "This is a sensitive action that has been logged."
}
```

#### GET /admin/audit/recent-actions
Get recent administrative actions for audit purposes.

## Error Responses

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Admin access required",
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "User not found",
  "error": "Not Found"
}
```

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Cannot delete admin users",
  "error": "Bad Request"
}
```

## Rate Limiting

Admin endpoints are subject to the same rate limiting as other API endpoints:
- 100 requests per minute per IP address

## Security Considerations

1. **Admin Role Management**: Only grant admin roles to trusted users
2. **Audit Logging**: All admin actions are logged for security auditing
3. **Impersonation**: The impersonation feature should be used only for support purposes and is heavily logged
4. **Data Deletion**: User deletion is permanent and irreversible
5. **Account Deactivation**: Prefer deactivating accounts over deletion when possible

## Implementation Notes

### Creating Your First Admin User

To create your first admin user, you'll need to manually update the database:

```sql
-- Update an existing user to admin role
UPDATE users 
SET role = 'admin' 
WHERE email = 'your-admin-email@example.com';
```

### Frontend Integration

The admin dashboard frontend should:

1. Check user role on login
2. Redirect non-admin users away from admin routes
3. Handle token refresh for long admin sessions
4. Implement proper error handling for API responses
5. Show confirmation dialogs for destructive actions (delete user, etc.)

### Monitoring and Alerts

Consider implementing alerts for:
- High number of failed admin API requests
- Admin user creation/deletion
- System health degradation
- Unusual admin activity patterns

## Example Frontend Usage

### Basic Admin Operations

```javascript
// Check if user is admin
const checkAdminAccess = (user) => {
  return user.role === 'admin' && user.is_active;
};

// Fetch dashboard stats
const fetchDashboardStats = async () => {
  const response = await fetch('/admin/dashboard/stats', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
};

// Update user role
const updateUserRole = async (userId, newRole) => {
  const response = await fetch(`/admin/users/${userId}/role`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ role: newRole })
  });
  return response.json();
};
```

### Chart Data Integration

```javascript
// Fetch chart data for React/Chart.js
const fetchUserRegistrationChart = async (days = 30) => {
  const response = await fetch(`/admin/charts/user-registrations?days=${days}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  
  // Transform for Chart.js
  return {
    labels: data.map(point => point.date),
    datasets: [{
      label: 'User Registrations',
      data: data.map(point => point.count),
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
    }]
  };
};

// Fetch combined metrics for dashboard
const fetchDashboardCharts = async (days = 30) => {
  const response = await fetch(`/admin/charts/combined-metrics?days=${days}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};

// Fetch heatmap data for activity visualization
const fetchActivityHeatmap = async () => {
  const response = await fetch('/admin/charts/user-activity-heatmap', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  
  // Transform for heatmap library (e.g., react-heatmap-grid)
  const matrix = Array(7).fill().map(() => Array(24).fill(0));
  data.forEach(point => {
    matrix[point.day][point.hour] = point.count;
  });
  return matrix;
};

// Example React hook for chart data
const useChartData = (endpoint, params = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const queryString = new URLSearchParams(params).toString();
        const url = `/admin/charts/${endpoint}${queryString ? `?${queryString}` : ''}`;
        
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to fetch chart data');
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [endpoint, JSON.stringify(params)]);

  return { data, loading, error };
};

// Usage in React component
const DashboardCharts = () => {
  const { data: userRegistrations, loading } = useChartData('user-registrations', { days: 30 });
  const { data: activeUsers } = useChartData('active-users', { days: 30 });
  const { data: heatmapData } = useChartData('user-activity-heatmap');

  if (loading) return <div>Loading charts...</div>;

  return (
    <div className="dashboard-charts">
      <LineChart data={userRegistrations} />
      <LineChart data={activeUsers} />
      <HeatMap data={heatmapData} />
    </div>
  );
};
```

### Pagination Helper

```javascript
// Helper for paginated admin endpoints
const usePaginatedData = (endpoint, pageSize = 10) => {
  const [data, setData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchPage = async (page) => {
    setLoading(true);
    try {
      const response = await fetch(`/admin/${endpoint}?page=${page}&limit=${pageSize}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      
      setData(result[Object.keys(result)[0]]); // users, conversations, etc.
      setCurrentPage(page);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage(1);
  }, [endpoint]);

  return {
    data,
    currentPage,
    totalPages,
    loading,
    goToPage: fetchPage,
    nextPage: () => currentPage < totalPages && fetchPage(currentPage + 1),
    prevPage: () => currentPage > 1 && fetchPage(currentPage - 1)
  };
};
```

## Testing

Use tools like Postman or curl to test admin endpoints:

```bash
# Get dashboard stats
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     http://localhost:3000/admin/dashboard/stats

# Get users list
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     "http://localhost:3000/admin/users?page=1&limit=10"

# Update user role
curl -X PUT \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"role":"admin"}' \
     http://localhost:3000/admin/users/USER_ID/role
```