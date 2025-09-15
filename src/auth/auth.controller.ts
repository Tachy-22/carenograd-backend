import { Controller, Get, Post, UseGuards, Req, Res, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import type { User } from '../database/database.service';
import { AuthResponseDto, UserProfileDto, RefreshTokenResponseDto } from './dto/auth.dto';

interface AuthenticatedRequest extends Request {
  user: User;
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ 
    summary: 'Initiate Google OAuth login',
    description: 'Redirects user to Google OAuth consent screen. Open this URL in a browser to authenticate.'
  })
  @ApiResponse({ status: 302, description: 'Redirects to Google OAuth consent screen' })
  async googleLogin() {
    // Initiates Google OAuth flow
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ 
    summary: 'Handle Google OAuth callback',
    description: 'Processes Google OAuth callback and returns JWT token. This is called automatically after OAuth consent.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Authentication successful - returns user info and JWT token',
    type: AuthResponseDto
  })
  async googleCallback(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const user = req.user;
    const jwtToken = await this.authService.generateJwtToken(user);
    
    // Prepare user data for frontend
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
    };
    
    // Redirect to frontend with tokens as URL parameters
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = new URL('/auth/callback', frontendUrl);
    redirectUrl.searchParams.set('token', jwtToken);
    redirectUrl.searchParams.set('user', encodeURIComponent(JSON.stringify(userData)));
    
    res.redirect(redirectUrl.toString());
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ 
    summary: 'Get current user profile',
    description: 'Retrieve authenticated user profile information. Requires JWT token in Authorization header.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User profile retrieved successfully',
    type: UserProfileDto
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing JWT token' })
  async getProfile(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      created_at: user.created_at,
    };
  }

  @Post('refresh-google-token')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ 
    summary: 'Refresh Google access token',
    description: 'Refresh expired Google OAuth access token for API operations. Requires JWT token in Authorization header.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Google access token refreshed successfully',
    type: RefreshTokenResponseDto
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing JWT token' })
  async refreshGoogleToken(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    const tokenResult = await this.authService.refreshGoogleToken(user);
    
    if (!tokenResult) {
      throw new UnauthorizedException('Failed to refresh token');
    }
    
    return {
      access_token: tokenResult.accessToken,
      expires_at: tokenResult.expiresAt,
      expires_in: Math.floor((tokenResult.expiresAt.getTime() - Date.now()) / 1000),
    };
  }

  @Get('token-status')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ 
    summary: 'Get current token status',
    description: 'Check if current Google access token is valid and when it expires. Used by frontend for automatic refresh.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Token status retrieved successfully'
  })
  async getTokenStatus(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    const now = new Date();
    const isExpired = !user.token_expires_at || user.token_expires_at <= now;
    const isExpiringSoon = user.token_expires_at && user.token_expires_at <= new Date(now.getTime() + 5 * 60 * 1000);
    
    return {
      isValid: !isExpired,
      isExpiringSoon,
      expiresAt: user.token_expires_at,
      expiresIn: user.token_expires_at ? Math.max(0, Math.floor((user.token_expires_at.getTime() - now.getTime()) / 1000)) : 0,
      needsRefresh: isExpired || isExpiringSoon,
    };
  }

  @Post('refresh-jwt-token')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ 
    summary: 'Refresh JWT token',
    description: 'Generate a new JWT token for the authenticated user. Used for long-lived sessions.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'JWT token refreshed successfully'
  })
  async refreshJwtToken(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    const jwtToken = await this.authService.generateJwtToken(user);
    
    return {
      access_token: jwtToken,
      token_type: 'Bearer',
      expires_in: 24 * 60 * 60, // 24 hours in seconds
    };
  }
}