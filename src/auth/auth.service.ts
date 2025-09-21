import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DatabaseService, User } from '../database/database.service';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  async validateGoogleUser(profile: any, accessToken: string, refreshToken: string): Promise<User> {
    const { id: googleId, emails, displayName, photos } = profile;
    const email = emails[0].value;
    const picture = photos?.[0]?.value;

    console.log(`🔍 OAuth Callback - Access Token: ${accessToken ? 'Present' : 'Missing'}`);
    console.log(`🔍 OAuth Callback - Refresh Token: ${refreshToken ? 'Present' : 'Missing'}`);

    // Check if user exists
    let user = await this.databaseService.findUserByGoogleId(googleId);

    if (!user) {
      // Create new user
      console.log(`👤 Creating new user with refresh token: ${refreshToken ? 'Yes' : 'No'}`);
      user = await this.databaseService.createUser({
        email,
        google_id: googleId,
        name: displayName,
        picture,
        access_token: accessToken,
        refresh_token: refreshToken || undefined, // Explicitly handle missing refresh token
        token_expires_at: new Date(Date.now() + 3600 * 1000), // 1 hour from now
        role: 'user', // Default role
        is_active: true, // New users are active by default
        last_login_at: new Date(), // Track login time
      });
    } else {
      // Update existing user with new tokens
      console.log(`🔄 Updating existing user with refresh token: ${refreshToken ? 'Yes' : 'No'}`);
      const updateData: any = {
        access_token: accessToken,
        token_expires_at: new Date(Date.now() + 3600 * 1000),
        picture, // Update picture in case it changed
        last_login_at: new Date(), // Track login time
      };
      
      // Only update refresh token if we received a new one
      if (refreshToken) {
        updateData.refresh_token = refreshToken;
      }
      
      user = await this.databaseService.updateUser(user.id, updateData);
    }

    return user;
  }

  async generateJwtToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };

    return this.jwtService.sign(payload);
  }

  verifyTokenIgnoreExpiration(token: string): JwtPayload | null {
    try {
      return this.jwtService.verify(token, { ignoreExpiration: true }) as JwtPayload;
    } catch (error) {
      return null;
    }
  }

  async validateJwtPayload(payload: JwtPayload): Promise<User> {
    const user = await this.databaseService.findUserByEmail(payload.email);
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async refreshGoogleToken(user: User): Promise<{ accessToken: string; expiresAt: Date } | null> {
    if (!user.refresh_token) {
      // If no refresh token, return current token if it's still valid
      if (user.token_expires_at && user.access_token && new Date(user.token_expires_at) > new Date()) {
        return {
          accessToken: user.access_token,
          expiresAt: new Date(user.token_expires_at)
        };
      }
      // If no refresh token and current token is expired, return null
      return null;
    }

    // Check if current token is still valid (has more than 5 minutes left)
    if (user.token_expires_at && user.access_token && new Date(user.token_expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
      return {
        accessToken: user.access_token,
        expiresAt: new Date(user.token_expires_at)
      };
    }

    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      console.error('Missing Google OAuth credentials');
      return null;
    }

    try {
      // Refresh the Google access token using refresh token
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: user.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        console.error('Failed to refresh Google token:', response.status, response.statusText);
        return null;
      }

      const tokenData = await response.json();
      
      // Calculate expiration time (Google tokens typically expire in 1 hour)
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
      
      // Update user in database with new token
      await this.databaseService.updateUser(user.id, {
        access_token: tokenData.access_token,
        token_expires_at: expiresAt,
        // Note: refresh_token might be included in response, but often isn't
        // Only update it if it's provided
        ...(tokenData.refresh_token && { refresh_token: tokenData.refresh_token }),
      });

      return {
        accessToken: tokenData.access_token,
        expiresAt
      };

    } catch (error) {
      console.error('Error refreshing Google token:', error);
      return null;
    }
  }

  async getValidAccessToken(user: User): Promise<string | null> {
    console.log(`🔍 getValidAccessToken called for user ${user.id}`);
    console.log(`🔍 access_token exists:`, !!user.access_token);
    console.log(`🔍 token_expires_at:`, user.token_expires_at);
    console.log(`🔍 current time:`, new Date());
    console.log(`🔍 token expired?:`, user.token_expires_at ? new Date(user.token_expires_at) <= new Date() : 'no expiration');

    // If no access token, return null
    if (!user.access_token) {
      console.log(`❌ No access token found`);
      return null;
    }

    // If token is still valid (not expired), return it
    if (user.token_expires_at && new Date(user.token_expires_at) > new Date()) {
      console.log(`✅ Token is valid, returning it`);
      return user.access_token;
    }

    console.log(`🕒 Token is expired or no expiration time`);

    // Token is expired, try to refresh if we have a refresh token
    if (user.refresh_token) {
      console.log(`🔄 Attempting to refresh token`);
      const refreshResult = await this.refreshGoogleToken(user);
      return refreshResult?.accessToken || null;
    }

    console.log(`❌ Token expired and no refresh token available`);
    // Token is expired and no refresh token available
    return null;
  }
}