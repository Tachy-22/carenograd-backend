# WhatsApp Business API Integration

This document provides instructions for setting up the WhatsApp Business API integration with Facebook/Meta for QuiqOrder.

## Environment Variables

Make sure you have the following environment variables in your `.env.local` file:

```
# Meta App Credentials
NEXT_PUBLIC_META_APP_ID=your_meta_app_id
NEXT_PUBLIC_META_APP_SECRET=your_meta_app_secret

# WhatsApp Business API Credentials
NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER=your_whatsapp_phone_number
NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_phone_number_id
NEXT_PUBLIC_WHATSAPP_BUSINESS_ID=your_whatsapp_business_id
NEXT_PUBLIC_WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
NEXT_PUBLIC_WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token
NEXT_PUBLIC_WHATSAPP_WEBHOOK_SECRET=your_webhook_secret
```

## Facebook App Configuration

For the WhatsApp Business API integration to work correctly, you need to configure your Facebook App with the correct settings:

1. Go to [Facebook for Developers](https://developers.facebook.com/)
2. Select your App
3. Navigate to App Settings > Basic

### App Domains

Add the following domains to the "App Domains" field:

- `localhost`
- Your ngrok domain (e.g., `your-subdomain.ngrok-free.app`)
- Your production domain (e.g., `yourdomain.com`)

### Website Platform

Under "Add Platform" section, add "Website" and configure:

- Site URL: `http://localhost:3000` (for local development)
- Also add your production URL when deploying

### Valid OAuth Redirect URIs

In the "Facebook Login" > "Settings" section, add the following URLs to the "Valid OAuth Redirect URIs" field:

- `http://localhost:3000/api/whatsapp/callback`
- `https://your-subdomain.ngrok-free.app/api/whatsapp/callback`
- `https://yourdomain.com/api/whatsapp/callback`

### Client OAuth Settings

Make sure the following settings are enabled:

- Client OAuth Login: YES
- Web OAuth Login: YES
- Enforce HTTPS: YES (optional for localhost)

## Using ngrok for Development

When testing with ngrok:

1. Start your Next.js application:

   ```
   npm run dev
   ```

2. Start ngrok:

   ```
   ngrok http 3000
   ```

3. Copy the ngrok HTTPS URL (e.g., `https://your-subdomain.ngrok-free.app`)

4. Update your Facebook App settings with the new ngrok domain:
   - Add the domain to App Domains
   - Add the callback URL to Valid OAuth Redirect URIs

The application will automatically detect whether it's running on localhost or through an ngrok tunnel and use the appropriate redirect URI.

## Troubleshooting

### Common Facebook OAuth Errors

1. **"URL Blocked: This redirect failed because the redirect URI is not whitelisted in the app's Client OAuth Settings."**

   - Solution: Add the exact callback URL to the Valid OAuth Redirect URIs in your Facebook App settings.

2. **"The domain of this URL isn't included in the app's domains."**

   - Solution: Add your domain to the App Domains section in your Facebook App settings.

3. **"No redirect URI in the params"**
   - Solution: Ensure the redirect_uri parameter in the OAuth URL is properly URL encoded.

### Testing the OAuth Flow

Use the debug callback route for testing:

- Access `/api/whatsapp/debug-callback` to see the raw callback parameters.
- This helps diagnose issues with the OAuth flow without affecting your database.
