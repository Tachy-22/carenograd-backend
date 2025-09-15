# Modular Agent System

A modular AI agent system built with AI SDK v5 that allows you to plug in different tools dynamically.

## Structure

```
├── agent/           # Agent implementation
│   └── index.ts     # Main Agent class and factory
├── tools/           # Tool definitions
│   ├── name-tool.ts # Tool that returns "Tega"
│   ├── age-tool.ts  # Tool that returns "22"
│   └── index.ts     # Tool exports
└── example.ts       # Usage example
```

## Features

- **Modular Design**: Easy to add new tools
- **AI SDK v5**: Uses the latest AI SDK with tool calling
- **TypeScript**: Full type safety
- **Extensible**: Simple to extend with more tools

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Set up your OpenAI API key:
```bash
export OPENAI_API_KEY="your-api-key-here"
```

3. Start the interactive chat:
```bash
npm run agent:chat
```

## Usage

### Interactive Chat

The easiest way to use the agent is through the interactive terminal chat:

```bash
npm run agent:chat
```

This starts an interactive session where you can:
- Ask questions and get responses
- Use web scraping tools naturally in conversation
- See which tools were called for each response
- Get help with available commands and examples

### Programmatic Usage

```typescript
import { createAgent } from './agent';

const agent = createAgent();
const result = await agent.run('Extract the title and main text from https://example.com');
console.log(result.text);
```

### Adding Custom Tools

```typescript
import { Agent } from './agent';
import { tool } from 'ai';
import { z } from 'zod';

// Create a custom tool
const weatherTool = tool({
  description: 'Get weather information',
  inputSchema: z.object({
    location: z.string()
  }),
  execute: async ({ location }) => {
    return `The weather in ${location} is sunny`;
  },
});

// Add it to an agent
const agent = new Agent()
  .addTool('getWeather', weatherTool);

const result = await agent.run('What\'s the weather in New York?');
```

## Available Tools

### Basic Tools
- **getName**: Returns "Tega"
- **getAge**: Returns "22"

### Web Scraping Tool Family
- **fetchHtml**: Fetches raw HTML content from any URL
- **extractText**: Extracts clean text content from webpages
- **extractLinks**: Extracts all links from webpages with filtering options
- **extractMetadata**: Extracts webpage metadata (title, description, Open Graph, Twitter Cards)
- **extractImages**: Extracts all images with their properties
- **scrapeTable**: Converts HTML tables to structured JSON data

### Academic Research Tool Family (Semantic Scholar)
- **searchAuthors**: Find authors by name with detailed information
- **getAuthor**: Get comprehensive author profile including publications
- **searchPapers**: Search for papers by keywords, topics, or research areas
- **getPaper**: Get detailed paper information including citations and references
- **getAuthorPapers**: Get all publications for a specific author with sorting/filtering
- **getRecommendations**: Get paper recommendations based on seed papers

### Google Search Tool Family
- **webSearch**: Basic Google web search with pagination and language filtering
- **advancedSearch**: Advanced search with date restrictions, exact terms, file types, and site filtering
- **imageSearch**: Search for images with size, color, type, and usage rights filters
- **newsSearch**: Search for recent news and articles with date and source filtering
- **siteSearch**: Search within specific websites (GitHub, Reddit, Stack Overflow, etc.)
- **fileSearch**: Search for specific file types (PDF, DOC, PPT, XLS, etc.) with metadata

### Google Sheets Tool Family
- **createSpreadsheet**: Create new Google Sheets spreadsheets with custom properties and initial sheets
- **getSpreadsheet**: Get detailed spreadsheet information including metadata and sheet properties
- **listSpreadsheets**: List all Google Sheets from Google Drive with filtering and pagination
- **readCells**: Read cell values with flexible range selection and formatting options
- **readMultipleRanges**: Read multiple cell ranges in a single batch request
- **writeCells**: Write values to cells with various input options and data types
- **batchWriteCells**: Write to multiple ranges in a single batch operation
- **appendCells**: Append data to the end of existing data ranges
- **formatCells**: Apply comprehensive formatting (colors, fonts, borders, alignment)
- **conditionalFormatting**: Create conditional formatting rules based on cell values
- **clearFormatting**: Remove formatting from specified cell ranges
- **addSheet**: Add new sheets (tabs) to existing spreadsheets
- **deleteSheet**: Remove sheets from spreadsheets
- **duplicateSheet**: Create copies of existing sheets
- **updateSheetProperties**: Modify sheet properties (name, colors, visibility)
- **insertRowsColumns**: Insert new rows or columns with inheritance options
- **deleteRowsColumns**: Remove rows or columns from sheets
- **createChart**: Create various chart types (column, bar, line, pie, scatter, etc.)
- **updateChart**: Modify existing chart properties and styling
- **deleteChart**: Remove charts from spreadsheets
- **createPivotTable**: Generate pivot tables with flexible grouping and aggregation
- **addFormula**: Insert formulas and functions into cells
- **namedRanges**: Create and manage named ranges for easier formula references
- **arrayFormulas**: Add array formulas that automatically expand across cells
- **dataValidation**: Set up data validation rules for controlled data entry
- **lookupFormulasHelper**: Generate complex lookup formulas (VLOOKUP, INDEX-MATCH, etc.)

## How It Works

1. The `Agent` class manages the LLM model and available tools
2. Tools are defined using AI SDK's `tool()` function
3. The agent uses `generateText` with multi-step tool usage
4. Tools are executed automatically when the LLM calls them

## Next Steps

- Add more sophisticated tools (API calls, calculations, etc.)
- Implement tool categories and management
- Add streaming support
- Create tool validation and error handling