import { BaseSpecialistAgent } from '../orchestrator/base-specialist-agent';
import { TaskType, AgentCapability } from '../orchestrator/types';
import { 
  ragTools,
  googleSheetsTools,
  webScrapingTools,
  googleSearchTools 
} from '../../tools';

export class PostgradApplicationAgent extends BaseSpecialistAgent {
  readonly agentName = 'PostgradApplicationAgent';
  readonly specialization = 'Postgraduate Application Management & Profile Analysis';
  
  readonly capabilities: AgentCapability[] = [
    {
      name: 'User Interaction & Greetings',
      description: 'Handle greetings and initial user interactions',
      tools: [],
      taskTypes: ['greeting'],
      complexity: 'simple'
    },
    {
      name: 'CV Analysis & Profile Matching',
      description: 'Analyze academic CVs and match with suitable programs',
      tools: ['queryDocumentMultiUserTool', 'listUserDocumentsTool'],
      taskTypes: ['cv_analysis', 'program_search'],
      complexity: 'complex'
    },
    {
      name: 'Application Strategy & Planning',
      description: 'Create comprehensive application strategies and timelines',
      tools: ['webSearch', 'extractText', 'fileSearch'],
      taskTypes: ['application_tracking', 'program_search'],
      complexity: 'complex'
    },
    {
      name: 'Document Analysis & Insights',
      description: 'Extract insights from academic documents and research papers',
      tools: ['queryDocumentMultiUserTool', 'getUserDocumentDetailsTool'],
      taskTypes: ['document_query', 'cv_analysis'],
      complexity: 'moderate'
    }
  ];

  readonly supportedTaskTypes: TaskType[] = [
    'greeting',
    'cv_analysis',
    'program_search', 
    'application_tracking',
    'document_query'
  ];

  protected setupTools(): void {
    // Add RAG tools for document analysis
    Object.entries(ragTools).forEach(([name, tool]) => {
      this.addTool(name, tool);
    });

    // Add Google Sheets for application tracking
    Object.entries(googleSheetsTools).forEach(([name, tool]) => {
      this.addTool(name, tool);
    });

    // Add web scraping for program research
    Object.entries(webScrapingTools).forEach(([name, tool]) => {
      this.addTool(name, tool);
    });

    // Add search tools for program discovery
    Object.entries(googleSearchTools).forEach(([name, tool]) => {
      this.addTool(name, tool);
    });
  }

  protected getSystemPrompt(): string {
    return `
You are a GRADUATE SCHOOL APPLICATION ADVISOR helping students navigate their postgraduate journey.

Your expertise is in analyzing academic backgrounds, finding program matches, and creating application strategies that lead to success.

CONVERSATIONAL STYLE:  
- Be encouraging but realistic about their prospects
- Celebrate their achievements and potential
- Explain your reasoning clearly ("Based on your research experience in...")
- Give actionable next steps they can take immediately

FOR GREETINGS:
When someone says "hi", "hello", etc., respond warmly and offer specific help:
"Hi there! I'm your graduate school application advisor. I can help you analyze your academic background, find matching programs, or create an application strategy. What would you like to work on first?"

APPLICATION ANALYSIS PROCESS:
1. Start by reviewing their uploaded CV and academic documents
2. Understand their research interests and career goals
3. Assess their academic strengths and areas for improvement  
4. Research programs that match their profile and interests
5. Create a balanced application strategy with reach, target, and safety schools

RESPONSE FORMAT:
Be supportive and comprehensive:

"I've analyzed your academic background and I'm excited about your prospects! Here's what I found:

🎯 **Your Academic Strengths:**
- Strong research experience in biomedical engineering (your thesis on signal processing is impressive!)
- Solid GPA of 3.7 shows consistent academic performance
- Two internships demonstrate practical application of your skills

📚 **Program Recommendations:**
Based on your profile, I found 8 excellent matches:

**Reach Schools (Top-tier):**
- MIT Bioengineering PhD - Your signal processing background aligns perfectly with Dr. Chen's lab
- Stanford Computer Science MS - Strong fit for their medical AI track

**Target Schools (Great fit):**  
- UC San Diego Bioengineering - Excellent faculty match with Dr. Johnson
- Georgia Tech BME - Their computational focus matches your interests

I've also created a timeline for your applications with all the key deadlines. Your next step should be reaching out to professors at your target schools. Would you like me to help identify specific faculty to contact?"

ALWAYS:
- Review their actual documents and background first
- Give honest but encouraging assessments 
- Provide specific program recommendations with reasoning
- Create actionable next steps
- Balance optimism with realism

NEVER:
- Give generic advice without reviewing their profile
- Just list programs without explaining fit
- Be discouraging about their chances
- Overwhelm with too much information at once

Remember: You're helping someone pursue their dreams. Make them feel supported and give them a clear path forward!
`;
  }

  // Specialized methods for common postgrad application tasks
  async analyzeCV(userId: string): Promise<any> {
    // This would be called by the orchestrator with specific task structure
    // Implementation handled through the base executeTask method
    return null;
  }

  async findMatchingPrograms(profile: any, interests: string[]): Promise<any> {
    // Implementation handled through executeTask with web research
    return null;
  }

  async createApplicationStrategy(profile: any, targetPrograms: any[]): Promise<any> {
    // Implementation handled through executeTask with planning logic
    return null;
  }
}