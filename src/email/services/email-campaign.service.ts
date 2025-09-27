import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { SubscriberService } from './subscriber.service';
import { 
  CreateEmailCampaignDto, 
  UpdateEmailCampaignDto, 
  EmailCampaignResponseDto, 
  CampaignListQueryDto, 
  CampaignListResponseDto,
  EmailLogResponseDto,
  PreviewCampaignDto,
  PreviewCampaignResponseDto,
  CampaignStatus,
  EmailLogStatus,
  SubscriberStatus
} from '../dto/email.dto';
// Import Gmail sending functions directly instead of using AI SDK tools
import axios from 'axios';
import { getAccessToken, authContext } from '../../../utils/auth-context';

interface CampaignRecord {
  id: string;
  name: string;
  subject: string;
  template_id: string | null;
  html_content: string | null;
  text_content: string | null;
  recipient_filter: Record<string, unknown>;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  unsubscribe_count: number;
  status: CampaignStatus;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface EmailTemplateRecord {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  text_content: string | null;
  variables: string[];
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface EmailLogRecord {
  id: string;
  campaign_id: string;
  subscriber_id: string;
  email: string;
  name: string;
  status: EmailLogStatus;
  gmail_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class EmailCampaignService {
  private readonly logger = new Logger(EmailCampaignService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly subscriberService: SubscriberService
  ) {}

  /**
   * Create a new email campaign
   */
  async createCampaign(createDto: CreateEmailCampaignDto, createdBy: string | null): Promise<EmailCampaignResponseDto> {
    const supabase = this.databaseService.getSupabaseClient();

    this.logger.log(`Creating new campaign: ${createDto.name}`);

    // Validate template if provided
    if (createDto.template_id) {
      await this.getTemplateById(createDto.template_id);
    }

    // Count potential recipients
    const recipients = await this.subscriberService.getSubscribersByFilter(createDto.recipient_filter || {});
    const totalRecipients = recipients.length;

    const { data, error } = await supabase
      .from('email_campaigns')
      .insert({
        name: createDto.name,
        subject: createDto.subject,
        template_id: createDto.template_id || null,
        html_content: createDto.html_content || null,
        text_content: createDto.text_content || null,
        recipient_filter: createDto.recipient_filter || {},
        total_recipients: totalRecipients,
        scheduled_at: createDto.scheduled_at ? new Date(createDto.scheduled_at).toISOString() : null,
        created_by: createdBy,
        status: createDto.scheduled_at ? CampaignStatus.SCHEDULED : CampaignStatus.DRAFT
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create campaign:', error);
      throw new BadRequestException(`Failed to create campaign: ${error.message}`);
    }

    this.logger.log(`Created campaign: ${createDto.name} with ${totalRecipients} recipients`);
    return this.mapCampaignToResponseDto(data as CampaignRecord);
  }

  /**
   * Get campaign by ID
   */
  async getCampaignById(id: string): Promise<EmailCampaignResponseDto> {
    const supabase = this.databaseService.getSupabaseClient();

    const { data, error } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Campaign not found');
    }

    return this.mapCampaignToResponseDto(data as CampaignRecord);
  }

  /**
   * Update campaign
   */
  async updateCampaign(id: string, updateDto: UpdateEmailCampaignDto): Promise<EmailCampaignResponseDto> {
    const supabase = this.databaseService.getSupabaseClient();

    // Check if campaign exists and is editable
    const campaign = await this.getCampaignById(id);
    if (campaign.status === CampaignStatus.SENDING || campaign.status === CampaignStatus.COMPLETED) {
      throw new BadRequestException('Cannot update campaign that is sending or completed');
    }

    this.logger.log(`Updating campaign: ${id}`);

    const updateData: Partial<CampaignRecord> = {
      ...updateDto,
      updated_at: new Date().toISOString()
    };

    if (updateDto.scheduled_at) {
      updateData.scheduled_at = new Date(updateDto.scheduled_at).toISOString();
      updateData.status = CampaignStatus.SCHEDULED;
    }

    const { data, error } = await supabase
      .from('email_campaigns')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to update campaign:', error);
      throw new BadRequestException(`Failed to update campaign: ${error.message}`);
    }

    if (!data) {
      throw new NotFoundException('Campaign not found');
    }

    this.logger.log(`Updated campaign: ${id}`);
    return this.mapCampaignToResponseDto(data as CampaignRecord);
  }

  /**
   * Delete campaign
   */
  async deleteCampaign(id: string): Promise<void> {
    const supabase = this.databaseService.getSupabaseClient();

    // Check if campaign can be deleted
    const campaign = await this.getCampaignById(id);
    if (campaign.status === CampaignStatus.SENDING) {
      throw new BadRequestException('Cannot delete campaign that is currently sending');
    }

    this.logger.log(`Deleting campaign: ${id}`);

    const { error } = await supabase
      .from('email_campaigns')
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error('Failed to delete campaign:', error);
      throw new BadRequestException(`Failed to delete campaign: ${error.message}`);
    }

    this.logger.log(`Deleted campaign: ${id}`);
  }

  /**
   * List campaigns with filtering and pagination
   */
  async listCampaigns(query: CampaignListQueryDto): Promise<CampaignListResponseDto> {
    const supabase = this.databaseService.getSupabaseClient();
    const { page = 1, limit = 20, status, search } = query;
    const offset = (page - 1) * limit;

    let baseQuery = supabase
      .from('email_campaigns')
      .select('*', { count: 'exact' });

    // Apply filters
    if (status) {
      baseQuery = baseQuery.eq('status', status);
    }

    if (search) {
      baseQuery = baseQuery.ilike('name', `%${search}%`);
    }

    // Apply pagination and ordering
    const { data, error, count } = await baseQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error('Failed to list campaigns:', error);
      throw new BadRequestException(`Failed to list campaigns: ${error.message}`);
    }

    const campaigns = (data || []).map(record => this.mapCampaignToResponseDto(record as CampaignRecord));

    return {
      campaigns,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    };
  }

