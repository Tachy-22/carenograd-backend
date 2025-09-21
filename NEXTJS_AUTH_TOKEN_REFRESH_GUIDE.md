# 🔐 Next.js 15 App Router Token Refresh Implementation Guide

## 🎯 Problem Solved
Your Google OAuth tokens expire every **1 hour**, causing frontend breakage. This guide provides a complete solution for automatic token refresh in Next.js 15 App Router.

## 🏗️ Architecture Overview

```
Frontend Request → Check Token → Refresh if Needed → Make API Call
     ↓               ↓              ↓                 ↓
Next.js App    → Auth Context → Token Refresh → Backend API
```

## 📁 File Structure

```
src/
├── app/
│   ├── auth/
│   │   └── callback/
│   │       └── page.tsx
│   └── layout.tsx
├── lib/
│   ├── auth/
│   │   ├── auth-context.tsx
│   │   ├── auth-provider.tsx
│   │   └── token-manager.ts
│   └── api/
│       ├── client.ts
│       └── auth-interceptor.ts
└── hooks/
    └── use-auth.ts
```

## 🔧 Implementation

### 1. Token Manager (`src/lib/auth/token-manager.ts`)

```typescript
interface TokenData {
  access_token: string;
  expires_at: string;
  token_type: 'Bearer';
}

interface UserData {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export class TokenManager {
  private static readonly TOKEN_KEY = 'auth_token';
  private static readonly USER_KEY = 'user_data';
  private static readonly REFRESH_BUFFER = 5 * 60 * 1000; // 5 minutes

  static setTokens(tokenData: TokenData, userData: UserData): void {
    if (typeof window === 'undefined') return;
    
    localStorage.setItem(this.TOKEN_KEY, JSON.stringify(tokenData));
    localStorage.setItem(this.USER_KEY, JSON.stringify(userData));
  }

  static getToken(): string | null {
    if (typeof window === 'undefined') return null;
    
    const tokenData = this.getTokenData();
    return tokenData?.access_token || null;
  }

  static getTokenData(): TokenData | null {
    if (typeof window === 'undefined') return null;
    
    const tokenStr = localStorage.getItem(this.TOKEN_KEY);
    return tokenStr ? JSON.parse(tokenStr) : null;
  }

  static getUserData(): UserData | null {
    if (typeof window === 'undefined') return null;
    
    const userStr = localStorage.getItem(this.USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  static isTokenExpired(): boolean {
    const tokenData = this.getTokenData();
    if (!tokenData?.expires_at) return true;

    const expirationTime = new Date(tokenData.expires_at).getTime();
    const currentTime = Date.now();
    
    return currentTime >= expirationTime;
  }

  static shouldRefreshToken(): boolean {
    const tokenData = this.getTokenData();
    if (!tokenData?.expires_at) return true;

    const expirationTime = new Date(tokenData.expires_at).getTime();
    const currentTime = Date.now();
    
    // Refresh if token expires within 5 minutes
    return currentTime >= (expirationTime - this.REFRESH_BUFFER);
  }

  static clearTokens(): void {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  static async refreshToken(): Promise<boolean> {
    try {
      const currentToken = this.getToken();
      if (!currentToken) return false;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh-jwt-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const newTokenData: TokenData = await response.json();
      const userData = this.getUserData();
      
      if (userData) {
        this.setTokens(newTokenData, userData);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      this.clearTokens();
      return false;
    }
  }
}
```

### 2. Auth Context (`src/lib/auth/auth-context.tsx`)

```typescript
'use client';

import { createContext, useContext, ReactNode } from 'react';

interface AuthContextType {
  user: UserData | null;
  token: string | null;
  login: (token: string, user: UserData) => void;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { AuthContext };
```

### 3. Auth Provider (`src/lib/auth/auth-provider.tsx`)

```typescript
'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContext } from './auth-context';
import { TokenManager } from './token-manager';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Initialize auth state from localStorage
    const savedUser = TokenManager.getUserData();
    const savedToken = TokenManager.getToken();
    
    if (savedUser && savedToken && !TokenManager.isTokenExpired()) {
      setUser(savedUser);
      setToken(savedToken);
    } else if (savedToken && TokenManager.isTokenExpired()) {
      // Token expired, try to refresh
      handleTokenRefresh();
    }
    
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Set up periodic token refresh check
    const interval = setInterval(() => {
      if (user && TokenManager.shouldRefreshToken()) {
        handleTokenRefresh();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [user]);

  const handleTokenRefresh = async () => {
    const success = await TokenManager.refreshToken();
    if (success) {
      const newUser = TokenManager.getUserData();
      const newToken = TokenManager.getToken();
      setUser(newUser);
      setToken(newToken);
    } else {
      // Refresh failed, logout user
      logout();
    }
  };

  const login = (newToken: string, newUser: UserData) => {
    const tokenData: TokenData = {
      access_token: newToken,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      token_type: 'Bearer'
    };
    
    TokenManager.setTokens(tokenData, newUser);
    setUser(newUser);
    setToken(newToken);
  };

  const logout = () => {
    TokenManager.clearTokens();
    setUser(null);
    setToken(null);
    router.push('/');
  };

  const refreshToken = async (): Promise<boolean> => {
    const success = await handleTokenRefresh();
    return success;
  };

  const value = {
    user,
    token,
    login,
    logout,
    refreshToken,
    isAuthenticated: !!user && !!token,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
```

