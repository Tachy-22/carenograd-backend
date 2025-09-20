import { Injectable, Logger } from '@nestjs/common';
import { createGoogleGenerativeAI, google } from '@ai-sdk/google';
import { generateText, streamText, LanguageModel } from 'ai';
import { GeminiKeyPoolService } from './gemini-key-pool.service';
import { MultiApiAllocationService } from './multi-api-allocation.service';

export interface GenerateTextOptions {
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  userId?: string;
}

export interface AdvancedGenerateTextOptions {
  system?: string;
  messages?: any[];
  tools?: any;
  stopWhen?: any;
  temperature?: number;
  maxTokens?: number;
  providerOptions?: any;
  onStepFinish?: (params: { toolCalls?: any[]; text?: string }) => void;
  userId?: string;
}

export interface StreamTextOptions {
  messages: any[];
  system?: string;
  tools?: any;
  stopWhen?: any;
  temperature?: number;
  maxTokens?: number;
  userId?: string;
}

@Injectable()
export class GeminiWithKeyPoolService {
  private readonly logger = new Logger(GeminiWithKeyPoolService.name);
  
  constructor(
      private readonly keyPoolService: GeminiKeyPoolService,
    private readonly allocationService: MultiApiAllocationService,
  ) {}

  /**
   * Generate text with automatic key rotation and allocation tracking
   */
  async generateTextWithKeyRotation(options: GenerateTextOptions) {
    const { userId, ...generateOptions } = options;
    
    // Check allocation if userId provided
    if (userId) {
      const allocationCheck = await this.allocationService.canUserMakeRequest(userId);
      if (!allocationCheck.allowed) {
        throw new Error(`DAILY_LIMIT_EXCEEDED: ${allocationCheck.reason}`);
      }
    }
    
    const maxRetries = 15;
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const keyInfo = this.keyPoolService.getNextAvailableKey();
      
      if (!keyInfo) {
        throw new Error('No available API keys. All keys are rate limited or exhausted.');
      }
      
      try {
        const model = this.createModelWithKey(keyInfo.key);
        
        const result = await generateText({
          model,
          prompt: generateOptions.prompt,
          system: generateOptions.system,
          temperature: generateOptions.temperature || 0.7,
        });
        
        // Track successful request
        this.keyPoolService.trackSuccessfulRequest(keyInfo.keyIndex);
        
        // Track allocation if userId provided
        if (userId) {
          await this.allocationService.trackUserRequest(userId);
        }
        
        this.logger.debug(`Successfully generated text using key ${keyInfo.keyIndex}`);
        return result;
        
      } catch (error) {
        this.logger.error(`Key ${keyInfo.keyIndex} failed on attempt ${attempt}:`, error);
        
        // Track failed request
        this.keyPoolService.trackFailedRequest(keyInfo.keyIndex, error);
        lastError = error;
        
        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          break;
        }
        
        // Wait a bit before retrying
        await this.delay(1000 * attempt);
      }
    }
    
    throw new Error(`All retry attempts failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Stream text with automatic key rotation and allocation tracking
   */
  async streamTextWithKeyRotation(options: StreamTextOptions) {
    const { userId, ...streamOptions } = options;
    
    // Check allocation if userId provided
    if (userId) {
      const allocationCheck = await this.allocationService.canUserMakeRequest(userId);
      if (!allocationCheck.allowed) {
        throw new Error(`DAILY_LIMIT_EXCEEDED: ${allocationCheck.reason}`);
      }
    }
    
    const maxRetries = 3;
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const keyInfo = this.keyPoolService.getNextAvailableKey();
      
      if (!keyInfo) {
        throw new Error('No available API keys. All keys are rate limited or exhausted.');
      }
      
      try {
        const model = this.createModelWithKey(keyInfo.key);
        
        const result = await streamText({
          model,
          messages: streamOptions.messages,
          system: streamOptions.system,
          tools: streamOptions.tools,
          stopWhen: streamOptions.stopWhen,
          temperature: streamOptions.temperature || 0.7,
        });
        
        // Track successful request
        this.keyPoolService.trackSuccessfulRequest(keyInfo.keyIndex);
        
        // Track allocation if userId provided
        if (userId) {
          await this.allocationService.trackUserRequest(userId);
        }
        
        this.logger.debug(`Successfully started streaming text using key ${keyInfo.keyIndex}`);
        return result;
        
      } catch (error) {
        this.logger.error(`Key ${keyInfo.keyIndex} failed on attempt ${attempt}:`, error);
        
        // Track failed request
        this.keyPoolService.trackFailedRequest(keyInfo.keyIndex, error);
        lastError = error;
        
        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          break;
        }
        
        // Wait a bit before retrying
        await this.delay(1000 * attempt);
      }
    }
    
    throw new Error(`All retry attempts failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Get key pool statistics
   */
  getKeyPoolStats() {
    return this.keyPoolService.getKeyPoolStats();
  }

  /**
   * Check if keys are available
   */
  hasAvailableKeys(): boolean {
    return this.keyPoolService.hasAvailableKeys();
  }

  /**
   * Reset a specific key
   */
  resetKey(keyIndex: number): void {
    this.keyPoolService.resetKey(keyIndex);
  }

  /**
   * Create a Gemini model instance with specific API key
   */
  private createModelWithKey(apiKey: string): LanguageModel {
    return google('gemini-2.5-flash');
  }

  /**
   * Create a model instance for a specific user with allocation checking and key rotation
   * This model can be used directly with generateText() while handling quota automatically
   */
  async createModelForUser(userId: string, modelName: string = 'gemini-2.5'): Promise<{ model: LanguageModel; keyIndex: number }> {
    // Pre-check allocation
    const allocationCheck = await this.allocationService.canUserMakeRequest(userId, modelName);
    if (!allocationCheck.allowed) {
      throw new Error(`DAILY_LIMIT_EXCEEDED: ${allocationCheck.reason}`);
    }

    // Get an available key
    const keyInfo = this.keyPoolService.getNextAvailableKey();
    if (!keyInfo) {
      throw new Error('No available API keys. All keys are rate limited or exhausted.');
    }

    // Create the model with the available key
    const model = this.createModelWithKey(keyInfo.key);
    
    return { model, keyIndex: keyInfo.keyIndex };
  }

  /**
   * Track usage after a successful request
   */
  async trackSuccessfulUsage(userId: string, keyIndex: number, modelName: string = 'gemini-2.5'): Promise<void> {
    try {
      this.keyPoolService.trackSuccessfulRequest(keyIndex);
      await this.allocationService.trackUserRequest(userId, modelName);
      this.logger.debug(`Successfully tracked usage for user ${userId} with key ${keyIndex}`);
    } catch (error) {
      this.logger.error(`Failed to track usage for user ${userId}:`, error);
    }
  }

  /**
   * Track usage after a failed request
   */
  trackFailedUsage(keyIndex: number, error: any): void {
    this.keyPoolService.trackFailedRequest(keyIndex, error);
    this.logger.error(`Request failed with key ${keyIndex}:`, error);
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if error is a minute-based rate limit error
   */
  private isMinuteQuotaError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    return (
      errorMessage.includes('generativelanguage.googleapis.com/generate_content_free_tier_input_token_count') ||
      errorMessage.includes('requests per minute') ||
      errorMessage.includes('rpm') ||
      (errorMessage.includes('quota') && errorMessage.includes('minute'))
    );
  }

  /**
   * Check if error is a daily quota error
   */
  private isDailyQuotaError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    return (
      errorMessage.includes('daily quota') ||
      errorMessage.includes('daily limit') ||
      errorMessage.includes('requests per day') ||
      errorMessage.includes('rpd')
    );
  }

  /**
   * Calculate wait time for rate limit reset
   * Google API rate limits typically reset on minute boundaries
   */
  private calculateWaitTime(error: any): number {
    // If error contains retry-after header, use it
    if (error?.headers?.['retry-after']) {
      return parseInt(error.headers['retry-after']) * 1000;
    }

    // For minute-based limits, wait until next minute boundary
    const now = new Date();
    const nextMinute = new Date(now.getTime() + 60000);
    nextMinute.setSeconds(0, 0);
    const waitTime = nextMinute.getTime() - now.getTime();
    
    // Add small buffer to ensure the minute has actually reset
    return Math.min(waitTime + 2000, 62000); // Max 62 seconds
  }

  /**
   * Wait for rate limit reset with progress callback
   */
  private async waitForRateLimit(error: any, onProgress?: (message: string) => void): Promise<void> {
    const waitTimeMs = this.calculateWaitTime(error);
    const waitTimeSeconds = Math.ceil(waitTimeMs / 1000);
    
    this.logger.debug(`Waiting ${waitTimeSeconds}s for rate limit reset`);
    
    if (onProgress) {
      for (let remaining = waitTimeSeconds; remaining > 0; remaining--) {
        onProgress(`⏳ Quota limit reached. Waiting ${remaining}s for reset...`);
        await this.delay(1000);
      }
      onProgress('🔄 Resuming generation...');
    } else {
      await this.delay(waitTimeMs);
    }
  }

  /**
   * Generate text with smart retry logic - waits for minute quotas, switches keys for daily quotas
   */
  async generateTextWithSmartRetry(
    options: GenerateTextOptions & { 
      onProgress?: (message: string) => void;
      maxRetries?: number;
    }
  ) {
    const { userId, onProgress, maxRetries = 3, ...generateOptions } = options;
    
    // Check allocation if userId provided
    if (userId) {
      const allocationCheck = await this.allocationService.canUserMakeRequest(userId);
      if (!allocationCheck.allowed) {
        throw new Error(`DAILY_LIMIT_EXCEEDED: ${allocationCheck.reason}`);
      }
    }
    
    let lastError: any;
    let currentKeyIndex: number | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Get key info for this attempt
        const keyInfo = this.keyPoolService.getNextAvailableKey();
        if (!keyInfo) {
          throw new Error('No available API keys. All keys are rate limited or exhausted.');
        }
        currentKeyIndex = keyInfo.keyIndex;
        
        const model = this.createModelWithKey(keyInfo.key);
        
        const result = await generateText({
          model,
          prompt: generateOptions.prompt,
          system: generateOptions.system,
          temperature: generateOptions.temperature || 0.7,
        });
        
        // Track successful request
        this.keyPoolService.trackSuccessfulRequest(keyInfo.keyIndex);
        
        // Track allocation if userId provided
        if (userId) {
          await this.allocationService.trackUserRequest(userId);
        }
        
        this.logger.debug(`Successfully generated text using key ${keyInfo.keyIndex} on attempt ${attempt}`);
        return result;
        
      } catch (error) {
        this.logger.error(`Key ${currentKeyIndex} failed on attempt ${attempt}:`, error);
        lastError = error;
        
        // Track failed request if we have a key index
        if (currentKeyIndex !== undefined) {
          this.keyPoolService.trackFailedRequest(currentKeyIndex, error);
        }
        
        // Handle different types of quota errors
        if (this.isMinuteQuotaError(error)) {
          onProgress?.('⚠️ Minute quota exceeded. Smart retry in progress...');
          
          // Wait for minute quota reset instead of switching keys
          await this.waitForRateLimit(error, onProgress);
          
          // Don't increment attempt counter for minute quota waits
          attempt--;
          continue;
          
        } else if (this.isDailyQuotaError(error)) {
          onProgress?.('⚠️ Daily quota exceeded. Switching to backup API key...');
          
          // For daily quota errors, continue to next iteration to try different key
          if (attempt < maxRetries) {
            await this.delay(1000 * attempt); // Brief delay before trying next key
            continue;
          }
          
        } else {
          // For other errors, use progressive backoff
          if (attempt < maxRetries) {
            const backoffDelay = 1000 * Math.pow(2, attempt - 1); // Exponential backoff
            onProgress?.(`🔄 Retrying in ${backoffDelay/1000}s... (${attempt}/${maxRetries})`);
            await this.delay(backoffDelay);
          }
        }
      }
    }
    
    throw new Error(`All retry attempts failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Advanced generateText wrapper with full AI SDK v5 support and smart retry logic
   * Handles multi-step tool usage, thinking mode, and quota management
   */
  async generateTextAdvanced(
    options: AdvancedGenerateTextOptions & { 
      onProgress?: (message: string) => void;
      maxRetries?: number;
    }
  ) {
    const { userId, onProgress, maxRetries = 3, ...generateOptions } = options;
    
    // Check allocation if userId provided
    if (userId) {
      const allocationCheck = await this.allocationService.canUserMakeRequest(userId);
      if (!allocationCheck.allowed) {
        throw new Error(`DAILY_LIMIT_EXCEEDED: ${allocationCheck.reason}`);
      }
    }
    
    let lastError: any;
    let currentKeyIndex: number | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Get key info for this attempt
        const keyInfo = this.keyPoolService.getNextAvailableKey();
        if (!keyInfo) {
          throw new Error('No available API keys. All keys are rate limited or exhausted.');
        }
        currentKeyIndex = keyInfo.keyIndex;
        
        const model = this.createModelWithKey(keyInfo.key);
        
        // Prepare generateText options with all AI SDK v5 features
        const generateTextOptions: any = {
          model,
          system: generateOptions.system,
          messages: generateOptions.messages,
          tools: generateOptions.tools,
          stopWhen: generateOptions.stopWhen,
          temperature: generateOptions.temperature || 0.7,
          maxTokens: generateOptions.maxTokens,
          providerOptions: generateOptions.providerOptions,
          onStepFinish: generateOptions.onStepFinish,
        };

        // Remove undefined properties to avoid AI SDK issues
        Object.keys(generateTextOptions).forEach(key => {
          if (generateTextOptions[key] === undefined) {
            delete generateTextOptions[key];
          }
        });
        
        const result = await generateText(generateTextOptions);
        
        // Track successful request
        this.keyPoolService.trackSuccessfulRequest(keyInfo.keyIndex);
        
        // Track allocation if userId provided
        if (userId) {
          await this.allocationService.trackUserRequest(userId);
        }
        
        this.logger.debug(`Successfully generated advanced text using key ${keyInfo.keyIndex} on attempt ${attempt}`);
        return result;
        
      } catch (error) {
        this.logger.error(`Key ${currentKeyIndex} failed on attempt ${attempt}:`, error);
        lastError = error;
        
        // Track failed request if we have a key index
        if (currentKeyIndex !== undefined) {
          this.keyPoolService.trackFailedRequest(currentKeyIndex, error);
        }
        
        // Handle different types of quota errors
        if (this.isMinuteQuotaError(error)) {
          onProgress?.('⚠️ Minute quota exceeded. Smart retry in progress...');
          
          // Wait for minute quota reset instead of switching keys
          await this.waitForRateLimit(error, onProgress);
          
          // Don't increment attempt counter for minute quota waits
          attempt--;
          continue;
          
        } else if (this.isDailyQuotaError(error)) {
          onProgress?.('⚠️ Daily quota exceeded. Switching to backup API key...');
          
          // For daily quota errors, continue to next iteration to try different key
          if (attempt < maxRetries) {
            await this.delay(1000 * attempt); // Brief delay before trying next key
            continue;
          }
          
        } else {
          // For other errors, use progressive backoff
          if (attempt < maxRetries) {
            const backoffDelay = 1000 * Math.pow(2, attempt - 1); // Exponential backoff
            onProgress?.(`🔄 Retrying in ${backoffDelay/1000}s... (${attempt}/${maxRetries})`);
            await this.delay(backoffDelay);
          }
        }
      }
    }
    
    throw new Error(`All retry attempts failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }
}