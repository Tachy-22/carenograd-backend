# Frontend Integration Guide - Dynamic Allocation System

## Overview

The new dynamic allocation system changes how quotas work. Instead of fixed limits, users get a portion of the total 3,000 daily requests based on how many users are active.

## 🔄 **API Endpoint Changes**

### **New Allocation Endpoints**

Replace old quota endpoints with these new dynamic allocation endpoints:

```typescript
// OLD: Fixed quota check
GET /agent/tokens/quota-status

// NEW: Dynamic allocation check  
GET /agent/allocation/daily
GET /agent/allocation/can-request
GET /agent/allocation/system-overview
```

### **Updated Response Format**

**Old Quota Response:**
```json
{
  "allocatedTokensPerMinute": 1000,
  "tokensUsedCurrentMinute": 250,
  "requestsRemainingCurrentMinute": 5,
  "warningLevel": "MEDIUM"
}
```

**New Dynamic Allocation Response:**
```json
{
  "userId": "user123",
  "modelName": "gemini-2.5-flash",
  "allocatedRequestsToday": 60,
  "requestsUsedToday": 25,
  "requestsRemainingToday": 35,
  "allocationPercentageUsed": 41.67,
  "canMakeRequest": true,
  "activeUsersCount": 50,
  "allocationMessage": "✅ 35/60 requests remaining today. Shared among 50 active users.",
  "warningLevel": "LOW",
  "shouldWarn": false
}
```

## 📊 **Frontend Components to Update**

### **1. Quota Display Component**

Create a new component for dynamic allocation display:

```typescript
// components/AllocationDisplay.tsx
import { useEffect, useState } from 'react';

interface AllocationData {
  allocatedRequestsToday: number;
  requestsUsedToday: number;
  requestsRemainingToday: number;
  allocationPercentageUsed: number;
  activeUsersCount: number;
  allocationMessage: string;
  warningLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  shouldWarn: boolean;
}

export function AllocationDisplay() {
  const [allocation, setAllocation] = useState<AllocationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllocation();
    // Refresh every 30 seconds to show real-time updates
    const interval = setInterval(fetchAllocation, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAllocation = async () => {
    try {
      const response = await fetch('/api/agent/allocation/daily', {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      const data = await response.json();
      setAllocation(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch allocation:', error);
      setLoading(false);
    }
  };

  if (loading) return <div>Loading allocation...</div>;
  if (!allocation) return <div>Unable to load allocation</div>;

  const getStatusColor = (warningLevel: string) => {
    switch (warningLevel) {
      case 'CRITICAL': return 'text-red-600 bg-red-50';
      case 'HIGH': return 'text-orange-600 bg-orange-50';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-green-600 bg-green-50';
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800">Daily Usage</h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(allocation.warningLevel)}`}>
          {allocation.warningLevel}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Requests Used</span>
          <span>{allocation.requestsUsedToday}/{allocation.allocatedRequestsToday}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(allocation.allocationPercentageUsed)}`}
            style={{ width: `${Math.min(allocation.allocationPercentageUsed, 100)}%` }}
          ></div>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {allocation.allocationPercentageUsed.toFixed(1)}% used
        </div>
      </div>

      {/* Allocation Message */}
      <div className="text-sm text-gray-700 mb-3">
        {allocation.allocationMessage}
      </div>

      {/* Active Users Info */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Active users today: {allocation.activeUsersCount}</span>
        <span>Remaining: {allocation.requestsRemainingToday}</span>
      </div>

      {/* Warning Alert */}
      {allocation.shouldWarn && (
        <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800">
          ⚠️ You're approaching your daily limit. Your allocation may increase if fewer users are active.
        </div>
      )}
    </div>
  );
}
```

### **2. Pre-Request Check Hook**

Create a hook to check allocation before making requests:

