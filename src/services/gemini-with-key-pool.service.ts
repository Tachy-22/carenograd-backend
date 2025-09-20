import { Injectable, Logger } from '@nestjs/common';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
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
    
    const maxRetries = 3;
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
    const googleProvider = createGoogleGenerativeAI({
      apiKey: apiKey,
    });
    return googleProvider('gemini-2.5-flash');
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
}