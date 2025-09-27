import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, StrategyOptions } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL'),
      scope: [
        'email',
        'profile',
        'https://www.googleapis.com/auth/spreadsheets',
       // 'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/drive.file',
      ],
    } as StrategyOptions);
  }

  authenticate(req: any, options?: any): void {
    // Force offline access and consent prompt
    const opts = {
      ...options,
      accessType: 'offline',
      prompt: 'consent',
      includeGrantedScopes: false,
    };
    super.authenticate(req, opts);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const user = await this.authService.validateGoogleUser(
        profile,
        accessToken,
        refreshToken,
      );
      done(null, user);
    } catch (error) {
      done(error, false);
    }
  }
}