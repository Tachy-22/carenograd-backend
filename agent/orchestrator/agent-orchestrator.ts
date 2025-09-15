import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { TaskRouter } from './task-router';
import { BaseSpecialistAgent } from './base-specialist-agent';
import { PostgradApplicationAgent } from '../specialists/postgrad-application-agent';
import { AcademicResearchAgent } from '../specialists/academic-research-agent';
import { CommunicationAgent } from '../specialists/communication-agent';
import { DataOrganizerAgent } from '../specialists/data-organizer-agent';
import {
  UserContext,
  AgentContext,
  SpecializedTask,
  SpecialistResult,
  OrchestrationResult,
  CoordinationStep,
  RoutingPlan
} from './types';

export class AgentOrchestrator {
  private specialists: Map<string, BaseSpecialistAgent> = new Map();
  private taskRouter: TaskRouter = new TaskRouter();
  private coordinationHistory: CoordinationStep[] = [];
  private model = google('gemini-2.0-flash');

  // Helper method to transform progress messages - keep simple for real-time streaming
  private transformProgressMessage(message: string): string {
    // Transform to truly user-friendly messages
    const quickTransforms: { [key: string]: string } = {
      'Delegating data_organization to DataOrganizerAgent...': '📊 Setting up your application tracker...',
      'Delegating spreadsheet_management to DataOrganizerAgent...': '📊 Creating your tracking spreadsheet...',
      'Delegating professor_research to ResearchAgent...': '🔍 Finding professors for you...',
      'Delegating professor_research to ProfessorResearchAgent...': '🔍 Searching for professor contacts...',
      'Delegating email_composition to CommunicationAgent...': '✉️ Writing your outreach emails...',
      '✨ DataOrganizerAgent completed data_organization': '✅ Your tracker is ready!',
      '✨ DataOrganizerAgent completed spreadsheet_management': '✅ Spreadsheet created!',
      '✨ ResearchAgent completed professor_research': '✅ Found professors!',
      '✨ ProfessorResearchAgent completed professor_research': '✅ Got professor contacts!',
      '✨ CommunicationAgent completed email_composition': '✅ Emails ready!',
      'Synthesizing results from all specialists...': '✨ Almost done...',
      '🎯 Analyzing request and creating execution plan...': '🎯 Getting started...',
      '🔄 Executing tasks sequentially...': '🔄 Working on it...',
      '✨ Formatting response for user-friendly presentation...': '✅ Finishing up...'
    };

    if (quickTransforms[message]) {
      return quickTransforms[message];
    }

    // Transform remaining messages to be user-friendly
    let transformed = message;

    // Handle plan creation messages
    if (transformed.includes('Plan created:') && transformed.includes('will lead')) {
      return '📋 Got it! Starting work now...';
    }

    // Handle delegation messages not caught above
    // if (transformed.includes('Delegating')) {
    //   if (transformed.includes('spreadsheet')) return '📊 Setting up your spreadsheet...';
    //   if (transformed.includes('professor')) return '🔍 Finding professors...';
    //   if (transformed.includes('email')) return '✉️ Working on emails...';
    //   if (transformed.includes('data')) return '📊 Organizing your data...';
    //   return '⚡ Getting started...';
    // }

    // Remove technical agent names and make friendly
    transformed = transformed
      .replace(/DataOrganizerAgent/g, 'spreadsheet helper')
      .replace(/ResearchAgent/g, 'researcher')  
      .replace(/ProfessorResearchAgent/g, 'professor finder')
      .replace(/CommunicationAgent/g, 'email helper')
      .replace(/PostgradApplicationAgent/g, 'profile helper')
      .replace(/Delegating \w+ to /g, '');

    return transformed;
  }

  constructor() {
    this.initializeSpecialists();
  }

  private initializeSpecialists() {
    // Register all specialist agents
    const postgradAgent = new PostgradApplicationAgent();
    const academicResearchAgent = new AcademicResearchAgent();
    const communicationAgent = new CommunicationAgent();
    const dataOrganizerAgent = new DataOrganizerAgent();

    this.specialists.set('PostgradApplicationAgent', postgradAgent);
    this.specialists.set('AcademicResearchAgent', academicResearchAgent);
    this.specialists.set('CommunicationAgent', communicationAgent);
    this.specialists.set('DataOrganizerAgent', dataOrganizerAgent);
  }

