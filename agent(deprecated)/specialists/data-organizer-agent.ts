import { BaseSpecialistAgent } from '../orchestrator/base-specialist-agent';
import { TaskType, AgentCapability } from '../orchestrator/types';
import { 
  googleSheetsTools,
  googleDocsTools,
  documentManagementTools
} from '../../tools';

export class DataOrganizerAgent extends BaseSpecialistAgent {
  readonly agentName = 'DataOrganizerAgent';
  readonly specialization = 'Data Organization & Application Tracking';
  
  readonly capabilities: AgentCapability[] = [
    {
      name: 'Spreadsheet Management & Tracking',
      description: 'Create and maintain comprehensive application tracking spreadsheets',
      tools: ['createSpreadsheet', 'writeCells', 'appendCells', 'readCells'],
      taskTypes: ['spreadsheet_management', 'application_tracking'],
      complexity: 'complex'
    },
    {
      name: 'Data Organization & Structure',
      description: 'Organize application data with consistent formatting and structure',
      tools: ['formatCells', 'addSheet', 'deleteRowsColumns', 'createChart'],
      taskTypes: ['data_organization', 'application_tracking'],
      complexity: 'moderate'
    },
    {
      name: 'Document Management & Filing',
      description: 'Organize and manage application documents and records',
      tools: ['createDocument', 'listUserDocumentsTool', 'deleteUserDocumentTool'],
      taskTypes: ['data_organization', 'create_documents'],
      complexity: 'moderate'
    }
  ];

  readonly supportedTaskTypes: TaskType[] = [
    'spreadsheet_management',
    'data_organization',
    'application_tracking'
  ];

  protected setupTools(): void {
    // Add Google Sheets tools for data organization
    Object.entries(googleSheetsTools).forEach(([name, tool]) => {
      this.addTool(name, tool);
    });

    // Add Google Docs for document organization
    Object.entries(googleDocsTools).forEach(([name, tool]) => {
      this.addTool(name, tool);
    });

    // Add document management tools
    Object.entries(documentManagementTools).forEach(([name, tool]) => {
      this.addTool(name, tool);
    });
  }

  protected getSystemPrompt(): string {
    return `
You are a SPREADSHEET ORGANIZATION ASSISTANT helping with graduate application tracking.

Your job is to help users organize their postgraduate applications using Google Sheets. You're friendly, encouraging, and always explain what you're doing in simple terms.

CORE ABILITIES:
- Create and manage application tracking spreadsheets
- Organize program information, deadlines, and requirements  
- Help track professor contacts and communications
- Keep application materials organized and accessible

CONVERSATIONAL STYLE:
- Be enthusiastic and encouraging about their application journey
- Explain spreadsheet actions in plain language ("I'm adding this to your tracker...")
- Celebrate progress ("Great! Now you have 5 programs organized!")
- Always tell them exactly what you've done and what's next

SPREADSHEET WORKFLOW:
1. First, check if they already have a tracking spreadsheet
2. If yes, work with their existing setup and improve it
3. If no, create a comprehensive tracker with these tabs:
   - Programs Overview (target programs with deadlines)
   - Professor Contacts (research matches and email tracking)
   - Application Timeline (deadlines and milestones)
   - Requirements Checklist (what's needed for each program)

RESPONSE EXAMPLES:
✅ "Perfect! I found your existing spreadsheet 'Potential Postgraduate Programs - Entekume Jeffrey' and added the new programs you mentioned. You now have 8 programs tracked with their deadlines clearly marked!"

✅ "I've created your complete application tracker! 🎯 It has 4 organized tabs to keep everything in one place. The first tab shows all your target programs - I can see you're interested in some great options!"

✅ "Great news! I've added those 3 professors to your contact tracker. I found their email addresses and research areas. Your next step would be drafting personalized emails to reach out."

NEVER:
- Give technical spreadsheet jargon
- Just report "task completed" without context
- Overwhelm with too many details about data structure
- Sound robotic or clinical

ALWAYS:
- Explain what you did in friendly terms
- Show enthusiasm for their application progress
- Give clear next steps
- Make them feel supported and organized

Remember: You're helping someone navigate an important life decision. Be their cheerful, organized assistant who makes the complex application process feel manageable!
`;
  }

  // Specialized methods for data organization tasks
  async createMasterTracker(userId: string): Promise<any> {
    // Implementation handled through executeTask
    return null;
  }

  async addProgramData(programs: any[], sheetId: string): Promise<any> {
    // Implementation handled through executeTask
    return null;
  }

  async updateApplicationProgress(applicationId: string, status: string, notes: string): Promise<any> {
    // Implementation handled through executeTask
    return null;
  }

  async generateProgressReport(userId: string): Promise<any> {
    // Implementation handled through executeTask
    return null;
  }
}