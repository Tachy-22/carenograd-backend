# Remograd API Testing

This folder contains REST client test files for testing the Remograd API endpoints.

## Setup

1. **Start the API server:**
   ```bash
   npm run start:dev
   ```

2. **Get JWT Token:**
   - Open browser: http://localhost:3000/auth/google
   - Complete Google OAuth login
   - Copy the JWT token from the response
   - Replace `YOUR_JWT_TOKEN_HERE` in all `.http` files

3. **Test using REST Client:**
   - Install REST Client extension in VS Code
   - Open any `.http` file
   - Click "Send Request" above each request

## Test Files

### `auth.http`
- Google OAuth login
- Get user profile
- Refresh Google tokens

### `chat.http`
- Basic chat conversations
- Continuing conversations
- Background checking

### `conversations.http`
- List all conversations
- Get conversation messages

### `documents.http`
- Upload documents to knowledge base
- Query knowledge base
- List and manage documents

### `graduate-programs.http`
- Research graduate programs
- Create application tracking
- Find professors
- Draft emails

### `google-apis.http`
- Google Sheets integration
- Google Docs creation
- Gmail operations
- Google Search

## Usage Tips

1. **Sequential Testing:** Start with `auth.http` to get your profile, then proceed to other tests
2. **Conversation IDs:** Copy conversation IDs from responses to test message history
3. **Document IDs:** Use actual document IDs from your uploads for document management
4. **Spreadsheet IDs:** Google Sheets operations will return spreadsheet IDs to use in subsequent calls

## Expected Responses

- **200 OK:** Successful API calls
- **401 Unauthorized:** Check your JWT token
- **500 Internal Server Error:** Check server logs for issues

## Environment Variables Required

Make sure your `.env` file has:
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
OPENAI_API_KEY=your_openai_key
```

## Swagger Documentation

Visit http://localhost:3000/api for interactive API documentation.