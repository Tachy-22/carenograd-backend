# Batch API Specific Limits

## Overview

The Batch API has additional limits beyond the standard rate limits that apply to real-time API calls.

## Concurrent Batch Limits

### Maximum Concurrent Batches
- **Limit**: 100 concurrent batch requests
- **Scope**: Per Google Cloud project
- **Behavior**: Additional batch submissions will be queued or rejected

### Batch Queue Management
- Batches are processed in submission order
- No priority system available
- Failed batches don't automatically retry

## File Size Limitations

### Input File Size
- **Maximum**: 2GB per input file
- **Format**: JSONL (JSON Lines) format required
- **Compression**: Files can be compressed to reduce size

### Total Storage Limit
- **Maximum**: 20GB total file storage
- **Scope**: Per Google Cloud project
- **Cleanup**: Old files should be deleted to free space

## Model-Specific Enqueued Token Limits

### Token Queuing
- Each model has limits on total tokens that can be enqueued
- Prevents excessive resource reservation
- Limits vary by model and tier

### Batch Processing Priority
- Smaller batches may process faster
- Token limits can cause batch delays
- Balance batch size with processing time

## Best Practices for Batch API

### File Management
1. **Monitor storage usage** regularly
2. **Delete processed files** to free space
3. **Compress large files** before upload
4. **Split large datasets** into multiple smaller batches

### Batch Size Optimization
1. **Balance file size** with processing time
2. **Consider token limits** when creating batches
3. **Test with smaller batches** first
4. **Monitor processing time** for optimization

### Concurrent Request Management
1. **Don't exceed 100 concurrent batches**
2. **Queue additional batches** when limit reached
3. **Monitor batch status** for completion
4. **Plan batch submission timing**

## Error Handling

### File Size Errors
- Reduce file size or split into multiple files
- Use compression to reduce file size
- Check file format (must be JSONL)

### Storage Limit Errors
- Delete old or unnecessary files
- Monitor storage usage proactively
- Implement automatic cleanup procedures

### Concurrency Errors
- Implement queue system for batch submissions
- Monitor active batch count
- Retry submission when slots become available

## Monitoring and Optimization

### Key Metrics to Track
1. **Active batch count** (max 100)
2. **Total storage used** (max 20GB)
3. **Average processing time** per batch
4. **File size distribution**
5. **Token usage** per batch

### Optimization Strategies
1. **Batch size tuning** for optimal processing
2. **File compression** to maximize storage
3. **Cleanup automation** for old files
4. **Load balancing** across time periods
5. **Model selection** based on batch requirements

## Integration with Standard Limits

### How Batch API Interacts with Rate Limits
- Batch processing **does not** count against real-time RPM
- Batch token usage **may** count against TPM during processing
- Daily limits (RPD) **may** include batch requests

### Planning Considerations
- Reserve some quota for real-time requests
- Monitor total token usage across both APIs
- Plan batch timing to avoid peak usage periods