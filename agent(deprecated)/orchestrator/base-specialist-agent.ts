import { generateText, streamText, stepCountIs, ToolSet, LanguageModel, ModelMessage } from 'ai';
import { google } from '@ai-sdk/google';
import { authContext } from '../../utils/auth-context';
import {
  SpecializedTask,
  SpecialistResult,
  AgentContext,
  TaskType,
  AgentCapability
} from './types';

export abstract class BaseSpecialistAgent {
  protected model: LanguageModel;
  protected tools: ToolSet;

  abstract readonly agentName: string;
  abstract readonly specialization: string;
  abstract readonly capabilities: AgentCapability[];
  abstract readonly supportedTaskTypes: TaskType[];

  constructor() {
    this.model = google('gemini-2.0-flash');
    this.tools = {} as ToolSet;
    this.setupTools();
  }

  protected abstract setupTools(): void;
  protected abstract getSystemPrompt(): string;

  setModelName(modelName: string): void {
    this.model = google(modelName);
    console.log(`🔄 ${this.agentName} switched to ${modelName}`);
  }


  canHandleTask(taskType: TaskType): boolean {
    return this.supportedTaskTypes.includes(taskType);
  }

  getCapabilityScore(taskType: TaskType): number {
    const capability = this.capabilities.find(cap => cap.taskTypes.includes(taskType));
    if (!capability) return 0;

    // Score based on complexity handling and specialization
    const complexityScore = capability.complexity === 'complex' ? 1.0 :
      capability.complexity === 'moderate' ? 0.8 : 0.6;
    const specializationScore = capability.taskTypes.length <= 3 ? 1.0 : 0.7; // More specialized = higher score

    return complexityScore * specializationScore;
  }

  async executeTask(
    task: SpecializedTask,
    context: AgentContext,
    onProgress?: (update: string) => void
  ): Promise<SpecialistResult> {
    const startTime = Date.now();

    try {
      // Set access token if available
      if (context.accessToken) {
        console.log(`🔑 Setting access token for ${this.agentName}:`, context.accessToken.substring(0, 20) + '...');
        console.log(`🕒 Token expires at:`, context.tokenExpiresAt);
        authContext.setAccessToken(
          context.accessToken,
          context.tokenExpiresAt
        );
        console.log(`✅ Access token set successfully for ${this.agentName}`);
      } else {
        console.error(`❌ No access token available for ${this.agentName}`);
      }

      // Prepare conversation messages from context
      const messages: ModelMessage[] = context.conversationHistory
        ? context.conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
        : [];

      // Add current task as user message
      messages.push({
        role: 'user',
        content: this.formatTaskAsPrompt(task)
      });

      const result = streamText({
        model: this.model,
        system: this.getSystemPrompt(),
        messages: messages,
        tools: this.tools,
        stopWhen: stepCountIs(50), // Reduced for specialists
      });

      const toolCalls: string[] = [];
      let finalText = '';

      for await (const part of result.fullStream) {
        switch (part.type) {
          case 'tool-call':
            toolCalls.push(part.toolName);
            onProgress?.(`🔧 Using ${part.toolName} for ${task.type}`);
            break;
          case 'tool-result':
            onProgress?.(`✅ Completed ${toolCalls[toolCalls.length - 1]}`);
            break;
          case 'text-delta':
            finalText += part.text;
            break;
          case 'finish':
            onProgress?.(`✨ ${this.agentName} completed ${task.type}`);
            break;
        }
      }

      const finalResult = await result.text;
      const usage = await result.usage;

      return {
        taskId: task.id,
        success: true,
        data: finalResult,
        metadata: {
          executionTime: Date.now() - startTime,
          toolsUsed: [...new Set(toolCalls)],
          tokensUsed: usage?.totalTokens || 0
        }
      };

    } catch (error) {
      return {
        taskId: task.id,
        success: false,
        data: null,
        metadata: {
          executionTime: Date.now() - startTime,
          toolsUsed: [],
          tokensUsed: 0
        },
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  protected formatTaskAsPrompt(task: SpecializedTask): string {
    return `Task Type: ${task.type}
Description: ${task.description}
Priority: ${task.priority}
Complexity: ${task.estimatedComplexity}
Input Data: ${JSON.stringify(task.input, null, 2)}

Execute this task using your specialized capabilities.`;
  }

  protected addTool(name: string, tool: any) {
    // Auto-inject userId for multi-user tools
    if (this.isMultiUserTool(name)) {
      const originalTool = tool;
      this.tools[name] = {
        ...originalTool,
        execute: async (args: any) => {
          // Note: userId will be injected by orchestrator context
          if (originalTool.execute) {
            return await (originalTool.execute as any)(args);
          } else {
            throw new Error(`Tool ${name} does not have an execute function`);
          }
        }
      };
    } else {
      this.tools[name] = tool;
    }
    return this;
  }

  private isMultiUserTool(toolName: string): boolean {
    const multiUserTools = [
      'queryDocumentMultiUserTool',
      'listUserDocumentsTool',
      'getUserDocumentDetailsTool',
      'deleteUserDocumentTool'
    ];
    return multiUserTools.includes(toolName);
  }
}