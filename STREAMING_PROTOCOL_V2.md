# Streaming Protocol V2 - Pure AI SDK v1 Compatible

## Overview

This protocol is **100% AI SDK v1 compatible** - using a single continuous text block with content-based differentiation between progress and final response.

## Stream Structure

```
1. Message Start
2. Single Text Block Start
3. Progress Updates (as text-delta chunks)
4. Visual Separator
5. Final Response (as text-delta chunks)  
6. Single Text Block End
7. Metadata
8. Message Finish
```

## Event Types (Pure AI SDK v1)

### Core Message Events
- `start` - Message begins
- `finish` - Message complete  
- `error` - Error occurred

### Text Events (Single Continuous Block)
- `text-start` - Single text block begins
- `text-delta` - Content chunk (progress updates + separator + final response)
- `text-end` - Single text block complete

### Tool Events
- `tool-input-start` - Tool execution begins
- `tool-input-available` - Tool parameters available
- `tool-output-available` - Tool results available

### Metadata Events
- `data-conversation` - Conversation metadata

## Content Structure

The single text block uses a **standard ID** like `text_1234_abc789` and contains:
1. **Progress updates** - Real-time status messages
2. **Visual separator** - `\n\n---\n\n` to divide sections
3. **Final response** - The actual answer/result

Frontend can identify the stream type from the ID prefix and parse content accordingly.

## Example Stream Flow (Pure AI SDK v1)

```json
// 1. Message Start
{"type": "start", "messageId": "msg_123"}

// 2. Single Text Block Start  
{"type": "text-start", "id": "text_456"}

// 3. Progress Updates (continuous in same block)
{"type": "text-delta", "id": "text_456", "delta": "🎯 Getting started...\n"}
{"type": "text-delta", "id": "text_456", "delta": "🔄 Working on it...\n"}

// 4. Tool Execution (standard AI SDK)
{"type": "tool-input-start", "toolCallId": "tool_789", "toolName": "ai-tool"}
{"type": "tool-input-available", "toolCallId": "tool_789", "input": {"description": "Using webSearch"}}
{"type": "tool-output-available", "toolCallId": "tool_789", "output": {"result": "Search completed"}}

// 5. More Progress Updates
{"type": "text-delta", "id": "text_456", "delta": "✨ researcher completed web_research\n"}

// 6. Separator + Final Response (same block)
{"type": "text-delta", "id": "text_456", "delta": "\n\n---\n\nGeorgia Tech's main campus is located in Atlanta, Georgia, USA..."}

// 7. Single Text Block End
{"type": "text-end", "id": "text_456"}

// 8. Conversation Metadata
{"type": "data-conversation", "data": {"conversationId": "conv_999", "messageId": "msg_123"}}

// 9. Message Finish
{"type": "finish"}
```

**Final Content Structure:**
```
🎯 Getting started...
🔄 Working on it...
✨ researcher completed web_research

---

Georgia Tech's main campus is located in Atlanta, Georgia, USA...
```

## Frontend Integration

### Content Parsing Approach
```typescript
let accumulatedContent = '';
let inResponseSection = false;

function handleStreamEvent(event: StreamEvent) {
  if (event.type === 'text-delta') {
    accumulatedContent += event.delta;
    
    // Check if we hit the separator
    if (accumulatedContent.includes('\n\n---\n\n') && !inResponseSection) {
      inResponseSection = true;
      const parts = accumulatedContent.split('\n\n---\n\n');
      const progressContent = parts[0];
      const responseStart = parts[1] || '';
      
      // Show progress in progress area
      updateProgressUI(progressContent);
      
      // Show response start in response area
      if (responseStart) {
        updateResponseUI(responseStart);
      }
    } else if (inResponseSection) {
      // We're in response section, add to response UI
      updateResponseUI(event.delta);
    } else {
      // Still in progress section
      updateProgressUI(event.delta);
    }
  }
}
```

### Alternative: Split on Text-End
```typescript
let fullContent = '';

function handleStreamEvent(event: StreamEvent) {
  if (event.type === 'text-delta') {
    fullContent += event.delta;
    // Show everything in a combined view during streaming
    updateCombinedUI(fullContent);
  }
  
  if (event.type === 'text-end') {
    // Parse complete content when done
    const parts = fullContent.split('\n\n---\n\n');
    const progressContent = parts[0] || '';
    const responseContent = parts[1] || '';
    
    // Update separate UI areas with final content
    updateProgressUI(progressContent);
    updateResponseUI(responseContent);
  }
}
```

## Key Benefits

1. **100% AI SDK v1 Compatible**: No validation errors, works with standard AI SDK
2. **Content-Based Differentiation**: Uses visual separator to distinguish progress from response
3. **Single Stream**: Maintains AI SDK's expected single text block structure
4. **Tool Integration**: Standard tool events work normally
5. **Simple Parsing**: Frontend can split content on separator when needed

## AI SDK v1 Compliance

**✅ Yes, this will pass AI SDK v5 tests because:**

- Uses standard `start`, `text-start`, `text-delta`, `text-end`, `finish` events
- Single continuous text block (no separate blocks)
- No custom properties on standard events  
- Standard tool event structure
- Pure `data-conversation` metadata events

**The only "difference" is content structure within the text, which AI SDK doesn't validate.**

## Frontend Options

1. **Live Parsing**: Split content on `---` separator as it streams
2. **End Parsing**: Parse complete content when `text-end` arrives
3. **Combined View**: Show everything together, let user see the separation
4. **Progressive Enhancement**: Start combined, split when separator detected

This approach gives you differentiation capabilities while being completely compatible with AI SDK v1.