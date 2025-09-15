# Implementation Guide for Gemini Quota Management

## Architecture Overview

### Core Components for Quota Management

```typescript
interface QuotaManager {
  trackUsage(usage: TokenUsage): Promise<void>;
  checkQuota(estimatedTokens: number): Promise<QuotaCheckResult>;
  getQuotaStatus(): Promise<QuotaStatus>;
  resetCounters(): Promise<void>;
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  timestamp: Date;
  requestId: string;
}

interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  suggestedModel?: string;
  remainingQuota: QuotaLimits;
}
```

## Database Schema for Quota Tracking

### Token Usage Table
```sql
CREATE TABLE token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  model_name VARCHAR(50) NOT NULL,
  request_id VARCHAR(100),
  conversation_id UUID,
  message_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_token_usage_user_time ON token_usage(user_id, created_at);
CREATE INDEX idx_token_usage_model_time ON token_usage(model_name, created_at);
```

### Quota Status Tracking
```sql
CREATE TABLE quota_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) UNIQUE,
  current_tier VARCHAR(20) DEFAULT 'free',
  
  -- Minute-based counters
  requests_current_minute INTEGER DEFAULT 0,
  tokens_current_minute INTEGER DEFAULT 0,
  minute_window_start TIMESTAMP WITH TIME ZONE,
  
  -- Daily counters
  requests_current_day INTEGER DEFAULT 0,
  day_window_start DATE,
  
  -- Limits based on tier
  rpm_limit INTEGER DEFAULT 10,
  tpm_limit INTEGER DEFAULT 250000,
  rpd_limit INTEGER DEFAULT 250,
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Service Implementation

### Quota Management Service
```typescript
@Injectable()
export class QuotaManagerService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService
  ) {}

  async checkQuota(userId: string, estimatedTokens: number, model: string): Promise<QuotaCheckResult> {
    const quotaStatus = await this.getQuotaStatus(userId);
    const limits = this.getLimitsForTier(quotaStatus.currentTier, model);
    
    // Check RPM limit
    if (quotaStatus.requestsCurrentMinute >= limits.rpm) {
      return {
        allowed: false,
        reason: `RPM limit exceeded (${limits.rpm} requests/minute)`,
        suggestedModel: this.suggestAlternativeModel(model, limits)
      };
    }
    
    // Check TPM limit
    if (quotaStatus.tokensCurrentMinute + estimatedTokens > limits.tpm) {
      return {
        allowed: false,
        reason: `TPM limit would be exceeded (${limits.tpm} tokens/minute)`,
        suggestedModel: this.suggestEfficientModel(model)
      };
    }
    
    // Check RPD limit
    if (quotaStatus.requestsCurrentDay >= limits.rpd) {
      return {
        allowed: false,
        reason: `Daily request limit exceeded (${limits.rpd} requests/day)`
      };
    }
    
    return {
      allowed: true,
      remainingQuota: {
        rpm: limits.rpm - quotaStatus.requestsCurrentMinute,
        tpm: limits.tpm - quotaStatus.tokensCurrentMinute,
        rpd: limits.rpd - quotaStatus.requestsCurrentDay
      }
    };
  }

  async recordUsage(usage: TokenUsage): Promise<void> {
    // Record in usage history
    await this.databaseService.recordTokenUsage(usage);
    
    // Update quota counters
    await this.updateQuotaCounters(usage);
    
    // Reset counters if windows have passed
    await this.resetExpiredCounters(usage.userId);
  }

  private async updateQuotaCounters(usage: TokenUsage): Promise<void> {
    const now = new Date();
    
    await this.databaseService.query(`
      UPDATE quota_status 
      SET 
        requests_current_minute = requests_current_minute + 1,
        tokens_current_minute = tokens_current_minute + $1,
        requests_current_day = requests_current_day + 1,
        updated_at = $2
      WHERE user_id = $3
    `, [usage.totalTokens, now, usage.userId]);
  }

  private async resetExpiredCounters(userId: string): Promise<void> {
    const now = new Date();
    const currentMinute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
    const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    await this.databaseService.query(`
      UPDATE quota_status 
      SET 
        requests_current_minute = CASE 
          WHEN minute_window_start < $1 THEN 0 
          ELSE requests_current_minute 
        END,
        tokens_current_minute = CASE 
          WHEN minute_window_start < $1 THEN 0 
          ELSE tokens_current_minute 
        END,
        minute_window_start = $1,
        requests_current_day = CASE 
          WHEN day_window_start < $2 THEN 0 
          ELSE requests_current_day 
        END,
        day_window_start = $2
      WHERE user_id = $3
    `, [currentMinute, currentDay, userId]);
  }
}
```

## Rate Limiting Middleware

### Express/NestJS Middleware
```typescript
@Injectable()
export class QuotaMiddleware implements NestMiddleware {
  constructor(private readonly quotaManager: QuotaManagerService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const user = req.user as User; // Assumes authentication middleware
    
    if (!user) {
      return next(); // Skip quota check for unauthenticated requests
    }

    // Estimate tokens based on request
    const estimatedTokens = this.estimateTokens(req.body);
    const model = req.body.model || 'gemini-2.5-flash';
    
    const quotaCheck = await this.quotaManager.checkQuota(
      user.id, 
      estimatedTokens, 
      model
    );
    
    if (!quotaCheck.allowed) {
      return res.status(429).json({
        error: 'Quota exceeded',
        message: quotaCheck.reason,
        suggestedModel: quotaCheck.suggestedModel,
        retryAfter: this.calculateRetryAfter(quotaCheck.reason)
      });
    }
    
    // Add quota info to request for later usage recording
    req.quotaInfo = {
      estimatedTokens,
      model,
      checkTime: new Date()
    };
    
    next();
  }

