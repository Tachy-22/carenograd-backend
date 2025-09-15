# Model-Specific Rate Limits

## Free Tier Limits

### Gemini 2.5 Pro
- **RPM**: 5 requests per minute
- **TPM**: 250,000 tokens per minute
- **RPD**: 100 requests per day
- **Use Case**: Light testing and development

### Gemini 2.5 Flash
- **RPM**: 10 requests per minute
- **TPM**: 250,000 tokens per minute
- **RPD**: 250 requests per day
- **Use Case**: Basic prototyping with faster model

### Gemini 2.5 Flash-Lite
- **RPM**: 15 requests per minute
- **TPM**: 250,000 tokens per minute
- **RPD**: 1,000 requests per day
- **Use Case**: Lightweight applications, highest free tier throughput

## Tier 1 Limits (Billing Enabled)

### Gemini 2.5 Pro
- **RPM**: 150 requests per minute
- **TPM**: 2,000,000 tokens per minute
- **RPD**: 10,000 requests per day
- **Scaling Factor**: 30x RPM increase from Free Tier

### Gemini 2.5 Flash
- **RPM**: 1,000 requests per minute
- **TPM**: 1,000,000 tokens per minute
- **RPD**: 10,000 requests per day
- **Scaling Factor**: 100x RPM increase from Free Tier

### Gemini 2.5 Flash-Lite
- **RPM**: 4,000 requests per minute
- **TPM**: 4,000,000 tokens per minute
- **RPD**: No daily limit specified
- **Scaling Factor**: 267x RPM increase from Free Tier

## Tier 2 Limits ($250+ Spending)

### Gemini 2.5 Pro
- **RPM**: 1,000 requests per minute
- **TPM**: 5,000,000 tokens per minute
- **RPD**: 50,000 requests per day
- **Scaling Factor**: 6.7x RPM increase from Tier 1

### Gemini 2.5 Flash
- **RPM**: 2,000 requests per minute
- **TPM**: 3,000,000 tokens per minute
- **RPD**: 100,000 requests per day
- **Scaling Factor**: 2x RPM increase from Tier 1

### Gemini 2.5 Flash-Lite
- **RPM**: 10,000 requests per minute
- **TPM**: 10,000,000 tokens per minute
- **RPD**: No daily limit specified
- **Scaling Factor**: 2.5x RPM increase from Tier 1

## Tier 3 Limits ($1,000+ Spending)

### Gemini 2.5 Pro
- **RPM**: 2,000 requests per minute
- **TPM**: 8,000,000 tokens per minute
- **RPD**: No daily limit specified
- **Scaling Factor**: 2x RPM increase from Tier 2

### Gemini 2.5 Flash
- **RPM**: 10,000 requests per minute
- **TPM**: 8,000,000 tokens per minute
- **RPD**: No daily limit specified
- **Scaling Factor**: 5x RPM increase from Tier 2

### Gemini 2.5 Flash-Lite
- **RPM**: 30,000 requests per minute
- **TPM**: 30,000,000 tokens per minute
- **RPD**: No daily limit specified
- **Scaling Factor**: 3x RPM increase from Tier 2

## Model Selection Guidance

### Gemini 2.5 Pro
- **Best For**: Complex reasoning, analysis, coding tasks
- **Characteristics**: Highest quality output, slower processing
- **Rate Limit Strategy**: Lower RPM but high TPM allows for longer conversations

### Gemini 2.5 Flash
- **Best For**: Balanced performance and speed
- **Characteristics**: Good quality, faster than Pro
- **Rate Limit Strategy**: Higher RPM makes it suitable for interactive applications

### Gemini 2.5 Flash-Lite
- **Best For**: Simple tasks, high-throughput applications
- **Characteristics**: Fastest processing, good for basic tasks
- **Rate Limit Strategy**: Highest RPM allows for maximum request volume

## Optimization Strategies by Model

### For Pro Models
- **Batch longer conversations** to maximize TPM usage
- **Use for complex tasks** that justify the lower RPM
- **Consider request queuing** to smooth out usage patterns

### For Flash Models
- **Leverage higher RPM** for interactive applications
- **Good balance** between quality and throughput
- **Suitable for real-time applications**

### For Flash-Lite Models
- **Maximize request volume** with simple prompts
- **Use for classification** and simple generation tasks
- **Ideal for high-frequency, low-complexity operations**