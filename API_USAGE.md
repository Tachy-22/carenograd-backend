# Remograd AI Agent API Documentation

## Overview

The Remograd API is a multi-user NestJS application that provides AI agent services for postgraduate application assistance. It includes Google OAuth authentication, conversation management, and integration with your existing AI agent tools.

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   - Copy `.env.example` to `.env`
   - Fill in your configuration values:
     - Supabase database credentials
     - Google OAuth credentials
     - OpenAI API key
     - JWT secret

3. **Database Setup**
   - Run the SQL in `src/database/schemas.sql` in your Supabase dashboard
   - Ensure the `documents` and `embeddings` tables from `setup-supabase-rag.txt` are also created

4. **Start the Server**
   ```bash
   # Development
   npm run start:dev
   
   # Production
   npm run build
   npm run start:prod
   ```

## API Endpoints

### Authentication

#### Google OAuth Login
```
GET /auth/google
```
Redirects to Google OAuth consent screen.

#### OAuth Callback
```
GET /auth/google/callback
```
Handles Google OAuth callback and returns JWT token.

**Response:**
```json
{
  "message": "Authentication successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "picture": "https://..."
  },
  "access_token": "jwt_token_here"
}
```

#### Get Profile
```
GET /auth/profile
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "User Name",
  "picture": "https://...",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

#### Refresh Google Token
```
POST /auth/refresh-google-token
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "access_token": "google_access_token"
}
```

### Agent Chat

#### Send Message to Agent
```
POST /agent/chat
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "message": "Help me find graduate programs in machine learning",
  "conversationId": "optional-uuid"
}
```

**Response:**
```json
{
  "response": "I'll help you find graduate programs...",
  "conversationId": "uuid",
  "messageId": "uuid"
}
```

#### Get User Conversations
```
GET /agent/conversations
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "title": "Graduate Programs Discussion",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### Get Conversation Messages
```
GET /agent/conversations/{conversationId}/messages
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "conversation_id": "uuid",
      "user_id": "uuid",
      "role": "user",
      "content": "Help me find graduate programs",
      "metadata": {},
      "created_at": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "uuid",
      "conversation_id": "uuid",
      "user_id": "uuid",
      "role": "assistant",
      "content": "I'll help you find programs...",
      "metadata": {
        "toolCalls": [...],
        "usage": {...},
        "finishReason": "stop"
      },
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## Features

### User Management
- Google OAuth authentication
- JWT-based session management
- User profile management
- Google token refresh

### Conversation Management
- Create and manage conversations
- Store chat history per user
- Retrieve conversation messages
- Automatic conversation titling

### AI Agent Integration
- Full integration with your existing AI agent
- Support for all agent tools (web scraping, Google APIs, RAG, etc.)
- User-specific Google OAuth tokens for API access
- Tool execution tracking and metadata storage

### Document Management (via Agent)
- The agent handles document uploads using existing `uploadDocumentTool`
- User-specific document storage and retrieval
- RAG (Retrieval Augmented Generation) capabilities
- PDF processing and embedding generation

## Architecture

### Database Schema
- **users**: User profiles and OAuth tokens
- **conversations**: Chat conversation groupings  
- **messages**: Individual chat messages
- **documents**: User-uploaded files (managed by agent)
- **embeddings**: Document chunks for RAG (managed by agent)

### Security
- JWT authentication for API access
- User-scoped data access (users can only access their own data)
- Google OAuth token storage for API access
- Rate limiting (100 requests per minute per IP)

### Integration Points
- **Existing Agent**: Full integration with your multi-tool AI agent
- **Google APIs**: Uses stored user tokens for Sheets, Docs, Gmail access
- **Supabase**: Database and RAG vector storage
- **OpenAI**: AI model and embeddings

## Usage Examples

### Frontend Integration
```javascript
// Login flow
window.location.href = 'http://localhost:3000/auth/google';

// After OAuth callback, use the JWT token
const token = 'jwt_token_from_callback';

// Send chat message
const response = await fetch('http://localhost:3000/agent/chat', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: 'Help me find PhD programs in AI',
  }),
});

const data = await response.json();
console.log(data.response); // AI agent response
```

### CLI Testing
```bash
# Login via browser to get JWT token
curl -X POST http://localhost:3000/agent/chat \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "What graduate programs would be good for me?"}'
```

## Development

### Running Tests
```bash
npm run test
npm run test:e2e
```

### API Documentation
Visit `http://localhost:3000/api` for interactive Swagger documentation.

### Hot Reload
```bash
npm run start:dev
```

The API will automatically restart when you make changes to the code.