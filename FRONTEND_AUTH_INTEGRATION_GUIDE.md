# Frontend Authentication Integration Guide - Next.js 15 App Router

## Overview
This guide explains how to integrate Google OAuth authentication with the backend API for accessing Google services (Sheets, Docs, Gmail, Drive) using Next.js 15 App Router.

## Authentication Flow

### 1. Initiate Authentication
Redirect users to the backend OAuth endpoint:
```javascript
// In a client component or server action
window.location.href = 'http://localhost:3000/api/auth/google';
```

### 2. Handle OAuth Callback
The backend will redirect to your frontend callback route with URL parameters:
```
http://localhost:3001/auth/callback?token=JWT_TOKEN&user=ENCODED_USER_DATA
```

### 3. Create Callback Page - `/app/auth/callback/page.tsx`
```typescript
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const jwtToken = searchParams.get('token');
    const encodedUserData = searchParams.get('user');
    const error = searchParams.get('error');
    const reason = searchParams.get('reason');

    if (jwtToken && encodedUserData) {
      // Success - store authentication data
      const userData = JSON.parse(decodeURIComponent(encodedUserData));
      
      // Store JWT token for API requests
      localStorage.setItem('jwt_token', jwtToken);
      localStorage.setItem('user_data', JSON.stringify(userData));
      
      // Redirect to main app
      router.push('/dashboard');
    } else if (error) {
      console.error('Authentication failed:', error, reason);
      // Handle error (show message, redirect to login, etc.)
      router.push(`/login?error=${error}&reason=${reason}`);
    }
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Processing authentication...</p>
      </div>
    </div>
  );
}
```

## Making Authenticated API Requests

### 1. Include JWT Token in Headers
```javascript
const jwtToken = localStorage.getItem('jwt_token');

fetch('http://localhost:3000/api/agent/chat', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: 'Your message here',
    conversationId: 'optional-conversation-id'
  })
});
```

### 2. Handle Token Expiration
```javascript
// Check if request fails with 401
fetch(url, options)
  .then(response => {
    if (response.status === 401) {
      // JWT token expired, redirect to login
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('user_data');
      window.location.href = '/login';
      return;
    }
    return response.json();
  });
```

## Token Management

### 1. Check Authentication Status
```javascript
function isAuthenticated() {
  const token = localStorage.getItem('jwt_token');
  return !!token;
}
```

### 2. Get User Profile
```javascript
async function getUserProfile() {
  const token = localStorage.getItem('jwt_token');
  
  const response = await fetch('http://localhost:3000/api/auth/profile', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (response.ok) {
    return await response.json();
  } else {
    throw new Error('Failed to get user profile');
  }
}
```

### 3. Refresh JWT Token
```javascript
async function refreshJwtToken() {
  const token = localStorage.getItem('jwt_token');
  
  const response = await fetch('http://localhost:3000/api/auth/refresh-jwt-token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (response.ok) {
    const data = await response.json();
    localStorage.setItem('jwt_token', data.access_token);
    return data.access_token;
  } else {
    throw new Error('Failed to refresh JWT token');
  }
}
```

## Google Token Management

### 1. Check Google Token Status
```javascript
async function checkGoogleTokenStatus() {
  const token = localStorage.getItem('jwt_token');
  
  const response = await fetch('http://localhost:3000/api/auth/token-status', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (response.ok) {
    const status = await response.json();
    return status; // { isValid, isExpiringSoon, expiresAt, needsRefresh }
  }
}
```

### 2. Refresh Google Access Token
```javascript
async function refreshGoogleToken() {
  const token = localStorage.getItem('jwt_token');
  
  const response = await fetch('http://localhost:3000/api/auth/refresh-google-token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (response.ok) {
    const data = await response.json();
    // Token refreshed automatically on backend
    return data; // { access_token, expires_at, expires_in }
  } else {
    throw new Error('Failed to refresh Google token');
  }
}
```

## Next.js 15 App Router Authentication Hook