### 4. API Client with Auto-Refresh (`src/lib/api/client.ts`)

```typescript
import { TokenManager } from '../auth/token-manager';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  skipRefresh?: boolean;
}

class ApiClient {
  private baseURL: string;
  private refreshPromise: Promise<boolean> | null = null;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  private async makeRequest(
    endpoint: string, 
    options: RequestOptions = {}
  ): Promise<Response> {
    const { skipAuth = false, skipRefresh = false, ...requestOptions } = options;

    // Add auth header if not skipped
    if (!skipAuth) {
      await this.ensureValidToken(skipRefresh);
      
      const token = TokenManager.getToken();
      if (token) {
        requestOptions.headers = {
          ...requestOptions.headers,
          'Authorization': `Bearer ${token}`,
        };
      }
    }

    // Add default headers
    requestOptions.headers = {
      'Content-Type': 'application/json',
      ...requestOptions.headers,
    };

    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, requestOptions);

    // Handle 401 responses with automatic retry
    if (response.status === 401 && !skipRefresh && !skipAuth) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        // Retry the request with new token
        return this.makeRequest(endpoint, { ...options, skipRefresh: true });
      } else {
        // Refresh failed, redirect to login
        TokenManager.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
        throw new Error('Authentication failed');
      }
    }

    return response;
  }

  private async ensureValidToken(skipRefresh: boolean = false): Promise<void> {
    if (skipRefresh) return;

    if (TokenManager.shouldRefreshToken()) {
      await this.refreshToken();
    }
  }

  private async refreshToken(): Promise<boolean> {
    // Prevent multiple simultaneous refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = TokenManager.refreshToken();
    const result = await this.refreshPromise;
    this.refreshPromise = null;
    
    return result;
  }

  // Public API methods
  async get(endpoint: string, options: RequestOptions = {}): Promise<Response> {
    return this.makeRequest(endpoint, { ...options, method: 'GET' });
  }

  async post(endpoint: string, data?: any, options: RequestOptions = {}): Promise<Response> {
    return this.makeRequest(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put(endpoint: string, data?: any, options: RequestOptions = {}): Promise<Response> {
    return this.makeRequest(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete(endpoint: string, options: RequestOptions = {}): Promise<Response> {
    return this.makeRequest(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
```

### 5. Auth Callback Page (`src/app/auth/callback/page.tsx`)

```typescript
'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const userParam = searchParams.get('user');

    if (token && userParam) {
      try {
        const userData = JSON.parse(decodeURIComponent(userParam));
        login(token, userData);
        router.push('/dashboard'); // Redirect to your main app
      } catch (error) {
        console.error('Failed to parse user data:', error);
        router.push('/?error=auth_failed');
      }
    } else {
      router.push('/?error=missing_token');
    }
  }, [searchParams, login, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
```

### 6. Root Layout (`src/app/layout.tsx`)

```typescript
import { AuthProvider } from '@/lib/auth/auth-provider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### 7. Custom Hook (`src/hooks/use-auth.ts`)

```typescript
import { useAuth as useAuthContext } from '@/lib/auth/auth-context';

// Re-export for convenience
export const useAuth = useAuthContext;

// Additional auth utilities
export function useRequireAuth() {
  const auth = useAuthContext();
  
  if (!auth.isAuthenticated) {
    throw new Error('Authentication required');
  }
  
  return auth;
}
```

## 🚀 Usage Examples

### Making API Calls

```typescript
'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/hooks/use-auth';

export function ChatComponent() {
  const [messages, setMessages] = useState([]);
  const { isAuthenticated } = useAuth();

  const sendMessage = async (message: string) => {
    try {
      const response = await apiClient.post('/agent/chat', { message });
      const data = await response.json();
      setMessages(prev => [...prev, data]);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center p-8">
        <a href={`${process.env.NEXT_PUBLIC_API_URL}/auth/google`}
           className="bg-blue-600 text-white px-6 py-3 rounded-lg">
          Login with Google
        </a>
      </div>
    );
  }

  return (
    <div>
      {/* Your chat component */}
    </div>
  );
}
```

### Protected Routes

```typescript
'use client';

import { useAuth } from '@/hooks/use-auth';
import { redirect } from 'next/navigation';

export function ProtectedPage() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    redirect('/');
    return null;
  }

  return (
    <div>
      <h1>Welcome, {user?.name}!</h1>
      {/* Protected content */}
    </div>
  );
}
```

## 🔄 How It Works

1. **Initial Login**: User clicks login → Goes to backend `/auth/google` → Redirects to frontend `/auth/callback` with token
2. **Token Storage**: Frontend stores JWT and user data in localStorage
3. **Automatic Refresh**: 
   - Token Manager checks expiration before each request
   - Refreshes automatically if expires within 5 minutes
   - API client retries failed requests after refresh
4. **Seamless UX**: User never sees token expiration errors

## ⚡ Key Features

- ✅ **Automatic token refresh** before expiration
- ✅ **Retry failed requests** after refresh  
- ✅ **Graceful logout** if refresh fails
- ✅ **Periodic background checks** for token health
- ✅ **No manual token management** required
- ✅ **Type-safe** with TypeScript

## 🔧 Configuration

Add to your `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 🎯 Result

Your frontend will **never break** due to token expiration again! The system automatically:
- Detects expiring tokens
- Refreshes them in the background  
- Retries failed requests
- Provides seamless user experience

No more logout/login cycles! 🎉