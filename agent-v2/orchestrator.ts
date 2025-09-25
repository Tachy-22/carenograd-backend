import { generateObject, generateText, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import {
  googleSheetsTools,
  gmailTools,
  webScrapingTools,
  ragTools,
  documentManagementTools
} from '../tools';
import { authContext } from '../utils/auth-context';
import { UserContext, TaskPlan, ExecutionResult, ProgressUpdate } from './types';
import { getSystemPrompt } from './system-prompts';

export class OrchestratorWorker {
  private model = google('gemini-2.0-flash');
  private allTools: Record<string, any> = {};

  constructor() {
    this.initializeTools();
  }

  private initializeTools(): void {
    // Combine all tools following the existing pattern
    this.allTools = {
      ...googleSheetsTools,
      ...gmailTools,
      ...webScrapingTools,
      ...ragTools,
      ...documentManagementTools
    };

    const toolNames = Object.keys(this.allTools);
    console.log(`🔧 Initialized ${toolNames.length} tools:`);
    console.log(`📊 Sheets tools: ${toolNames.filter(t => t.includes('Spreadsheet') || t.includes('Sheet') || t.includes('Cells')).join(', ')}`);
    console.log(`📧 Gmail tools: ${toolNames.filter(t => t.includes('Email') || t.includes('Gmail')).slice(0, 5).join(', ')}...`);
  }

  /**
   * Main execution method following AI SDK v5 Orchestrator-Worker pattern
   */
  async executeTask(
    userMessage: string,
    context: UserContext,
    onProgress?: (update: ProgressUpdate) => void
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    let stepsUsed = 0;
    const toolsUsed: string[] = [];

    try {
      // Set auth context if available
      if (context.accessToken) {
        authContext.setAccessToken(context.accessToken, context.tokenExpiresAt);
        console.log(`🔑 Set access token for user ${context.userId}`);
      }

      onProgress?.({ message: '🎯 Analyzing your request...' });

      // Step 1: Orchestrator - Plan the task using generateObject
      const plan = await this.planTask(userMessage, context);

      onProgress?.({
        message: `📋 Plan: ${plan.description}`,
        totalSteps: plan.estimatedSteps
      });

      // Step 2: Worker - Execute the plan using generateText with tools
      const result = await this.executeWorkerTask(plan, userMessage, context, (update) => {
        stepsUsed = update.step || stepsUsed;
        if (update.toolsUsed) {
          toolsUsed.push(...update.toolsUsed);
        }
        onProgress?.(update);
      });

      onProgress?.({ message: '✅ Task completed successfully!' });

      return {
        success: true,
        response: result,
        executionTime: Date.now() - startTime,
        stepsUsed,
        toolsUsed: [...new Set(toolsUsed)]
      };

    } catch (error) {
      console.error('Orchestrator error:', error);

      return {
        success: false,
        response: `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executionTime: Date.now() - startTime,
        stepsUsed,
        toolsUsed: [...new Set(toolsUsed)],
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Orchestrator: Plan the task execution using generateObject (AI SDK v5 pattern)
   * NOTE: We do NOT pre-select tools here - that's the worker's job
   */
  private async planTask(userMessage: string, context: UserContext): Promise<TaskPlan> {
    const { object: plan } = await generateObject({
      model: this.model,
      schema: z.object({
        taskType: z.enum(['research', 'spreadsheet', 'email', 'greeting', 'document_query', 'professor_search']),
        description: z.string(),
        estimatedSteps: z.number().min(1).max(15),
        priority: z.enum(['low', 'medium', 'high'])
      }),
      system: `You are a high-level task planner for a graduate application assistant.

Your job is to analyze the user request and provide:
1. Task type classification
2. Brief description of what needs to be done
3. Realistic step estimate (1-15)
4. Priority level

Task types:
- greeting: Simple greetings and introductions
- research: Finding professors, programs, academic information  
- spreadsheet: Creating, reading, updating Google Sheets
- email: Composing, sending, managing emails
- document_query: Searching uploaded documents
- professor_search: Specific professor contact research

Do NOT choose specific tools - the worker will select appropriate tools based on the task type.`,
      prompt: `Analyze this request: "${userMessage}"

Context: User has ${context.conversationHistory?.length || 0} previous messages`
    });

    // Create enhanced plan with system prompt
    const enhancedPlan: TaskPlan = {
      ...plan,
      requiredTools: [], // Remove tool pre-selection - worker gets ALL tools
      systemPrompt: getSystemPrompt(plan.taskType)
    };

    return enhancedPlan;
  }

  /**
   * Worker: Execute the planned task using generateText with ALL tools (AI SDK v5 pattern)
   */
  private async executeWorkerTask(
    plan: TaskPlan,
    userMessage: string,
    context: UserContext,
    onProgress?: (update: ProgressUpdate) => void
  ): Promise<string> {
    // Give worker access to ALL tools - let AI decide which to use
    console.log(`🔧 Worker has access to all ${Object.keys(this.allTools).length} tools`);

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

    const result = await generateText({
      model: this.model,
      system: plan.systemPrompt,
      messages,
      tools: this.allTools, // Give ALL tools to the worker
      stopWhen: stepCountIs(plan.estimatedSteps),
      onStepFinish: ({ toolCalls }) => {
        currentStep++;

        if (toolCalls && toolCalls.length > 0) {
          const newTools = toolCalls.map(tc => tc.toolName);
          onProgress?.({
            message: `🔧 Step ${currentStep}: Using ${newTools.join(', ')}`,
            step: currentStep,
            totalSteps: plan.estimatedSteps,
            toolsUsed: newTools
          });
        } else {
          onProgress?.({
            message: `⚡ Step ${currentStep}: Processing...`,
            step: currentStep,
            totalSteps: plan.estimatedSteps
          });
        }
      }
    });

    return result.text;
  }

  /**
   * Get all available tools (worker gets full access)
   */
  getAllTools(): Record<string, any> {
    return this.allTools;
  }

  /**
   * Simple routing for basic cases (greetings, simple questions)
   */
  async handleSimpleTask(userMessage: string, context: UserContext): Promise<ExecutionResult> {
    const message = userMessage.toLowerCase().trim();

    // Handle greetings directly without tools
    const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon'];
    if (greetings.some(greeting => message === greeting || message.startsWith(greeting + ' '))) {
      return {
        success: true,
        response: "Hi! I'm your graduate application assistant. I can help you research programs and professors, organize your applications in spreadsheets, draft emails, and much more. What would you like to work on today?",
        executionTime: 50,
        stepsUsed: 0,
        toolsUsed: []
      };
    }

    // For complex tasks, use full orchestration
    return this.executeTask(userMessage, context);
  }

  /**
   * Test individual tools
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
   * Get list of available tools
   */
  getAvailableTools(): string[] {
    return Object.keys(this.allTools);
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(): Record<string, string[]> {
    const tools = Object.keys(this.allTools);

    return {
      sheets: tools.filter(t => t.includes('Spreadsheet') || t.includes('Sheet') || t.includes('Cells')),
      gmail: tools.filter(t => t.includes('Email') || t.includes('Draft') || t.includes('Label')),
      research: tools.filter(t => t.includes('search') || t.includes('Search') || t.includes('extract')),
      documents: tools.filter(t => t.includes('Document') || t.includes('query')),
      other: tools.filter(t =>
        !t.includes('Spreadsheet') && !t.includes('Sheet') && !t.includes('Cells') &&
        !t.includes('Email') && !t.includes('Draft') && !t.includes('Label') &&
        !t.includes('search') && !t.includes('Search') && !t.includes('extract') &&
        !t.includes('Document') && !t.includes('query')
      )
    };
  }
}