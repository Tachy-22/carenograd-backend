import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import {
  ComplexTask,
  RoutingPlan,
  UserContext,
  SpecializedTask,
  TaskType,
  TaskIntent
} from './types';

export class TaskRouter {
  private model = google('gemini-2.0-flash');

  // Allow orchestrator to update the model
  setModel(modelName: string): void {
    this.model = google(modelName);
  }

  async routeTask(userMessage: string, context: UserContext): Promise<RoutingPlan> {
    // Step 1: Analyze user intent and classify task
    const analysis = await this.analyzeUserIntent(userMessage, context);

    // Step 2: Create routing plan based on analysis
    return this.createRoutingPlan(analysis, userMessage, context);
  }

  private async analyzeUserIntent(userMessage: string, context: UserContext) {
    const { object: analysis } = await generateObject({
      model: this.model,
      schema: z.object({
        intent: z.enum([
          'greeting',
          'analyze_profile',
          'find_programs',
          'research_professors',
          'organize_data',
          'compose_email',
          'track_applications',
          'gather_information',
          'update_records',
          'create_documents'
        ]),
        taskTypes: z.array(z.enum([
          'greeting',
          'cv_analysis',
          'program_search',
          'professor_research',
          'spreadsheet_management',
          'email_composition',
          'document_query',
          'web_research',
          'academic_search',
          'data_organization',
          'application_tracking',
          'response_formatting'
        ])),
        complexity: z.enum(['simple', 'moderate', 'complex']),
        requiresMultipleAgents: z.boolean(),
        keyEntities: z.array(z.string()),
        coordinationStrategy: z.enum(['sequential', 'parallel', 'mixed']),
        reasoning: z.string()
      }),
      system: `You are a task analysis expert for a postgraduate application assistant system.
      
      Analyze user requests and classify them for intelligent routing to specialist agents.
      
      Available Specialists:
      - PostgradApplicationAgent: CV analysis, profile matching, application strategy
      - AcademicResearchAgent: Academic research, professor discovery, literature review
      - CommunicationAgent: Email drafting, professional communication, progress documentation
      - DataOrganizerAgent: Spreadsheet management, data organization, tracking
      
      SPECIAL ROUTING RULES:
      1. Simple greetings ("hi", "hello", "hey") should route to PostgradApplicationAgent with intent="greeting"
      2. Simple factual questions ("where is X?", "what is Y?") should route to AcademicResearchAgent
      3. Research queries about professors/papers should go to AcademicResearchAgent
      4. Complex technical requests should use multiple specialists
      
      Consider:
      1. What is the user trying to accomplish?
      2. Which specialists would be most effective?
      3. Can tasks run in parallel or must they be sequential?
      4. What entities (universities, programs, professors) are mentioned?`,
      prompt: `Analyze this user request: "${userMessage}"
      
      Context: User has ${context.conversationHistory?.length || 0} previous messages.
      ${context.conversationHistory ? 'Recent context: ' + context.conversationHistory.slice(-2).map(m => m.content).join(' ') : ''}
      
      Provide detailed analysis for routing to appropriate specialist agents.`
    });

    return analysis;
  }