  private estimateTokens(requestBody: any): number {
    // Simple estimation based on request content
    const prompt = requestBody.prompt || requestBody.message || '';
    return Math.max(100, prompt.length * 0.75); // Rough token estimation
  }

  private calculateRetryAfter(reason: string): number {
    if (reason.includes('RPM')) return 60; // Wait 1 minute for RPM
    if (reason.includes('TPM')) return 60; // Wait 1 minute for TPM
    if (reason.includes('daily')) return 86400; // Wait until tomorrow for daily
    return 300; // Default 5 minutes
  }
}
```

## Integration with AI SDK

### Wrapper for AI SDK Calls
```typescript
@Injectable()
export class GeminiService {
  constructor(
    private readonly quotaManager: QuotaManagerService,
    private readonly google: GoogleGenerativeAI
  ) {}

  async generateText(prompt: string, options: GenerateOptions, userId: string): Promise<GenerateResult> {
    // Pre-flight quota check
    const estimatedTokens = this.estimateTokens(prompt);
    const quotaCheck = await this.quotaManager.checkQuota(userId, estimatedTokens, options.model);
    
    if (!quotaCheck.allowed) {
      throw new QuotaExceededException(quotaCheck.reason, quotaCheck.suggestedModel);
    }

    const startTime = Date.now();
    
    try {
      // Make the actual API call
      const result = await generateText({
        model: google(options.model),
        prompt,
        ...options
      });

      // Record actual usage
      await this.quotaManager.recordUsage({
        promptTokens: result.usage?.promptTokens || estimatedTokens,
        completionTokens: result.usage?.completionTokens || 0,
        totalTokens: result.usage?.totalTokens || estimatedTokens,
        model: options.model,
        userId,
        timestamp: new Date(),
        requestId: generateRequestId(),
        executionTime: Date.now() - startTime
      });

      return result;
    } catch (error) {
      // Still record estimated usage for failed requests
      await this.quotaManager.recordUsage({
        promptTokens: estimatedTokens,
        completionTokens: 0,
        totalTokens: estimatedTokens,
        model: options.model,
        userId,
        timestamp: new Date(),
        requestId: generateRequestId(),
        executionTime: Date.now() - startTime,
        error: true
      });
      
      throw error;
    }
  }
}
```

## Monitoring Dashboard Implementation

### Dashboard API Endpoints
```typescript
@Controller('quota')
export class QuotaDashboardController {
  constructor(private readonly quotaManager: QuotaManagerService) {}

  @Get('status/:userId')
  async getUserQuotaStatus(@Param('userId') userId: string) {
    return await this.quotaManager.getQuotaStatus(userId);
  }

  @Get('usage/:userId')
  async getUserUsageHistory(@Param('userId') userId: string, @Query() query: any) {
    const timeRange = query.range || '24h';
    return await this.quotaManager.getUsageHistory(userId, timeRange);
  }

  @Get('system/overview')
  async getSystemOverview() {
    return await this.quotaManager.getSystemQuotaOverview();
  }
}
```

### Frontend Dashboard Component
```typescript
interface QuotaStatus {
  currentUsage: {
    rpm: number;
    tpm: number;
    rpd: number;
  };
  limits: {
    rpm: number;
    tpm: number;
    rpd: number;
  };
  utilizationPercentage: {
    rpm: number;
    tpm: number;
    rpd: number;
  };
  tier: string;
  warningLevel: 'low' | 'medium' | 'high' | 'critical';
}

export function QuotaDashboard({ userId }: { userId: string }) {
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);

  useEffect(() => {
    const fetchQuotaStatus = async () => {
      const response = await fetch(`/api/quota/status/${userId}`);
      const status = await response.json();
      setQuotaStatus(status);
    };

    fetchQuotaStatus();
    const interval = setInterval(fetchQuotaStatus, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [userId]);

  return (
    <div className="quota-dashboard">
      <h2>Quota Usage</h2>
      {quotaStatus && (
        <>
          <QuotaMetric 
            label="Requests per Minute"
            current={quotaStatus.currentUsage.rpm}
            limit={quotaStatus.limits.rpm}
            percentage={quotaStatus.utilizationPercentage.rpm}
          />
          <QuotaMetric 
            label="Tokens per Minute"
            current={quotaStatus.currentUsage.tpm}
            limit={quotaStatus.limits.tpm}
            percentage={quotaStatus.utilizationPercentage.tpm}
          />
          <QuotaMetric 
            label="Requests per Day"
            current={quotaStatus.currentUsage.rpd}
            limit={quotaStatus.limits.rpd}
            percentage={quotaStatus.utilizationPercentage.rpd}
          />
        </>
      )}
    </div>
  );
}
```

This implementation provides a comprehensive quota management system that can be integrated into your existing application architecture.