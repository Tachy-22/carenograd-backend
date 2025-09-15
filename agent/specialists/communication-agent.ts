import { BaseSpecialistAgent } from '../orchestrator/base-specialist-agent';
import { TaskType, AgentCapability } from '../orchestrator/types';
import { 
  gmailTools,
  googleDocsTools,
  ragTools
} from '../../tools';

export class CommunicationAgent extends BaseSpecialistAgent {
  readonly agentName = 'CommunicationAgent';
  readonly specialization = 'Professional Communication & Email Management';
  
  readonly capabilities: AgentCapability[] = [
    {
      name: 'Professional Email Composition',
      description: 'Draft personalized academic and professional emails',
      tools: ['createDraft', 'sendEmail', 'replyToEmail'],
      taskTypes: ['email_composition'],
      complexity: 'complex'
    },
    {
      name: 'Academic Document Creation',
      description: 'Create and format academic documents, letters, and proposals',
      tools: ['createDocument', 'insertText', 'formatText'],
      taskTypes: ['create_documents'],
      complexity: 'moderate'
    },
    {
      name: 'Progress Tracking Documentation',
      description: 'Create comprehensive progress tracking documents for application journey',
      tools: ['createDocument', 'insertText', 'formatText', 'insertTable'],
      taskTypes: ['create_documents', 'application_tracking'],
      complexity: 'moderate'
    },
    {
      name: 'Communication Strategy & Follow-up',
      description: 'Manage email campaigns and follow-up sequences',
      tools: ['listEmails', 'createLabel', 'updateDraft'],
      taskTypes: ['email_composition'],
      complexity: 'complex'
    }
  ];

  readonly supportedTaskTypes: TaskType[] = [
    'email_composition',
    'create_documents',
    'application_tracking'
  ];

  protected setupTools(): void {
    // Add Gmail tools for email management
    Object.entries(gmailTools).forEach(([name, tool]) => {
      this.addTool(name, tool);
    });

    // Add Google Docs for document creation
    Object.entries(googleDocsTools).forEach(([name, tool]) => {
      this.addTool(name, tool);
    });

    // Add RAG tools to query user profile for personalization
    Object.entries(ragTools).forEach(([name, tool]) => {
      this.addTool(name, tool);
    });
  }

  protected getSystemPrompt(): string {
    return `
You are an EMAIL WRITING ASSISTANT helping with graduate school outreach and applications.

Your specialty is crafting personalized, professional emails to professors and creating academic documents that help students make great first impressions.

CONVERSATIONAL STYLE:
- Be supportive and encouraging about their outreach efforts
- Explain your email strategy ("I'm personalizing this based on your research background...")
- Show enthusiasm for their academic interests
- Make them feel confident about reaching out

EMAIL WRITING PROCESS:
1. First, learn about their background from their uploaded documents
2. Understand the specific professor and research they want to contact
3. Craft a personalized email that highlights relevant connections
4. Always create drafts for review before any sending

RESPONSE FORMAT:
Be encouraging and explanatory:

"Perfect! I've crafted a personalized email to Dr. Sarah Chen at MIT. I looked at your background in biomedical engineering and connected it to her current research on neural networks for medical diagnosis. Here's what I've prepared:

📧 **Email Draft Created:**
- Subject: 'Prospective PhD Student - Machine Learning for Medical Applications'
- Personalized opening referencing her recent Nature paper
- Highlighted your thesis work on signal processing
- Professional but engaging tone throughout

The draft is now in your Gmail ready for review. I'd suggest sending it on a Tuesday or Wednesday morning for the best response rate. Would you like me to create follow-up email templates too?"

ALWAYS:
- Pull real details from their uploaded CV/documents  
- Reference specific professor research when possible
- Create drafts first, never send without permission
- Explain your personalization strategy
- Give timing and follow-up advice

NEVER:
- Use placeholder text like [Your Name]
- Send emails without creating drafts first
- Give generic, template-like responses
- Sound overly formal or robotic

Remember: You're helping them take a brave step in reaching out to potential mentors. Make the process feel personal and achievable!
`;
  }

  // Specialized methods for communication tasks
  async draftProfessorEmail(professorInfo: any, userProfile: any, purpose: string): Promise<any> {
    // Implementation handled through executeTask
    return null;
  }

  async createCoverLetter(program: any, userProfile: any): Promise<any> {
    // Implementation handled through executeTask
    return null;
  }

  async manageFollowUpSequence(originalEmail: any, followUpSchedule: any): Promise<any> {
    // Implementation handled through executeTask
    return null;
  }
}