# Gemini API Usage Tiers

## Tier Structure Overview

The Gemini API uses a tier-based system that determines your rate limits based on Cloud Billing setup and spending history.

## Free Tier

### Eligibility
- Available to users in eligible countries
- No billing account required
- Suitable for development and testing

### Characteristics
- **Lowest rate limits** across all models
- **Geographic restrictions** apply
- **No cost** for API usage
- **Limited scalability** for production use

### Typical Limits (Example: Gemini 2.5 Flash)
- Very low RPM limits
- Suitable only for prototyping

## Tier 1 (Billing Enabled)

### Requirements
- **Google Cloud Billing account** linked to project
- **Valid payment method** on file
- No minimum spending requirement

### Benefits
- **Significant increase** in rate limits
- **Geographic restrictions removed**
- **Production-ready** limits for moderate usage

### Rate Limit Example (Gemini 2.5 Flash)
- **RPM**: 1,000 (up from ~10 in Free Tier)
- **Substantial improvement** for most applications

## Tier 2 (Moderate Spending)

### Requirements
- **$250+ total Cloud service spend** across all Google Cloud services
- **Minimum 30 days** since first payment
- **Active billing account** maintained

### Benefits
- **Higher rate limits** than Tier 1
- **Better performance** for scaling applications
- **Reduced throttling** risk

### Rate Limit Example (Gemini 2.5 Flash)
- **RPM**: 2,000 (double Tier 1)
- **Suitable for medium-scale applications**

## Tier 3 (High Spending)

### Requirements
- **$1,000+ total Cloud service spend** across all Google Cloud services
- **Minimum 30 days** since first payment
- **Sustained usage pattern** demonstrated

### Benefits
- **Highest available rate limits**
- **Enterprise-grade** quotas
- **Maximum scalability** within standard limits

### Rate Limit Example (Gemini 2.5 Flash)
- **RPM**: 10,000 (10x Tier 1)
- **Suitable for high-scale production applications**

## Tier Progression Strategy

### For Startups/Small Applications
1. **Start with Free Tier** for development
2. **Upgrade to Tier 1** when ready for production
3. **Monitor usage patterns** and costs

### For Growing Applications
1. **Plan spending** to reach Tier 2 ($250)
2. **Distribute spending** across 30+ days
3. **Monitor tier qualification** timeline

### For Enterprise Applications
1. **Budget for Tier 3** qualification ($1,000)
2. **Plan 60+ day timeline** for tier progression
3. **Consider quota increase requests** if needed

## Important Notes

### Spending Calculation
- **All Google Cloud services** count toward spending totals
- **Not just Gemini API usage**
- **Historical spending** from project lifetime

### Timing Requirements
- **30-day minimum** from first payment for higher tiers
- **No immediate upgrades** available
- **Patience required** for tier progression

### Geographic Considerations
- **Free Tier** has geographic restrictions
- **Paid tiers** remove most geographic limitations
- **Check eligibility** by country/region