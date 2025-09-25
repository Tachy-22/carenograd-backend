// Simplified types for AI SDK v5 orchestrator-worker pattern

export interface UserContext {
  accessToken?: string;
  tokenExpiresAt?: Date;
  userId: string;
  conversationHistory?: Array<{ 
    role: 'user' | 'assistant' | 'system'; 
    content: string; 
  }>;
}

export interface TaskPlan {
  taskType: 'research' | 'spreadsheet' | 'email' | 'greeting' | 'document_query' | 'professor_search';
  description: string;
  requiredTools: string[];
  estimatedSteps: number;
  systemPrompt: string;
  priority: 'low' | 'medium' | 'high';
}

export interface ExecutionResult {
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