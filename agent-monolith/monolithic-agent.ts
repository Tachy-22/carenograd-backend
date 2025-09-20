import { generateText, LanguageModel, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';
import { GeminiWithKeyPoolService } from '../src/services/gemini-with-key-pool.service';
import {
  googleSheetsTools,
  gmailTools,
  webScrapingTools,
  ragTools,
  documentManagementTools,
  googleSearchTools
} from '../tools';
import { authContext } from '../utils/auth-context';
import { COMPREHENSIVE_SYSTEM_PROMPT } from './comprehensive-system-prompt';

export interface UserContext {
  accessToken?: string;
  tokenExpiresAt?: Date;
  userId: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
}

export interface AgentResult {
  success: boolean;
  response: string;
  executionTime: number;
  stepsUsed: number;
  toolsUsed: string[];
  errors?: string[];
}

export interface ProgressUpdate {
  message: string;
  step?: number;
  totalSteps?: number;
  toolsUsed?: string[];
}

export class MonolithicAgent {
  private model = google('gemini-2.5-flash');
  private allTools: Record<string, any> = {};
  private logger = console; // Simple logger for now

  constructor(private geminiService?: GeminiWithKeyPoolService) {
    this.initializeTools();
  }

  private initializeTools(): void {
    // Combine ALL tools into single comprehensive toolset
    this.allTools = {
      ...googleSheetsTools,
      ...gmailTools,
      ...webScrapingTools,
      ...ragTools,
      ...documentManagementTools,
      ...googleSearchTools
    };

    const toolNames = Object.keys(this.allTools);
    console.log(`🔧 Monolithic Agent initialized with ${toolNames.length} tools`);
    console.log(`📊 Available categories: Sheets(${this.getToolsByCategory('sheets').length}), Gmail(${this.getToolsByCategory('gmail').length}), Research(${this.getToolsByCategory('research').length}), GoogleSearch(${this.getToolsByCategory('googlesearch').length}), Documents(${this.getToolsByCategory('documents').length})`);
  }

  /**
   * Main execution method following AI SDK v5 Multi-Step Tool Usage pattern
   * Single agent with ALL tools, using stopWhen for multi-step execution
   */
  async executeTask(
    userMessage: string,
    context: UserContext,
    onProgress?: (update: ProgressUpdate) => void
  ): Promise<AgentResult> {
    const startTime = Date.now();
    let stepsUsed = 0;
    const toolsUsed: string[] = [];
    let keyIndex: number | undefined; // Declare in broader scope for error handling

    try {
      // Set auth context if available
      if (context.accessToken) {
        authContext.setAccessToken(context.accessToken, context.tokenExpiresAt);
        console.log(`🔑 Set access token for user ${context.userId}`);
      }

      onProgress?.({ message: '🎯 Analyzing your request and planning complete workflow...' });

      // Prepare conversation history
      const messages = context.conversationHistory?.map(msg => ({
        role: msg.role,
        content: msg.content
      })) || [];

      // Add current user message
      messages.push({
        role: 'user' as const,
        content: userMessage
      });

      let currentStep = 0;
      let modelToUse: LanguageModel = this.model;

      // Use multi-API key system if available
      if (this.geminiService) {
        try {
          const { model, keyIndex: kIndex } = await this.geminiService.createModelForUser(context.userId);
          modelToUse = model;
          keyIndex = kIndex;

          onProgress?.({
            message: '🔧 Using multi-API key rotation system...',
            step: 0
          });
        } catch (error) {
          this.logger?.error('Failed to create model with multi-API system, falling back to single key:', error);
          // Fall back to single key
          modelToUse = this.model;
        }
      }

      // Execute using AI SDK v5 Multi-Step Tool Usage pattern
      const result = await generateText({
        model: modelToUse,
        system: `${COMPREHENSIVE_SYSTEM_PROMPT}

## USER CONTEXT
userId: ${context.userId}
**IMPORTANT**: When calling document tools (queryDocumentMultiUserTool, listUserDocumentsTool), always use userId: "${context.userId}"`,
        messages,
        tools: this.allTools, // ALL tools available
        stopWhen: stepCountIs(25), // Allow for complex multi-step workflows
        providerOptions: {
          google: {
            thinkingConfig: {
              thinkingBudget: 8192,
              includeThoughts: true,
            },
          },
        },
        onStepFinish: ({ toolCalls, text }) => {
          currentStep++;
          stepsUsed = currentStep;

          if (toolCalls && toolCalls.length > 0) {
            const newTools = toolCalls.map(tc => tc.toolName);
            toolsUsed.push(...newTools);

            // Show actual agent reasoning with tool details
            const toolDetails = toolCalls.map(tc => {
              // Extract key details from tool arguments
              const argSummary = this.summarizeToolArgs(tc.toolName, tc);
              return argSummary ? `${tc.toolName}(${argSummary})` : tc.toolName;
            }).join(', ');
            
            // Use agent's actual reasoning text if available, otherwise show tool details
            const reasoningText = text && text.trim() ? text.trim() : `Using tools: ${toolDetails}`;
            
            onProgress?.({
              message: `💭 Step ${currentStep}: ${reasoningText}`,
              step: currentStep,
              toolsUsed: newTools
            });
          } else if (text && text.trim()) {
            // Show agent's reasoning when no tools are called
            onProgress?.({
              message: `🧠 Step ${currentStep}: ${text.trim()}`,
              step: currentStep
            });
          } else {
            onProgress?.({
              message: `⚡ Step ${currentStep}: Processing and analyzing...`,
              step: currentStep
            });
          }
        }
      });

      // Track successful usage if using multi-API system
      if (this.geminiService && keyIndex !== undefined) {
        await this.geminiService.trackSuccessfulUsage(context.userId, keyIndex);
      }

      const response = await result.text;

      onProgress?.({ message: '✅ Complete workflow executed successfully!' });

      return {
        success: true,
        response,
        executionTime: Date.now() - startTime,
        stepsUsed,
        toolsUsed: [...new Set(toolsUsed)]
      };

    } catch (error) {
      console.error('Monolithic Agent error:', error);

      // Track failed usage if using multi-API system
      if (this.geminiService && keyIndex !== undefined) {
        this.geminiService.trackFailedUsage(keyIndex, error);
      }

      return {
        success: false,
        response: `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Let me try a different approach or you can rephrase your request.`,
        executionTime: Date.now() - startTime,
        stepsUsed,
        toolsUsed: [...new Set(toolsUsed)],
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Summarize tool arguments for progress display
   */
  private summarizeToolArgs(toolName: string, toolCall: any): string {
    try {
      // Handle different tool call formats
      const args = toolCall.args || toolCall.parameters || {};
      
      switch (toolName) {
        case 'queryDocumentMultiUserTool':
          return `query: "${args.query || 'documents'}"`;
        case 'semanticScholarSearchTool':
          return `search: "${args.query || args.searchQuery || 'research'}"`;
        case 'googleSearchTool':
          return `search: "${args.query || args.q || 'web search'}"`;
        case 'createSpreadsheetTool':
          return `name: "${args.name || args.title || 'spreadsheet'}"`;
        case 'updateCellsTool':
          return `updating cells in ${args.spreadsheetId || 'spreadsheet'}`;
        case 'sendEmailTool':
          return `to: ${args.to || 'recipient'}`;
        case 'createDraftTool':
          return `subject: "${args.subject || 'email draft'}"`;
        case 'extractUrlContentTool':
          return `url: ${args.url || 'webpage'}`;
        default:
          // For unknown tools, try to extract meaningful info
          if (args.query) return `query: "${args.query}"`;
          if (args.url) return `url: ${args.url}`;
          if (args.name || args.title) return `name: "${args.name || args.title}"`;
          if (args.subject) return `subject: "${args.subject}"`;
          return '';
      }
    } catch (error) {
      return '';
    }
  }

  /**
   * Generate contextual progress messages based on tools being used
   */
  private generateProgressMessage(toolNames: string[], step: number): string {
    const toolCategories = this.categorizeTools(toolNames);

    if (toolCategories.documents.length > 0) {
      return `📄 Step ${step}: Analyzing your documents and background...`;
    }

    if (toolCategories.research.length > 0 || toolCategories.googlesearch.length > 0) {
      return `🔍 Step ${step}: Researching professors and university information...`;
    }

    if (toolCategories.sheets.length > 0) {
      return `📊 Step ${step}: Setting up/updating your application tracking system...`;
    }

    if (toolCategories.gmail.length > 0) {
      return `✉️ Step ${step}: Working on email drafts and communication...`;
    }

    return `🔧 Step ${step}: Using ${toolNames.join(', ')}`;
  }

  /**
   * Categorize tools for progress messaging
   */
  private categorizeTools(toolNames: string[]): {
    sheets: string[];
    gmail: string[];
    research: string[];
    googlesearch: string[];
    documents: string[];
    other: string[];
  } {
    return {
      sheets: toolNames.filter(t => t.includes('Spreadsheet') || t.includes('Sheet') || t.includes('Cells')),
      gmail: toolNames.filter(t => t.includes('Email') || t.includes('Draft') || t.includes('Label')),
      research: toolNames.filter(t => t.includes('semantic') || t.includes('Semantic') || t.includes('extract') || t.includes('Url')),
      googlesearch: toolNames.filter(t => t.includes('Search') && !t.includes('semantic')),
      documents: toolNames.filter(t => t.includes('Document') || t.includes('query') || t.includes('upload')),
      other: toolNames.filter(t =>
        !t.includes('Spreadsheet') && !t.includes('Sheet') && !t.includes('Cells') &&
        !t.includes('Email') && !t.includes('Draft') && !t.includes('Label') &&
        !t.includes('Search') && !t.includes('semantic') && !t.includes('extract') &&
        !t.includes('Document') && !t.includes('query') && !t.includes('upload')
      )
    };
  }

  /**
   * Get tools by category for analytics
   */
  private getToolsByCategory(category: 'sheets' | 'gmail' | 'research' | 'googlesearch' | 'documents'): string[] {
    const tools = Object.keys(this.allTools);

    switch (category) {
      case 'sheets':
        return tools.filter(t => t.includes('Spreadsheet') || t.includes('Sheet') || t.includes('Cells'));
      case 'gmail':
        return tools.filter(t => t.includes('Email') || t.includes('Draft') || t.includes('Label'));
      case 'research':
        return tools.filter(t => t.includes('semantic') || t.includes('Semantic') || t.includes('extract') || t.includes('Url'));
      case 'googlesearch':
        return tools.filter(t => t.includes('Search') && !t.includes('semantic'));
      case 'documents':
        return tools.filter(t => t.includes('Document') || t.includes('query'));
      default:
        return [];
    }
  }

  /**
   * Get all available tools
   */
  getAvailableTools(): string[] {
    return Object.keys(this.allTools);
  }

  /**
   * Test individual tool functionality
   */
  async testTool(toolName: string, args: any): Promise<any> {
    if (!this.allTools[toolName]) {
      throw new Error(`Tool ${toolName} not found`);
    }

    const tool = this.allTools[toolName];
    if (!tool.execute) {
      throw new Error(`Tool ${toolName} missing execute function`);
    }

    return await tool.execute(args);
  }

  /**
   * Get comprehensive tool inventory for debugging
   */
  getToolInventory(): {
    total: number;
    byCategory: Record<string, string[]>;
    allTools: string[];
  } {
    const allTools = Object.keys(this.allTools);

    return {
      total: allTools.length,
      byCategory: {
        sheets: this.getToolsByCategory('sheets'),
        gmail: this.getToolsByCategory('gmail'),
        research: this.getToolsByCategory('research'),
        documents: this.getToolsByCategory('documents')
      },
      allTools
    };
  }
}