  private createRoutingPlan(
    analysis: any,
    userMessage: string,
    context: UserContext
  ): RoutingPlan {
    const agentMapping = {
      'greeting': 'PostgradApplicationAgent',
      'cv_analysis': 'PostgradApplicationAgent',
      'program_search': 'PostgradApplicationAgent',
      'professor_research': 'AcademicResearchAgent',
      'spreadsheet_management': 'DataOrganizerAgent',
      'email_composition': 'CommunicationAgent',
      'document_query': 'PostgradApplicationAgent',
      'web_research': 'AcademicResearchAgent',
      'academic_search': 'AcademicResearchAgent',
      'data_organization': 'DataOrganizerAgent',
      'application_tracking': 'DataOrganizerAgent',
      'create_documents': 'CommunicationAgent'
    };

    const primaryTaskType = analysis.taskTypes[0] as TaskType;
    const primaryAgent = agentMapping[primaryTaskType];

    const supportingAgents = analysis.taskTypes.slice(1)
      .map((taskType: TaskType) => agentMapping[taskType])
      .filter((agent: string) => agent !== primaryAgent && agent) as string[];

    // Create specialized tasks
    const expectedSteps: SpecializedTask[] = analysis.taskTypes.map((taskType: TaskType, index: number) => ({
      id: `task_${Date.now()}_${index}`,
      type: taskType,
      description: `${taskType} for: ${userMessage}`,
      input: {
        userMessage,
        entities: analysis.keyEntities,
        context
      },
      priority: index === 0 ? 'high' : 'medium',
      dependencies: index === 0 ? [] : [`task_${Date.now()}_${index - 1}`],
      estimatedComplexity: analysis.complexity
    }));

    return {
      primaryAgent,
      supportingAgents: [...new Set(supportingAgents)] as string[], // Remove duplicates
      coordinationStrategy: analysis.coordinationStrategy,
      expectedSteps,
      estimatedComplexity: analysis.complexity
    };
  }

  async createEmergencyPlan(userMessage: string, context: UserContext): Promise<RoutingPlan> {
    // Fallback routing when main analysis fails
    const message = userMessage.toLowerCase().trim();

    // Check for greetings first
    const greetings = ['hi', 'hello', 'hey', 'hiya', 'good morning', 'good afternoon'];
    if (greetings.some(greeting => message === greeting || message.startsWith(greeting + ' '))) {
      return {
        primaryAgent: 'PostgradApplicationAgent',
        supportingAgents: [],
        coordinationStrategy: 'sequential',
        estimatedComplexity: 'simple',
        expectedSteps: [{
          id: `greeting_${Date.now()}`,
          type: 'greeting',
          description: `Handle greeting: ${userMessage}`,
          input: { userMessage, context },
          priority: 'medium',
          dependencies: [],
          estimatedComplexity: 'simple'
        }]
      };
    }

    // Check for simple factual questions
    const factualQuestions = ['where is', 'what is', 'when is', 'how is', 'who is'];
    if (factualQuestions.some(q => message.startsWith(q))) {
      return {
        primaryAgent: 'AcademicResearchAgent',
        supportingAgents: [],
        coordinationStrategy: 'sequential',
        estimatedComplexity: 'simple',
        expectedSteps: [{
          id: `factual_${Date.now()}`,
          type: 'web_research',
          description: `Answer factual question: ${userMessage}`,
          input: { userMessage, context },
          priority: 'medium',
          dependencies: [],
          estimatedComplexity: 'simple'
        }]
      };
    }

    const containsKeywords = {
      cv: message.includes('cv') || message.includes('resume'),
      email: message.includes('email') || message.includes('draft'),
      spreadsheet: message.includes('spreadsheet') || message.includes('sheet'),
      research: message.includes('research') || message.includes('find'),
      program: message.includes('program') || message.includes('university')
    };

    let primaryAgent = 'PostgradApplicationAgent'; // Default
    let taskType: TaskType = 'document_query';

    if (containsKeywords.email) {
      primaryAgent = 'CommunicationAgent';
      taskType = 'email_composition';
    } else if (containsKeywords.spreadsheet) {
      primaryAgent = 'DataOrganizerAgent';
      taskType = 'spreadsheet_management';
    } else if (containsKeywords.research) {
      primaryAgent = 'AcademicResearchAgent';
      taskType = 'web_research';
    } else if (containsKeywords.program) {
      taskType = 'program_search';
    } else if (containsKeywords.cv) {
      taskType = 'cv_analysis';
    }

    return {
      primaryAgent,
      supportingAgents: [],
      coordinationStrategy: 'sequential',
      estimatedComplexity: 'moderate',
      expectedSteps: [{
        id: `emergency_${Date.now()}`,
        type: taskType,
        description: `Emergency routing: ${userMessage}`,
        input: { userMessage, context },
        priority: 'medium',
        dependencies: [],
        estimatedComplexity: 'moderate'
      }]
    };
  }
}