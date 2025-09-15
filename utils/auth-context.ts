// Utility to manage access token context for Google API tools
class AuthContext {
  private currentAccessToken: string | null = null;
  private tokenExpiration: Date | null = null;
  private refreshCallback: (() => Promise<{ accessToken: string; expiresAt: Date } | null>) | null = null;

  setAccessToken(token: string, expiresAt?: Date): void {
    this.currentAccessToken = token;
    this.tokenExpiration = expiresAt || null;
  }

  setRefreshCallback(callback: () => Promise<{ accessToken: string; expiresAt: Date } | null>): void {
    this.refreshCallback = callback;
  }

  async getAccessToken(): Promise<string> {
    // Check if we need to refresh the token (expires in less than 5 minutes)
    if (this.tokenExpiration && this.tokenExpiration <= new Date(Date.now() + 5 * 60 * 1000)) {
      await this.refreshToken();
    }

    if (!this.currentAccessToken) {
      throw new Error('Access token not available. Please authenticate with Google OAuth.');
    }
    return this.currentAccessToken;
  }

  private async refreshToken(): Promise<void> {
    if (!this.refreshCallback) {
      console.warn('No refresh callback available, cannot refresh token');
      return;
    }

    try {
      const result = await this.refreshCallback();
      if (result) {
        this.currentAccessToken = result.accessToken;
        this.tokenExpiration = result.expiresAt;
        console.log('Token refreshed successfully');
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
    }
  }

  clearAccessToken(): void {
    this.currentAccessToken = null;
    this.tokenExpiration = null;
  }

  isTokenValid(): boolean {
    return this.currentAccessToken !== null && 
           (!this.tokenExpiration || this.tokenExpiration > new Date());
  }

  getTokenExpirationTime(): Date | null {
    return this.tokenExpiration;
  }
}

// Global instance to share access token across tools
export const authContext = new AuthContext();

// Helper function to get access token (replacement for getToken import)
export const getAccessToken = async (): Promise<string> => {
  return await authContext.getAccessToken();
};