  /**
   * Send campaign immediately
   */
  async sendCampaign(id: string): Promise<{ message: string; total_recipients: number }> {
    const supabase = this.databaseService.getSupabaseClient();

    // Get campaign details
    const campaign = await this.getCampaignById(id);

    if (campaign.status !== CampaignStatus.DRAFT && campaign.status !== CampaignStatus.SCHEDULED) {
      throw new BadRequestException('Campaign must be in draft or scheduled status to send');
    }

    this.logger.log(`Starting to send campaign: ${campaign.name}`);

    // Update campaign status to sending
    await supabase
      .from('email_campaigns')
      .update({
        status: CampaignStatus.SENDING,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    // Get recipients
    const recipients = await this.subscriberService.getSubscribersByFilter(campaign.recipient_filter);

    if (recipients.length === 0) {
      // Mark campaign as completed if no recipients
      await supabase
        .from('email_campaigns')
        .update({
          status: CampaignStatus.COMPLETED,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      return { message: 'No recipients found for campaign', total_recipients: 0 };
    }

    // Start sending process in background
    this.processCampaignSending(id, campaign, recipients).catch(error => {
      this.logger.error(`Failed to process campaign sending: ${error.message}`, error);
    });

    return { message: 'Campaign sending started', total_recipients: recipients.length };
  }

  /**
   * Preview campaign with sample data
   */
  async previewCampaign(id: string, previewDto: PreviewCampaignDto): Promise<PreviewCampaignResponseDto> {
    const campaign = await this.getCampaignById(id);
    let template: EmailTemplateRecord | null = null;

    // Get template if campaign uses one
    if (campaign.template_id) {
      template = await this.getTemplateById(campaign.template_id);
    }

    // Use campaign content or template content
    const htmlContent = campaign.html_content || template?.html_content || '';
    const textContent = campaign.text_content || template?.text_content || '';
    const subject = campaign.subject;

    // Add default variables
    const variables = {
      ...previewDto.sample_data,
      unsubscribe_url: `${process.env.FRONTEND_URL}/unsubscribe?token=sample_token`,
      company_name: 'Your Company'
    };

    // Render content with variables
    const renderedSubject = this.renderTemplate(subject, variables);
    const renderedHtml = this.renderTemplate(htmlContent, variables);
    const renderedText = this.renderTemplate(textContent, variables);

    // Extract variables used
    const variablesUsed = this.extractVariables(htmlContent + textContent + subject);

    return {
      subject: renderedSubject,
      html_content: renderedHtml,
      text_content: renderedText,
      variables_used: variablesUsed
    };
  }

  /**
   * Get campaign email logs
   */
  async getCampaignLogs(campaignId: string, page: number = 1, limit: number = 20): Promise<{
    logs: EmailLogResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const supabase = this.databaseService.getSupabaseClient();
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('email_logs')
      .select('*', { count: 'exact' })
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error('Failed to get campaign logs:', error);
      throw new BadRequestException(`Failed to get campaign logs: ${error.message}`);
    }

    const logs = (data || []).map(record => this.mapLogToResponseDto(record as EmailLogRecord));

    return {
      logs,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    };
  }

  /**
   * Process campaign sending (background task)
   */
  private async processCampaignSending(
    campaignId: string, 
    campaign: EmailCampaignResponseDto, 
    recipients: Array<{ id: string; email: string; name: string; unsubscribe_token: string | null }>
  ): Promise<void> {
    const supabase = this.databaseService.getSupabaseClient();
    let template: EmailTemplateRecord | null = null;

    this.logger.log(`Processing campaign sending: ${campaign.name} to ${recipients.length} recipients`);

    // Initialize Gmail access token from admin user
    await this.initializeGmailAccess();

    // Get template if campaign uses one
    if (campaign.template_id) {
      try {
        template = await this.getTemplateById(campaign.template_id);
      } catch (error) {
        this.logger.error(`Failed to get template: ${error.message}`);
      }
    }

    let sentCount = 0;
    let failedCount = 0;

    // Create email logs for all recipients
    const emailLogs = recipients.map(recipient => ({
      campaign_id: campaignId,
      subscriber_id: recipient.id,
      email: recipient.email,
      name: recipient.name,
      status: EmailLogStatus.QUEUED
    }));

    const { data: createdLogs, error: logError } = await supabase
      .from('email_logs')
      .insert(emailLogs)
      .select();

    if (logError) {
      this.logger.error('Failed to create email logs:', logError);
      return;
    }

    // Send emails with rate limiting
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const logRecord = createdLogs?.find(log => log.subscriber_id === recipient.id);

      if (!logRecord) {
        continue;
      }

      try {
        // Update log status to sending
        await supabase
          .from('email_logs')
          .update({ 
            status: EmailLogStatus.SENDING,
            updated_at: new Date().toISOString()
          })
          .eq('id', logRecord.id);

        // Prepare email variables
        const variables = {
          name: recipient.name,
          email: recipient.email,
          unsubscribe_url: `${process.env.FRONTEND_URL}/unsubscribe?token=${recipient.unsubscribe_token}`,
          company_name: 'Your Company'
        };

        // Use campaign content or template content
        const htmlContent = campaign.html_content || template?.html_content || '';
        const textContent = campaign.text_content || template?.text_content || '';

        // Render content with variables
        const renderedSubject = this.renderTemplate(campaign.subject, variables);
        const renderedHtml = this.renderTemplate(htmlContent, variables);
        const renderedText = this.renderTemplate(textContent, variables);

        // Send email using Gmail API directly
        const emailResult = await this.sendEmailViaGmail(
          recipient.email,
          renderedSubject,
          renderedHtml
        );

        if (emailResult.success) {
          // Update log status to sent
          await supabase
            .from('email_logs')
            .update({ 
              status: EmailLogStatus.SENT,
              gmail_message_id: emailResult.messageId || null,
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', logRecord.id);

          sentCount++;
          this.logger.log(`Sent email to ${recipient.email}`);
        } else {
          // Update log status to failed
          await supabase
            .from('email_logs')
            .update({ 
              status: EmailLogStatus.FAILED,
              error_message: emailResult.error || 'Unknown error',
              updated_at: new Date().toISOString()
            })
            .eq('id', logRecord.id);

          failedCount++;
          this.logger.error(`Failed to send email to ${recipient.email}: ${emailResult.error}`);
        }

        // Rate limiting: wait between emails to respect Gmail API limits
        if (i < recipients.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }

      } catch (error) {
        // Update log status to failed
        await supabase
          .from('email_logs')
          .update({ 
            status: EmailLogStatus.FAILED,
            error_message: error instanceof Error ? error.message : 'Unknown error',
            updated_at: new Date().toISOString()
          })
          .eq('id', logRecord.id);

        failedCount++;
        this.logger.error(`Error sending email to ${recipient.email}:`, error);
      }
    }

    // Update campaign final status
    await supabase
      .from('email_campaigns')
      .update({
        status: CampaignStatus.COMPLETED,
        sent_count: sentCount,
        failed_count: failedCount,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    this.logger.log(`Campaign completed: ${campaign.name}. Sent: ${sentCount}, Failed: ${failedCount}`);
  }

  /**
   * Get template by ID
   */
  private async getTemplateById(id: string): Promise<EmailTemplateRecord> {
    const supabase = this.databaseService.getSupabaseClient();

    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Template not found');
    }

    return data as EmailTemplateRecord;
  }

  /**
   * Render template with variables using simple string replacement
   */
  private renderTemplate(template: string, variables: Record<string, string>): string {
    let rendered = template;

    // Replace {{variable}} patterns
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      rendered = rendered.replace(regex, value || '');
    }

    // Handle conditional blocks {{#if variable}}...{{/if}}
    rendered = rendered.replace(/\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs, (match, varName, content) => {
      return variables[varName] ? content : '';
    });

    return rendered;
  }

  /**
   * Extract variable names from template
   */
  private extractVariables(template: string): string[] {
    const matches = template.match(/\{\{\s*(\w+)\s*\}\}/g);
    if (!matches) return [];

    return [...new Set(matches.map(match => match.replace(/\{\{\s*|\s*\}\}/g, '')))];
  }

  /**
   * Map campaign record to response DTO
   */
  private mapCampaignToResponseDto(record: CampaignRecord): EmailCampaignResponseDto {
    return {
      id: record.id,
      name: record.name,
      subject: record.subject,
      template_id: record.template_id,
      html_content: record.html_content,
      text_content: record.text_content,
      recipient_filter: record.recipient_filter,
      total_recipients: record.total_recipients,
      sent_count: record.sent_count,
      delivered_count: record.delivered_count,
      failed_count: record.failed_count,
      unsubscribe_count: record.unsubscribe_count,
      status: record.status,
      scheduled_at: record.scheduled_at,
      started_at: record.started_at,
      completed_at: record.completed_at,
      created_by: record.created_by,
      created_at: record.created_at,
      updated_at: record.updated_at
    };
  }

  /**
   * Initialize Gmail access token from an admin user
   */
  private async initializeGmailAccess(): Promise<void> {
    const supabase = this.databaseService.getSupabaseClient();
    
    try {
      // Find an admin user with a valid access token
      const { data: adminUsers, error } = await supabase
        .from('users')
        .select('access_token, refresh_token, token_expires_at')
        .eq('role', 'admin')
        .eq('is_active', true)
        .not('access_token', 'is', null)
        .limit(1);

      if (error || !adminUsers || adminUsers.length === 0) {
        this.logger.error('No admin user with access token found for Gmail sending');
        return;
      }

      const adminUser = adminUsers[0];
      const expiresAt = adminUser.token_expires_at ? new Date(adminUser.token_expires_at) : undefined;
      
      // Set the access token in auth context
      authContext.setAccessToken(adminUser.access_token, expiresAt);
      
      this.logger.log('Gmail access token initialized for email sending');
    } catch (error) {
      this.logger.error('Failed to initialize Gmail access:', error);
    }
  }

  /**
   * Send email via Gmail API directly
   */
  private async sendEmailViaGmail(
    to: string,
    subject: string,
    htmlContent: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        return { success: false, error: 'Google access token not found' };
      }

      // Construct email headers
      const headers = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset="UTF-8"',
        'Content-Transfer-Encoding: 7bit'
      ];

      // Combine headers and body
      const rawEmail = headers.join('\n') + `\n\n${htmlContent}`;
      const encodedEmail = Buffer.from(rawEmail)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await axios.post(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        {
          raw: encodedEmail
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        messageId: response.data.id
      };
    } catch (error) {
      this.logger.error('Gmail API error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Map log record to response DTO
   */
  private mapLogToResponseDto(record: EmailLogRecord): EmailLogResponseDto {
    return {
      id: record.id,
      campaign_id: record.campaign_id,
      subscriber_id: record.subscriber_id,
      email: record.email,
      name: record.name,
      status: record.status,
      gmail_message_id: record.gmail_message_id,
      error_message: record.error_message,
      sent_at: record.sent_at,
      delivered_at: record.delivered_at,
      created_at: record.created_at,
      updated_at: record.updated_at
    };
  }
}