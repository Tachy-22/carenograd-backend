# Next.js Frontend Auth Integration Guide

## 📋 **Overview**
Complete integration guide for implementing seamless Google OAuth authentication with automatic token refresh in your Next.js frontend. This system ensures users never experience authentication interruptions while using your application.

---

## 🚀 **Quick Setup**

### 1. Install Dependencies
```bash
npm install @next/auth
# OR if using custom auth
npm install axios js-cookie
```

### 2. Environment Variables
```env
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-secret-key

# For custom auth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

---

## 🔐 **Authentication Implementation Options**

### Option A: NextAuth.js (Recommended)

#### Setup NextAuth.js

**`pages/api/auth/[...nextauth].ts`**
```typescript
import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/gmail.compose',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Persist Google access token and refresh token
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.accessTokenExpires = account.expires_at
      }

      // Return previous token if the access token has not expired yet
      if (Date.now() < token.accessTokenExpires) {
        return token
      }

      // Access token has expired, try to refresh it
      return await refreshAccessToken(token)
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      return session
    },
  },
})

async function refreshAccessToken(token: any) {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      throw refreshedTokens
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    }
  } catch (error) {
    console.error('Error refreshing access token:', error)
    return { ...token, error: 'RefreshAccessTokenError' }
  }
}
```

#### Auth Context Provider

**`contexts/AuthContext.tsx`**
```typescript
'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import axios from 'axios'

interface AuthContextType {
  user: any
  loading: boolean
  apiCall: (config: any) => Promise<any>
  refreshToken: () => Promise<void>
  isTokenExpiring: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [isTokenExpiring, setIsTokenExpiring] = useState(false)

  // Automatic token refresh check
  useEffect(() => {
    if (session?.accessToken) {
      const checkTokenExpiration = () => {
        const tokenExpiry = session.expires ? new Date(session.expires).getTime() : 0
        const now = Date.now()
        const fiveMinutes = 5 * 60 * 1000

        if (tokenExpiry - now < fiveMinutes) {
          setIsTokenExpiring(true)
        }
      }

      checkTokenExpiration()
      const interval = setInterval(checkTokenExpiration, 60000) // Check every minute

      return () => clearInterval(interval)
    }
  }, [session])

