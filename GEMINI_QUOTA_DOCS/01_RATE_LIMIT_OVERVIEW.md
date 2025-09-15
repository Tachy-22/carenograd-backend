# Gemini API Rate Limits Overview

## Rate Limit Dimensions

The Gemini API enforces rate limits across three key dimensions:

### 1. Requests Per Minute (RPM)
- **Definition**: Maximum number of API requests allowed per minute
- **Scope**: Applied per Google Cloud project
- **Reset**: Continuous sliding window

### 2. Tokens Per Minute (TPM)
- **Definition**: Maximum number of tokens (input + output) processed per minute
- **Scope**: Applied per Google Cloud project
- **Reset**: Continuous sliding window
- **Note**: Both input and output tokens count toward this limit

### 3. Requests Per Day (RPD)
- **Definition**: Maximum number of API requests allowed per day
- **Scope**: Applied per Google Cloud project
- **Reset**: Daily at midnight Pacific Time (PT/PDT)

## Key Characteristics

### Project-Level Limits
- **Important**: Rate limits apply per Google Cloud project, not per API key
- Multiple API keys under the same project share the same quota
- This means all users/applications using keys from the same project share limits

### Error Handling
- Exceeding any dimension triggers a rate limit error
- HTTP 429 status code returned
- Error response includes retry-after header when possible

### Monitoring Requirements
- Must monitor all three dimensions simultaneously
- Exceeding any single dimension will trigger rate limiting
- Different models have different limit values

## Rate Limit Enforcement
- Limits are enforced in real-time
- No grace period or burst allowance
- Immediate throttling when limits exceeded
- Automatic reset based on dimension type (minute/day)

## Best Practices for Rate Limit Management
1. **Monitor All Dimensions**: Track RPM, TPM, and RPD usage
2. **Implement Retry Logic**: Handle 429 errors with exponential backoff
3. **Batch Requests**: Use batch API when appropriate to optimize usage
4. **Plan for Growth**: Understand tier progression requirements
5. **Load Distribution**: Spread requests evenly across time periods