### Create `/hooks/useAuth.ts`
```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    const userData = localStorage.getItem('user_data');
    
    if (token && userData) {
      setIsAuthenticated(true);
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const login = () => {
    window.location.href = 'http://localhost:3000/api/auth/google';
  };

  const logout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_data');
    setIsAuthenticated(false);
    setUser(null);
    router.push('/login');
  };

  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('jwt_token');
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      logout(); // Auto-logout on unauthorized
      throw new Error('Authentication required');
    }

    return response;
  };

  return {
    isAuthenticated,
    user,
    loading,
    login,
    logout,
    makeAuthenticatedRequest
  };
}
```

### Create Login Page - `/app/login/page.tsx`
```typescript
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const reason = searchParams.get('reason');

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = '/dashboard';
    }
  }, [isAuthenticated]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600">Authentication failed: {reason || error}</p>
            </div>
          )}
        </div>
        <div>
          <button
            onClick={login}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Create Protected Route Component - `/components/ProtectedRoute.tsx`
```typescript
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = '/login';
    }
  }, [isAuthenticated, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return <>{children}</>;
}
```

### Example Dashboard Page - `/app/dashboard/page.tsx`
```typescript
'use client';

import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useState } from 'react';

export default function Dashboard() {
  const { user, logout, makeAuthenticatedRequest } = useAuth();
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!message.trim()) return;
    
    setLoading(true);
    try {
      const res = await makeAuthenticatedRequest('http://localhost:3000/api/agent/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: message.trim(),
        })
      });
      
      const data = await res.json();
      setResponse(data.response);
    } catch (error) {
      console.error('Chat error:', error);
      setResponse('Error: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="flex items-center space-x-4">
            <span>Welcome, {user?.name}</span>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="w-full p-3 border border-gray-300 rounded-md"
              rows={4}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={loading || !message.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Message'}
          </button>
          {response && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
              <pre className="whitespace-pre-wrap">{response}</pre>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
```

## Error Handling

### Common Error Scenarios
1. **Authentication Failed**: User denied OAuth consent or credentials invalid
2. **Token Expired**: JWT token needs refresh or re-authentication required
3. **Google Token Expired**: Automatic refresh happens on backend, but may fail
4. **Network Errors**: Handle connection issues gracefully

### Error Response Format
```javascript
// URL parameters on error
// ?error=auth_failed&reason=no_user
// ?error=auth_failed&reason=token_generation_failed

const error = urlParams.get('error');
const reason = urlParams.get('reason');

switch (error) {
  case 'auth_failed':
    console.error('Authentication failed:', reason);
    // Show error message to user
    break;
  default:
    console.error('Unknown error:', error);
}
```

## Security Considerations

1. **Store JWT tokens securely**: Use `localStorage` for demo purposes, consider `httpOnly` cookies for production
2. **HTTPS in production**: Ensure all authentication flows use HTTPS
3. **Token expiration**: JWT tokens expire in 24 hours, implement refresh logic
4. **Google token management**: Backend handles Google token refresh automatically
5. **Cross-origin requests**: Ensure CORS is properly configured for your domain

## Environment Variables Required

Frontend should be configured to point to:
- Backend API: `http://localhost:3000` (development)  
- Frontend URL: `http://localhost:3001` (development)

The backend handles all Google OAuth configuration internally.

## Key Points for Next.js 15 App Router

1. **Use 'use client' directive** for components that use React hooks or browser APIs
2. **useSearchParams hook** replaces query string parsing in App Router
3. **useRouter from next/navigation** for programmatic navigation
4. **File-based routing** - create pages in `/app` directory
5. **TypeScript support** - Use proper typing for better development experience
6. **Client-side storage** - localStorage for JWT tokens (consider httpOnly cookies for production)

## Quick Setup Checklist

1. ✅ Create `/app/auth/callback/page.tsx` for OAuth callback handling
2. ✅ Create `/hooks/useAuth.ts` for authentication state management  
3. ✅ Create `/app/login/page.tsx` for login UI
4. ✅ Create `/components/ProtectedRoute.tsx` for route protection
5. ✅ Create `/app/dashboard/page.tsx` for authenticated user interface
6. ✅ Update backend `.env` with `FRONTEND_URL=http://localhost:3001`
7. ✅ Ensure backend is running on port 3000, frontend on port 3001
8. ✅ Test OAuth flow end-to-end