  const apiCall = async (config: any) => {
    if (!session?.accessToken) {
      throw new Error('Not authenticated')
    }

    try {
      return await axios({
        ...config,
        headers: {
          ...config.headers,
          Authorization: `Bearer ${session.accessToken}`,
        },
        baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
      })
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // Token might be expired, try to refresh
        await refreshToken()
        
        // Retry the request with new token
        return await axios({
          ...config,
          headers: {
            ...config.headers,
            Authorization: `Bearer ${session.accessToken}`,
          },
          baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
        })
      }
      throw error
    }
  }

  const refreshToken = async () => {
    try {
      // NextAuth handles token refresh automatically
      // Force session update
      await fetch('/api/auth/session?update')
    } catch (error) {
      console.error('Token refresh failed:', error)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user: session?.user,
        loading: status === 'loading',
        apiCall,
        refreshToken,
        isTokenExpiring,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
```

---

### Option B: Custom Auth Implementation

#### Custom Auth Hook

**`hooks/useAuth.ts`**
```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import Cookies from 'js-cookie'

interface TokenInfo {
  accessToken: string
  expiresAt: Date
  isExpiringSoon: boolean
}

interface User {
  id: string
  email: string
  name: string
  picture?: string
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'

  // Initialize auth state from cookies
  useEffect(() => {
    const jwtToken = Cookies.get('jwt_token')
    if (jwtToken) {
      checkTokenStatus(jwtToken)
    } else {
      setLoading(false)
    }
  }, [])

  // Check token status and refresh if needed
  const checkTokenStatus = async (jwtToken: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/auth/token-status`, {
        headers: { Authorization: `Bearer ${jwtToken}` }
      })

      if (response.data.needsRefresh) {
        await refreshGoogleToken(jwtToken)
      }

      // Get user profile
      const profileResponse = await axios.get(`${API_BASE_URL}/auth/profile`, {
        headers: { Authorization: `Bearer ${jwtToken}` }
      })

      setUser(profileResponse.data)
      setTokenInfo({
        accessToken: jwtToken,
        expiresAt: new Date(response.data.expiresAt),
        isExpiringSoon: response.data.isExpiringSoon
      })
    } catch (error) {
      console.error('Token validation failed:', error)
      logout()
    } finally {
      setLoading(false)
    }
  }

  // Refresh Google access token
  const refreshGoogleToken = async (jwtToken: string) => {
    try {
      await axios.post(`${API_BASE_URL}/auth/refresh-google-token`, {}, {
        headers: { Authorization: `Bearer ${jwtToken}` }
      })
      console.log('Google token refreshed successfully')
    } catch (error) {
      console.error('Failed to refresh Google token:', error)
    }
  }

  // Refresh JWT token
  const refreshJwtToken = async () => {
    const currentJwtToken = Cookies.get('jwt_token')
    if (!currentJwtToken) return

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/refresh-jwt-token`, {}, {
        headers: { Authorization: `Bearer ${currentJwtToken}` }
      })

      const newJwtToken = response.data.access_token
      Cookies.set('jwt_token', newJwtToken, { 
        expires: 7, // 7 days
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      })

      setTokenInfo(prev => prev ? {
        ...prev,
        accessToken: newJwtToken
      } : null)

    } catch (error) {
      console.error('JWT refresh failed:', error)
      logout()
    }
  }

  // Login by redirecting to backend OAuth
  const login = () => {
    window.location.href = `${API_BASE_URL}/auth/google`
  }

  // Logout
  const logout = useCallback(() => {
    Cookies.remove('jwt_token')
    setUser(null)
    setTokenInfo(null)
  }, [])

  // Make authenticated API calls
  const apiCall = async (config: any) => {
    const jwtToken = Cookies.get('jwt_token')
    if (!jwtToken) {
      throw new Error('Not authenticated')
    }

    // Check if token needs refresh before making request
    if (tokenInfo?.isExpiringSoon) {
      await refreshJwtToken()
    }

    try {
      return await axios({
        ...config,
        headers: {
          ...config.headers,
          Authorization: `Bearer ${Cookies.get('jwt_token')}`,
        },
        baseURL: API_BASE_URL,
      })
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        logout()
      }
      throw error
    }
  }

  // Auto-refresh setup
  useEffect(() => {
    if (!tokenInfo) return

    const checkAndRefresh = async () => {
      // Refresh JWT if it expires in less than 1 hour
      const oneHour = 60 * 60 * 1000
      const expiresAt = tokenInfo.expiresAt.getTime()
      
      if (expiresAt - Date.now() < oneHour) {
        await refreshJwtToken()
      }

      // Refresh Google token proactively
      const jwtToken = Cookies.get('jwt_token')
      if (jwtToken) {
        await refreshGoogleToken(jwtToken)
      }
    }

    // Check every 30 minutes
    const interval = setInterval(checkAndRefresh, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [tokenInfo])

  return {
    user,
    loading,
    login,
    logout,
    apiCall,
    isAuthenticated: !!user,
    tokenInfo,
    refreshJwtToken,
    refreshGoogleToken: () => {
      const jwtToken = Cookies.get('jwt_token')
      return jwtToken ? refreshGoogleToken(jwtToken) : Promise.resolve()
    }
  }
}
```

---

## 🔧 **OAuth Callback Handling**

### For Next.js 13+ (App Router)

**`app/auth/callback/page.tsx`**
```typescript
'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Cookies from 'js-cookie'

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get OAuth data from URL parameters or API
        const response = await fetch('/api/auth/process-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: searchParams.get('code'),
            state: searchParams.get('state'),
          }),
        })

        if (response.ok) {
          const data = await response.json()
          
          // Store JWT token
          Cookies.set('jwt_token', data.access_token, { 
            expires: 7,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
          })

          // Redirect to dashboard
          router.push('/dashboard')
        } else {
          throw new Error('Authentication failed')
        }
      } catch (error) {
        console.error('Auth callback error:', error)
        router.push('/login?error=auth_failed')
      }
    }

    if (searchParams.get('code')) {
      handleCallback()
    }
  }, [searchParams, router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing authentication...</p>
      </div>
    </div>
  )
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  )
}
```

---

## 🔄 **Automatic Token Refresh Components**

### Token Status Indicator

**`components/TokenStatusIndicator.tsx`**
```typescript
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth' // or your auth context