```typescript
// hooks/useAllocationCheck.ts
import { useState, useCallback } from 'react';

interface AllocationCheck {
  allowed: boolean;
  reason?: string;
  allocation?: any;
}

export function useAllocationCheck() {
  const [checking, setChecking] = useState(false);

  const checkAllocation = useCallback(async (): Promise<AllocationCheck> => {
    setChecking(true);
    try {
      const response = await fetch('/api/agent/allocation/can-request', {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      const result = await response.json();
      return result;
    } catch (error) {
      return {
        allowed: false,
        reason: 'Failed to check allocation'
      };
    } finally {
      setChecking(false);
    }
  }, []);

  return { checkAllocation, checking };
}
```

### **3. Chat Interface Updates**

Update your chat interface to show allocation status:

```typescript
// components/ChatInterface.tsx
import { AllocationDisplay } from './AllocationDisplay';
import { useAllocationCheck } from '../hooks/useAllocationCheck';

export function ChatInterface() {
  const { checkAllocation } = useAllocationCheck();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async () => {
    // Check allocation before sending
    const allocationCheck = await checkAllocation();
    
    if (!allocationCheck.allowed) {
      alert(allocationCheck.reason || 'Daily request limit exceeded');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ message })
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.code === 'DAILY_LIMIT_EXCEEDED') {
          alert(error.message);
          return;
        }
        throw new Error('Failed to send message');
      }

      const result = await response.json();
      // Handle successful response
      console.log(result);
      
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Allocation Display at top */}
      <div className="p-4 border-b">
        <AllocationDisplay />
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Your chat messages here */}
      </div>

      {/* Input area */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            className="flex-1 px-3 py-2 border rounded-md"
            placeholder="Type your message..."
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !message.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### **4. Admin Dashboard (Optional)**

For admins, create a system overview dashboard:

```typescript
// components/AdminDashboard.tsx
import { useEffect, useState } from 'react';

export function AdminDashboard() {
  const [systemStats, setSystemStats] = useState(null);

  useEffect(() => {
    fetchSystemStats();
    const interval = setInterval(fetchSystemStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchSystemStats = async () => {
    try {
      const response = await fetch('/api/agent/allocation/system-overview', {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      const data = await response.json();
      setSystemStats(data[0]); // Get gemini-2.5-flash stats
    } catch (error) {
      console.error('Failed to fetch system stats:', error);
    }
  };

  if (!systemStats) return <div>Loading system stats...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-2">Total Capacity</h3>
        <p className="text-2xl font-bold text-blue-600">{systemStats.totalRequestsAvailable}</p>
        <p className="text-sm text-gray-600">Daily requests available</p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-2">Usage Today</h3>
        <p className="text-2xl font-bold text-green-600">
          {systemStats.totalRequestsUsed} / {systemStats.totalRequestsAvailable}
        </p>
        <p className="text-sm text-gray-600">{systemStats.systemUsagePercentage.toFixed(1)}% used</p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-2">Active Users</h3>
        <p className="text-2xl font-bold text-purple-600">{systemStats.activeUsersCount}</p>
        <p className="text-sm text-gray-600">{systemStats.requestsPerUser} requests per user</p>
      </div>
    </div>
  );
}
```

## 🚀 **Key Changes Summary**

### **Replace These Endpoints:**
- ❌ `GET /agent/tokens/quota-status` 
- ✅ `GET /agent/allocation/daily`

### **Update Your Frontend To:**
1. **Show dynamic allocation** instead of fixed quotas
2. **Display active user count** and how it affects allocation  
3. **Real-time updates** every 30 seconds
4. **Pre-request checks** to prevent failed requests
5. **User-friendly messages** explaining the dynamic system

### **New User Experience:**
- **Early users**: See "🚀 You're the only active user today! Enjoy 3000 requests"
- **Normal usage**: See "✅ 35/60 requests remaining today. Shared among 50 active users" 
- **Near limit**: See "⚠️ You're approaching your daily limit. Your allocation may increase if fewer users are active"

The frontend now provides a much better user experience that explains the dynamic allocation system and encourages users to understand how their usage affects and is affected by other users! 🎯