  async executeComplexTask(
    userMessage: string,
    context: UserContext,
    onProgress?: (update: string) => void
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    
    try {
      onProgress?.(this.transformProgressMessage('🎯 Analyzing request and creating execution plan...'));
      
      // Step 1: Route the task to appropriate specialists
      const routingPlan = await this.createRoutingPlan(userMessage, context);
      
      onProgress?.(this.transformProgressMessage(`📋 Plan created: ${routingPlan.primaryAgent} will lead with ${routingPlan.supportingAgents.length} supporting agents`));
      
      // Step 2: Execute the routing plan
      const executionResults = await this.executeRoutingPlan(routingPlan, context, (msg) => {
        if (onProgress) onProgress(this.transformProgressMessage(msg));
      });
      
      onProgress?.(this.transformProgressMessage('🔧 Synthesizing results from all specialists...'));
      
      // Step 3: Combine user-friendly results from specialists
      const finalResponse = await this.synthesizeResults(executionResults, userMessage, context);
      
      const totalExecutionTime = Date.now() - startTime;
      const totalTokensUsed = executionResults.reduce((sum, result) => 
        sum + (result.metadata.tokensUsed || 0), 0);
      
      return {
        success: true,
        finalResponse,
        steps: this.coordinationHistory,
        totalExecutionTime,
        tokensUsed: totalTokensUsed,
        errors: executionResults.filter(r => !r.success).flatMap(r => r.errors || [])
      };

    } catch (error) {
      onProgress?.(`❌ Orchestration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        success: false,
        finalResponse: `I encountered an error coordinating the specialist agents: ${error instanceof Error ? error.message : 'Unknown error'}`,
        steps: this.coordinationHistory,
        totalExecutionTime: Date.now() - startTime,
        tokensUsed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown orchestration error']
      };
    }
  }

  private async createRoutingPlan(userMessage: string, context: UserContext): Promise<RoutingPlan> {
    try {
      return await this.taskRouter.routeTask(userMessage, context);
    } catch (error) {
      // For errors, fallback to emergency routing
      console.warn('Main routing failed, using emergency plan:', error);
      return await this.taskRouter.createEmergencyPlan(userMessage, context);
    }
  }


  private async executeTasksInParallel(
    tasks: SpecializedTask[],
    context: UserContext,
    onProgress?: (update: string) => void
  ): Promise<SpecialistResult[]> {
    const taskPromises = tasks.map(task => this.executeSpecializedTask(task, context, onProgress));
    return await Promise.all(taskPromises);
  }

  private async executeTasksSequentially(
    tasks: SpecializedTask[],
    context: UserContext,
    onProgress?: (update: string) => void
  ): Promise<SpecialistResult[]> {
    const results: SpecialistResult[] = [];
    
    for (const task of tasks) {
      const result = await this.executeSpecializedTask(task, context, onProgress);
      results.push(result);
      
      // If a critical task fails, consider stopping the sequence
      if (!result.success && task.priority === 'critical') {
        onProgress?.(`⚠️ Critical task failed, continuing with remaining tasks...`);
      }
    }
    
    return results;
  }

  private async executeTasksMixed(
    tasks: SpecializedTask[],
    context: UserContext,
    onProgress?: (update: string) => void
  ): Promise<SpecialistResult[]> {
    // Group tasks by dependencies
    const independentTasks = tasks.filter(task => task.dependencies.length === 0);
    const dependentTasks = tasks.filter(task => task.dependencies.length > 0);
    
    // Execute independent tasks in parallel first
    const results: SpecialistResult[] = [];
    if (independentTasks.length > 0) {
      onProgress?.(this.transformProgressMessage(`🔄 Executing ${independentTasks.length} independent tasks in parallel...`));
      results.push(...await this.executeTasksInParallel(independentTasks, context, (msg) => {
        if (onProgress) onProgress(this.transformProgressMessage(msg));
      }));
    }
    
    // Then execute dependent tasks sequentially
    if (dependentTasks.length > 0) {
      onProgress?.(this.transformProgressMessage(`🔄 Executing ${dependentTasks.length} dependent tasks sequentially...`));
      results.push(...await this.executeTasksSequentially(dependentTasks, context, (msg) => {
        if (onProgress) onProgress(this.transformProgressMessage(msg));
      }));
    }
    
    return results;
  }

  private async executeSpecializedTask(
    task: SpecializedTask,
    context: UserContext,
    onProgress?: (update: string) => void
  ): Promise<SpecialistResult> {
    // Find the best specialist for this task
    const specialist = this.selectSpecialistForTask(task);
    
    if (!specialist) {
      return {
        taskId: task.id,
        success: false,
        data: null,
        metadata: { executionTime: 0, toolsUsed: [], tokensUsed: 0 },
        errors: [`No specialist available for task type: ${task.type}`]
      };
    }

    onProgress?.(this.transformProgressMessage(`🔧 Delegating ${task.type} to ${specialist.agentName}...`));

    // Create agent context with userId injection
    const agentContext: AgentContext = {
      ...context,
      taskId: task.id,
      dependencies: task.dependencies
    };

    try {
      // Execute the task with the selected specialist
      const result = await specialist.executeTask(task, agentContext, onProgress);
      
      // Record coordination step
      this.coordinationHistory.push({
        id: `step_${Date.now()}_${task.id}`,
        agentName: specialist.agentName,
        task,
        result,
        timestamp: new Date(),
        dependencies: task.dependencies
      });

      return result;

    } catch (error) {
      // For errors, return a failed result
      const failedResult: SpecialistResult = {
        taskId: task.id,
        success: false,
        data: null,
        metadata: { executionTime: 0, toolsUsed: [], tokensUsed: 0 },
        errors: [error instanceof Error ? error.message : 'Unknown specialist error']
      };

      // Still record the coordination step for failed tasks
      this.coordinationHistory.push({
        id: `step_${Date.now()}_${task.id}`,
        agentName: specialist.agentName,
        task,
        result: failedResult,
        timestamp: new Date(),
        dependencies: task.dependencies
      });

      return failedResult;
    }
  }

  private selectSpecialistForTask(task: SpecializedTask): BaseSpecialistAgent | null {
    let bestSpecialist: BaseSpecialistAgent | null = null;
    let bestScore = 0;

    for (const [name, specialist] of this.specialists) {
      if (specialist.canHandleTask(task.type)) {
        const score = specialist.getCapabilityScore(task.type);
        if (score > bestScore) {
          bestScore = score;
          bestSpecialist = specialist;
        }
      }
    }

    return bestSpecialist;
  }

  private async synthesizeResults(
    results: SpecialistResult[],
    userMessage: string,
    context: UserContext
  ): Promise<string> {
    // If only one result, return it directly
    if (results.length === 1) {
      const result = results[0];
      return result.success ? result.data : `I encountered an issue: ${result.errors?.join(', ') || 'Unknown error'}`;
    }

    // For multiple results, do simple concatenation
    // Each specialist should already return user-friendly responses
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    if (successfulResults.length === 0) {
      return `I wasn't able to complete your request. ${failedResults.map(r => r.errors?.join(', ')).join('. ')}`;
    }

    // Simple combination - specialists already return user-friendly responses
    let response = '';
    
    if (successfulResults.length === 1) {
      response = successfulResults[0].data;
    } else {
      // Multiple specialists completed tasks - combine their user-friendly responses
      response = successfulResults.map(r => r.data).join('\n\n');
    }

    // Add any error context if some agents failed
    if (failedResults.length > 0) {
      response += `\n\nNote: I had some difficulties with part of your request (${failedResults.length} tasks encountered issues), but I was able to complete the main parts above.`;
    }

    return response;
  }

  private getAgentNameFromResult(result: SpecialistResult): string {
    const step = this.coordinationHistory.find(s => s.result.taskId === result.taskId);
    return step?.agentName || 'Specialist';
  }


  private createFallbackSynthesis(results: SpecialistResult[], userMessage: string): string {
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    let synthesis = `## Response to: "${userMessage}"\n\n`;
    
    if (successfulResults.length > 0) {
      synthesis += `## Results:\n\n`;
      successfulResults.forEach((result, index) => {
        synthesis += `**Specialist ${index + 1} Results:**\n${result.data}\n\n`;
      });
    }

    if (failedResults.length > 0) {
      synthesis += `## Issues Encountered:\n`;
      failedResults.forEach(result => {
        synthesis += `• ${result.errors?.join(', ') || 'Unknown error'}\n`;
      });
    }

    synthesis += `\n*Coordinated by ${results.length} specialist agents*`;
    
    return synthesis;
  }


  // Utility methods for external access
  getAvailableSpecialists(): string[] {
    return Array.from(this.specialists.keys());
  }

  getCoordinationHistory(): CoordinationStep[] {
    return [...this.coordinationHistory];
  }

  clearCoordinationHistory(): void {
    this.coordinationHistory = [];
  }


  private async executeRoutingPlan(
    plan: RoutingPlan,
    context: UserContext,
    onProgress?: (update: string) => void
  ): Promise<SpecialistResult[]> {
    try {
      const results: SpecialistResult[] = [];
      
      if (plan.coordinationStrategy === 'parallel') {
        // Execute tasks in parallel
        onProgress?.(this.transformProgressMessage('🔄 Executing tasks in parallel across multiple specialists...'));
        results.push(...await this.executeTasksInParallel(plan.expectedSteps, context, (msg) => {
          if (onProgress) onProgress(this.transformProgressMessage(msg));
        }));
        
      } else if (plan.coordinationStrategy === 'sequential') {
        // Execute tasks sequentially  
        onProgress?.(this.transformProgressMessage('🔄 Executing tasks sequentially...'));
        results.push(...await this.executeTasksSequentially(plan.expectedSteps, context, (msg) => {
          if (onProgress) onProgress(this.transformProgressMessage(msg));
        }));
        
      } else {
        // Mixed strategy - execute based on dependencies
        onProgress?.(this.transformProgressMessage('🔄 Executing mixed coordination strategy...'));
        results.push(...await this.executeTasksMixed(plan.expectedSteps, context, (msg) => {
          if (onProgress) onProgress(this.transformProgressMessage(msg));
        }));
      }

      return results;

    } catch (error) {
      // For errors, return failed results
      return [{
        taskId: 'orchestrator_error',
        success: false,
        data: null,
        metadata: { executionTime: 0, toolsUsed: [], tokensUsed: 0 },
        errors: [error instanceof Error ? error.message : 'Unknown routing error']
      }];
    }
  }




}