export default function TokenStatusIndicator() {
  const { tokenInfo, refreshGoogleToken } = useAuth()
  const [status, setStatus] = useState<'valid' | 'warning' | 'expired'>('valid')

  useEffect(() => {
    if (!tokenInfo) return

    const checkStatus = () => {
      const now = Date.now()
      const expiresAt = tokenInfo.expiresAt.getTime()
      const timeUntilExpiry = expiresAt - now

      if (timeUntilExpiry <= 0) {
        setStatus('expired')
      } else if (timeUntilExpiry <= 5 * 60 * 1000) { // 5 minutes
        setStatus('warning')
      } else {
        setStatus('valid')
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [tokenInfo])

  const handleRefresh = async () => {
    try {
      await refreshGoogleToken()
      setStatus('valid')
    } catch (error) {
      console.error('Manual refresh failed:', error)
    }
  }

  if (status === 'valid') return null

  return (
    <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg ${
      status === 'warning' ? 'bg-yellow-100 border-yellow-400' : 'bg-red-100 border-red-400'
    } border`}>
      <div className="flex items-center space-x-3">
        <div className={`w-3 h-3 rounded-full ${
          status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
        }`}></div>
        <div>
          <p className={`font-semibold ${
            status === 'warning' ? 'text-yellow-800' : 'text-red-800'
          }`}>
            {status === 'warning' ? 'Token Expiring Soon' : 'Token Expired'}
          </p>
          <p className={`text-sm ${
            status === 'warning' ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {status === 'warning' 
              ? 'Your access token will expire in less than 5 minutes'
              : 'Your access token has expired'
            }
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className={`px-3 py-1 rounded text-sm font-medium ${
            status === 'warning' 
              ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
              : 'bg-red-500 text-white hover:bg-red-600'
          }`}
        >
          Refresh Now
        </button>
      </div>
    </div>
  )
}
```

### Protected Route Component

**`components/ProtectedRoute.tsx`**
```typescript
'use client'

import { useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

interface ProtectedRouteProps {
  children: ReactNode
  fallback?: ReactNode
}

export default function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { user, loading, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login')
    }
  }, [loading, isAuthenticated, router])

  if (loading) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
```

---

## 📱 **Usage Examples**

### Login Page

**`app/login/page.tsx`**
```typescript
'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <div>
          <button
            onClick={login}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              {/* Google icon SVG */}
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  )
}
```

### Dashboard with API Calls & Token Tracking

**`app/dashboard/page.tsx`**
```typescript
'use client'

import { useAuth } from '@/hooks/useAuth'
import { useTokenTracking } from '@/hooks/useTokenTracking'
import { useSmartRequest } from '@/hooks/useSmartRequest'
import { useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import TokenStatusIndicator from '@/components/TokenStatusIndicator'
import TokenQuotaWarning from '@/components/TokenQuotaWarning'
import TokenUsageDashboard from '@/components/TokenUsageDashboard'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const { quotaStatus } = useTokenTracking()
  const { makeSmartRequest, isValidating } = useSmartRequest()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('Hello, help me with my grad school applications')

  // Smart API call with quota validation
  const sendMessage = async () => {
    setLoading(true)
    try {
      const estimatedTokens = Math.min(8000, message.length * 4) // Estimate based on message length
      
      const response = await makeSmartRequest({
        url: '/agent/chat',
        method: 'POST',
        data: { message },
      }, estimatedTokens)
      
      setData(response.data)
    } catch (error) {
      console.error('API call failed:', error)
      alert(error.message) // Show quota error to user
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <TokenStatusIndicator />
        <TokenQuotaWarning />
        
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold">Dashboard</h1>
              </div>
              <div className="flex items-center space-x-4">
                {quotaStatus && (
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      quotaStatus.warningLevel === 'CRITICAL' ? 'bg-red-500' :
                      quotaStatus.warningLevel === 'HIGH' ? 'bg-orange-500' :
                      quotaStatus.warningLevel === 'MEDIUM' ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}></div>
                    <span className="text-sm text-gray-600">
                      {quotaStatus.percentageUsed.toFixed(1)}% quota used
                    </span>
                  </div>
                )}
                <span className="text-gray-700">Welcome, {user?.name}</span>
                <button
                  onClick={logout}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-6 px-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AI Assistant */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-medium mb-4">AI Assistant</h2>
              
              <div className="mb-4">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask me anything about your grad school applications..."
                  className="w-full h-24 p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <button
                  onClick={sendMessage}
                  disabled={loading || isValidating || quotaStatus?.warningLevel === 'CRITICAL'}
                  className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending...' : isValidating ? 'Checking Quota...' : 'Send Message'}
                </button>
                
                {quotaStatus?.warningLevel === 'CRITICAL' && (
                  <span className="text-red-600 text-sm">
                    Quota limit reached - requests blocked
                  </span>
                )}
              </div>
            </div>

            {data && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium mb-4">AI Response</h3>
                <div className="prose max-w-none">
                  <div className="p-4 bg-gray-50 rounded whitespace-pre-wrap">
                    {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Token Usage Dashboard */}
          <div className="lg:col-span-1">
            <TokenUsageDashboard />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}
```

---

## ⚙️ **Configuration & Best Practices**

### Environment Variables Checklist
```env
# Required
NEXT_PUBLIC_API_BASE_URL=https://your-backend.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id

# For NextAuth.js
NEXTAUTH_URL=https://your-frontend.com
NEXTAUTH_SECRET=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Cookie Security Configuration
```typescript
const cookieOptions = {
  expires: 7, // 7 days
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'strict' as const, // CSRF protection
  httpOnly: false, // Needs to be accessible to JavaScript for API calls
}
```

### Error Handling Best Practices
```typescript
// Centralized error handling
const handleAuthError = (error: any) => {
  if (error.response?.status === 401) {
    // Token expired or invalid
    logout()
    router.push('/login?error=session_expired')
  } else if (error.response?.status === 403) {
    // Insufficient permissions
    router.push('/unauthorized')
  } else {
    // Network or other errors
    console.error('Auth error:', error)
    // Show toast notification
  }
}
```

---

## 🚨 **Troubleshooting**

### Common Issues & Solutions

**Token Not Refreshing Automatically:**
- Check that refresh token is properly stored
- Verify Google OAuth scopes include `offline_access`
- Ensure refresh endpoint is working correctly

**CORS Issues:**
- Configure backend CORS to allow your frontend domain
- Check that credentials are included in requests

**Token Expired Errors:**
- Implement proper retry logic with token refresh
- Add token expiration checking before requests

**Cookie Not Persisting:**
- Check cookie security settings for your environment
- Verify domain configuration for cross-subdomain access

---

## 📊 **Token Tracking & Quota Management**

### Token Usage Hook

**`hooks/useTokenTracking.ts`**
```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'

interface TokenStats {
  tokensUsed: number
  requestsMade: number
  currentModel: string
  percentageOfTotal: number
  recentUsage: TokenUsageEntry[]
}

interface TokenUsageEntry {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  model: string
  timestamp: string
}

interface QuotaStatus {
  warningLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  shouldWarn: boolean
  percentageUsed: number
  tokensUsed: number
  currentModel: string
  message: string
}

export function useTokenTracking() {
  const { apiCall, isAuthenticated } = useAuth()
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null)
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch token statistics
  const fetchTokenStats = useCallback(async () => {
    if (!isAuthenticated) return

    try {
      const response = await apiCall({
        url: '/agent/tokens/user',
        method: 'GET'
      })
      setTokenStats(response.data)
    } catch (error) {
      console.error('Failed to fetch token stats:', error)
    }
  }, [apiCall, isAuthenticated])

  // Fetch quota status
  const fetchQuotaStatus = useCallback(async () => {
    if (!isAuthenticated) return

    try {
      const response = await apiCall({
        url: '/agent/tokens/warning-level',
        method: 'GET'
      })
      setQuotaStatus(response.data)
    } catch (error) {
      console.error('Failed to fetch quota status:', error)
    }
  }, [apiCall, isAuthenticated])

  // Check if a request can be made
  const canMakeRequest = useCallback(async (estimatedTokens: number) => {
    if (!isAuthenticated) return false

    try {
      const response = await apiCall({
        url: `/agent/tokens/can-request/${estimatedTokens}`,
        method: 'GET'
      })
      return response.data.allowed
    } catch (error) {
      console.error('Failed to check request permission:', error)
      return false
    }
  }, [apiCall, isAuthenticated])

  // Reset token usage (for testing)
  const resetTokenUsage = useCallback(async () => {
    if (!isAuthenticated) return

    try {
      await apiCall({
        url: '/agent/tokens/reset',
        method: 'POST'
      })
      await fetchTokenStats()
      await fetchQuotaStatus()
    } catch (error) {
      console.error('Failed to reset tokens:', error)
    }
  }, [apiCall, isAuthenticated, fetchTokenStats, fetchQuotaStatus])

  // Auto-refresh token stats and quota status
  useEffect(() => {
    if (isAuthenticated) {
      fetchTokenStats()
      fetchQuotaStatus()

      // Refresh every 30 seconds
      const interval = setInterval(() => {
        fetchTokenStats()
        fetchQuotaStatus()
      }, 30000)

      return () => clearInterval(interval)
    }
  }, [isAuthenticated, fetchTokenStats, fetchQuotaStatus])

  // Refresh after chat requests
  const refreshAfterRequest = useCallback(() => {
    if (isAuthenticated) {
      // Small delay to allow backend to process
      setTimeout(() => {
        fetchTokenStats()
        fetchQuotaStatus()
      }, 1000)
    }
  }, [isAuthenticated, fetchTokenStats, fetchQuotaStatus])

  return {
    tokenStats,
    quotaStatus,
    loading,
    canMakeRequest,
    resetTokenUsage,
    refreshAfterRequest,
    refresh: () => {
      fetchTokenStats()
      fetchQuotaStatus()
    }
  }
}
```

### Token Quota Warning Component

**`components/TokenQuotaWarning.tsx`**
```typescript
'use client'

import { useTokenTracking } from '@/hooks/useTokenTracking'
import { useState } from 'react'

export default function TokenQuotaWarning() {
  const { quotaStatus, tokenStats } = useTokenTracking()
  const [dismissed, setDismissed] = useState(false)

  if (!quotaStatus || !quotaStatus.shouldWarn || dismissed) {
    return null
  }

  const getWarningStyle = () => {
    switch (quotaStatus.warningLevel) {
      case 'CRITICAL':
        return 'bg-red-100 border-red-400 text-red-800'
      case 'HIGH':
        return 'bg-orange-100 border-orange-400 text-orange-800'
      case 'MEDIUM':
        return 'bg-yellow-100 border-yellow-400 text-yellow-800'
      default:
        return 'bg-blue-100 border-blue-400 text-blue-800'
    }
  }

  const getIconColor = () => {
    switch (quotaStatus.warningLevel) {
      case 'CRITICAL':
        return 'text-red-500'
      case 'HIGH':
        return 'text-orange-500'
      case 'MEDIUM':
        return 'text-yellow-500'
      default:
        return 'text-blue-500'
    }
  }

  return (
    <div className={`fixed top-4 right-4 max-w-sm p-4 border rounded-lg shadow-lg z-50 ${getWarningStyle()}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className={`h-5 w-5 ${getIconColor()}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium">
            {quotaStatus.warningLevel === 'CRITICAL' ? 'Quota Limit Reached' : 
             quotaStatus.warningLevel === 'HIGH' ? 'Quota Nearly Exhausted' :
             'Approaching Quota Limit'}
          </h3>
          <div className="mt-1 text-sm">
            <p>{quotaStatus.message}</p>
            {tokenStats && (
              <p className="mt-1">
                {tokenStats.tokensUsed.toLocaleString()} tokens used • {tokenStats.requestsMade} requests made
              </p>
            )}
          </div>
          <div className="mt-3 flex">
            <button
              onClick={() => setDismissed(true)}
              className={`text-sm underline ${
                quotaStatus.warningLevel === 'CRITICAL' ? 'text-red-600 hover:text-red-500' :
                quotaStatus.warningLevel === 'HIGH' ? 'text-orange-600 hover:text-orange-500' :
                'text-yellow-600 hover:text-yellow-500'
              }`}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### Token Usage Dashboard Component

**`components/TokenUsageDashboard.tsx`**
```typescript
'use client'

import { useTokenTracking } from '@/hooks/useTokenTracking'
import { useState } from 'react'

export default function TokenUsageDashboard() {
  const { tokenStats, quotaStatus, resetTokenUsage, refresh } = useTokenTracking()
  const [resetting, setResetting] = useState(false)

  const handleReset = async () => {
    setResetting(true)
    try {
      await resetTokenUsage()
    } finally {
      setResetting(false)
    }
  }

  if (!tokenStats || !quotaStatus) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  const getUsageColor = () => {
    if (quotaStatus.percentageUsed >= 95) return 'bg-red-500'
    if (quotaStatus.percentageUsed >= 80) return 'bg-orange-500'
    if (quotaStatus.percentageUsed >= 60) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Token Usage</h3>
        <div className="flex space-x-2">
          <button
            onClick={refresh}
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            Refresh
          </button>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="text-sm text-gray-600 hover:text-gray-500 disabled:opacity-50"
          >
            {resetting ? 'Resetting...' : 'Reset'}
          </button>
        </div>
      </div>

      {/* Usage Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Usage</span>
          <span>{quotaStatus.percentageUsed.toFixed(1)}% used</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${getUsageColor()}`}
            style={{ width: `${Math.min(100, quotaStatus.percentageUsed)}%` }}
          ></div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">
            {tokenStats.tokensUsed.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Tokens Used</div>
        </div>
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">
            {tokenStats.requestsMade}
          </div>
          <div className="text-sm text-gray-600">Requests Made</div>
        </div>
      </div>

      {/* Current Model */}
      <div className="mb-4">
        <span className="text-sm text-gray-600">Current Model: </span>
        <span className="text-sm font-medium text-gray-900">{tokenStats.currentModel}</span>
      </div>

      {/* Recent Usage */}
      {tokenStats.recentUsage && tokenStats.recentUsage.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Recent Usage</h4>
          <div className="space-y-2">
            {tokenStats.recentUsage.slice(0, 3).map((usage, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-gray-600">
                  {new Date(usage.timestamp).toLocaleTimeString()}
                </span>
                <span className="font-medium">
                  {usage.totalTokens.toLocaleString()} tokens
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

### Smart Request Validation

**`hooks/useSmartRequest.ts`**
```typescript
'use client'

import { useTokenTracking } from './useTokenTracking'
import { useAuth } from './useAuth'
import { useState } from 'react'

export function useSmartRequest() {
  const { canMakeRequest, refreshAfterRequest } = useTokenTracking()
  const { apiCall } = useAuth()
  const [isValidating, setIsValidating] = useState(false)

  const makeSmartRequest = async (config: any, estimatedTokens: number = 1500) => {
    setIsValidating(true)
    
    try {
      // Check quota before making request
      const allowed = await canMakeRequest(estimatedTokens)
      
      if (!allowed) {
        throw new Error(`Request blocked: Estimated ${estimatedTokens} tokens would exceed your quota limit. Please try again later or use fewer tokens.`)
      }

      // Make the actual request
      const response = await apiCall(config)
      
      // Refresh token tracking after successful request
      refreshAfterRequest()
      
      return response
      
    } finally {
      setIsValidating(false)
    }
  }

  return {
    makeSmartRequest,
    isValidating
  }
}
```

---

## 📚 **API Endpoints Reference**

### Backend Endpoints Your Frontend Will Use

```
# Authentication Endpoints
POST /auth/google                    # Initiate OAuth
GET  /auth/google/callback          # OAuth callback  
GET  /auth/profile                  # Get user profile
GET  /auth/token-status            # Check token validity
POST /auth/refresh-google-token    # Refresh Google token
POST /auth/refresh-jwt-token       # Refresh JWT token

# AI Assistant Endpoints
POST /agent/chat                   # AI assistant (non-streaming)
POST /agent/chat/stream           # AI assistant (streaming)

# Token Tracking & Quota Endpoints
GET  /agent/tokens/statistics     # System-wide token stats (admin)
GET  /agent/tokens/user          # User token usage stats
GET  /agent/tokens/quota-status  # Current quota status with warnings
GET  /agent/tokens/warning-level # Warning level for notifications
GET  /agent/tokens/can-request/:tokens # Check if request allowed
POST /agent/tokens/reset         # Reset user token usage

# Other App Endpoints  
GET  /agent/conversations        # User's conversations
POST /agent/conversations       # Create new conversation
# ... other endpoints
```

---

## 🎯 **Integration Checklist**

### Authentication Setup
- [ ] Environment variables configured
- [ ] OAuth redirect URIs set up in Google Console
- [ ] Auth hook/context implemented
- [ ] Protected routes configured
- [ ] Automatic token refresh enabled
- [ ] Error handling implemented
- [ ] Token status indicator added
- [ ] Logout functionality working
- [ ] API call wrapper implemented
- [ ] CORS configured on backend

### Token Tracking & Quota Management  
- [ ] Token tracking hook implemented (`useTokenTracking`)
- [ ] Smart request validation hook implemented (`useSmartRequest`)
- [ ] Token quota warning component added
- [ ] Token usage dashboard component added
- [ ] Quota status indicators in navigation
- [ ] Pre-request quota validation enabled
- [ ] Auto-refresh token stats (every 30 seconds)
- [ ] Post-request token tracking refresh
- [ ] Quota-based request blocking implemented
- [ ] Warning notifications working

### Testing & Deployment
- [ ] Authentication flow tested
- [ ] Token refresh tested  
- [ ] Quota warnings tested
- [ ] Request blocking tested
- [ ] Error handling tested
- [ ] Production deployment ready

---

This comprehensive guide provides everything needed to implement seamless authentication with automatic token refresh in your Next.js application! 🚀

The system ensures users never experience authentication interruptions while using your AI-powered postgrad application assistant.