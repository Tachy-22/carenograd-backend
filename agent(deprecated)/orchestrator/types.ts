import { Tool } from 'ai';

export interface UserContext {
  userId: string;
  accessToken?: string;
  tokenExpiresAt?: Date;
  conversationHistory?: Array<{ role: 'user' | 'assistant', content: string, timestamp: Date }>;
}

export interface AgentContext extends UserContext {
  taskId: string;
  parentTask?: string;
  dependencies: string[];
}

export interface SpecializedTask {
  id: string;
  type: TaskType;
  description: string;
  input: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[];
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
}

export interface SpecialistResult {
  taskId: string;
  success: boolean;
  data: any;
  metadata: {
    executionTime: number;
    toolsUsed: string[];
    tokensUsed?: number;
  };
  errors?: string[];
  nextActions?: SpecializedTask[];
}

export interface OrchestrationResult {
  success: boolean;
  finalResponse: string;
  steps: CoordinationStep[];
  totalExecutionTime: number;
  tokensUsed: number;
  errors: string[];
}

export interface CoordinationStep {
  id: string;
  agentName: string;
  task: SpecializedTask;
  result: SpecialistResult;
  timestamp: Date;
  dependencies: string[];
}

export interface RoutingPlan {
  primaryAgent: string;
  supportingAgents: string[];
  coordinationStrategy: 'sequential' | 'parallel' | 'mixed';
  expectedSteps: SpecializedTask[];
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
}

export interface ComplexTask {
  userMessage: string;
  intent: TaskIntent;
  entities: string[];
  context: UserContext;
}

export type TaskType =
  | 'greeting'
  | 'cv_analysis'
  | 'program_search'
  | 'professor_research'
  | 'spreadsheet_management'
  | 'email_composition'
  | 'document_query'
  | 'web_research'
  | 'academic_search'
  | 'data_organization'
  | 'create_documents'
  | 'application_tracking'
  | 'response_formatting'
  | 'progress_streaming';

export type TaskIntent =
  | 'greeting'
  | 'analyze_profile'
  | 'find_programs'
  | 'research_professors'
  | 'organize_data'
  | 'compose_email'
  | 'track_applications'
  | 'gather_information'
  | 'update_records'
  | 'create_documents';

export interface AgentCapability {
  name: string;
  description: string;
  tools: string[];
  taskTypes: TaskType[];
  complexity: 'simple' | 'moderate' | 'complex';
}