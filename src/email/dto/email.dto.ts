import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsOptional, IsEnum, IsArray, IsObject, IsBoolean, IsUUID, IsInt, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

// Enums
export enum SubscriberStatus {
  ACTIVE = 'active',
  UNSUBSCRIBED = 'unsubscribed',
  BOUNCED = 'bounced'
}

export enum SubscriberSource {
  USER_REGISTRATION = 'user_registration',
  MANUAL_ADD = 'manual_add',
  IMPORTED = 'imported'
}

export enum CampaignStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  SENDING = 'sending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum EmailLogStatus {
  QUEUED = 'queued',
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  BOUNCED = 'bounced',
  FAILED = 'failed',
  UNSUBSCRIBED = 'unsubscribed'
}

// Subscriber DTOs
export class CreateSubscriberDto {
  @ApiProperty({ description: 'Subscriber email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Subscriber full name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Additional metadata as JSON object' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateSubscriberDto {
  @ApiPropertyOptional({ description: 'Subscriber full name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Subscriber status', enum: SubscriberStatus })
  @IsOptional()
  @IsEnum(SubscriberStatus)
  status?: SubscriberStatus;

  @ApiPropertyOptional({ description: 'Additional metadata as JSON object' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SubscriberResponseDto {
  @ApiProperty({ description: 'Subscriber ID' })
  id: string;

  @ApiProperty({ description: 'Email address' })
  email: string;

  @ApiProperty({ description: 'Full name' })
  name: string;

  @ApiPropertyOptional({ description: 'Associated user ID if subscriber is a registered user' })
  user_id: string | null;

  @ApiProperty({ description: 'Subscription status', enum: SubscriberStatus })
  status: SubscriberStatus;

  @ApiProperty({ description: 'How subscriber was added', enum: SubscriberSource })
  source: SubscriberSource;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Unsubscribe token' })
  unsubscribe_token: string | null;

  @ApiProperty({ description: 'Date subscribed' })
  subscribed_at: string;

  @ApiPropertyOptional({ description: 'Date unsubscribed' })
  unsubscribed_at: string | null;

  @ApiProperty({ description: 'Created date' })
  created_at: string;

  @ApiProperty({ description: 'Updated date' })
  updated_at: string;
}

export class SubscriberListQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by status', enum: SubscriberStatus })
  @IsOptional()
  @IsEnum(SubscriberStatus)
  status?: SubscriberStatus;

  @ApiPropertyOptional({ description: 'Filter by source', enum: SubscriberSource })
  @IsOptional()
  @IsEnum(SubscriberSource)
  source?: SubscriberSource;

  @ApiPropertyOptional({ description: 'Search by email or name' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class SubscriberListResponseDto {
  @ApiProperty({ type: [SubscriberResponseDto] })
  subscribers: SubscriberResponseDto[];

  @ApiProperty({ description: 'Total number of subscribers' })
  total: number;

  @ApiProperty({ description: 'Current page' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total pages' })
  totalPages: number;
}

// Email Template DTOs
export class CreateEmailTemplateDto {
  @ApiProperty({ description: 'Template name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Email subject line (supports variables)' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ description: 'HTML email content (supports variables)' })
  @IsString()
  @IsNotEmpty()
  html_content: string;

  @ApiPropertyOptional({ description: 'Plain text email content (supports variables)' })
  @IsOptional()
  @IsString()
  text_content?: string;

  @ApiPropertyOptional({ description: 'Available variables in template' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];

  @ApiPropertyOptional({ description: 'Mark as default template' })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}

export class UpdateEmailTemplateDto {
  @ApiPropertyOptional({ description: 'Template name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Email subject line (supports variables)' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'HTML email content (supports variables)' })
  @IsOptional()
  @IsString()
  html_content?: string;

  @ApiPropertyOptional({ description: 'Plain text email content (supports variables)' })
  @IsOptional()
  @IsString()
  text_content?: string;

  @ApiPropertyOptional({ description: 'Available variables in template' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];

  @ApiPropertyOptional({ description: 'Mark as default template' })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}

export class EmailTemplateResponseDto {
  @ApiProperty({ description: 'Template ID' })
  id: string;

  @ApiProperty({ description: 'Template name' })
  name: string;

  @ApiProperty({ description: 'Email subject' })
  subject: string;

  @ApiProperty({ description: 'HTML content' })
  html_content: string;

  @ApiPropertyOptional({ description: 'Text content' })
  text_content: string | null;

  @ApiProperty({ description: 'Available variables' })
  variables: string[];

  @ApiProperty({ description: 'Is default template' })
  is_default: boolean;

  @ApiPropertyOptional({ description: 'Created by user ID' })
  created_by: string | null;

  @ApiProperty({ description: 'Created date' })
  created_at: string;

  @ApiProperty({ description: 'Updated date' })
  updated_at: string;
}

// Email Campaign DTOs
export class CreateEmailCampaignDto {
  @ApiProperty({ description: 'Campaign name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Email subject line (can override template)' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiPropertyOptional({ description: 'Template ID to use' })
  @IsOptional()
  @IsUUID()
  template_id?: string;

  @ApiPropertyOptional({ description: 'Custom HTML content (overrides template)' })
  @IsOptional()
  @IsString()
  html_content?: string;

  @ApiPropertyOptional({ description: 'Custom text content (overrides template)' })
  @IsOptional()
  @IsString()
  text_content?: string;

  @ApiPropertyOptional({ description: 'Recipient filter criteria' })
  @IsOptional()
  @IsObject()
  recipient_filter?: {
    status?: SubscriberStatus[];
    source?: SubscriberSource[];
    metadata_filters?: Record<string, unknown>;
    include_users?: boolean;
    include_manual?: boolean;
  };

  @ApiPropertyOptional({ description: 'Schedule send time (ISO string)' })
  @IsOptional()
  @IsDateString()
  scheduled_at?: string;

  @ApiPropertyOptional({ description: 'Template variables and values' })
  @IsOptional()
  @IsObject()
  template_variables?: Record<string, string>;
}

export class UpdateEmailCampaignDto {
  @ApiPropertyOptional({ description: 'Campaign name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Email subject line' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Custom HTML content' })
  @IsOptional()
  @IsString()
  html_content?: string;

  @ApiPropertyOptional({ description: 'Custom text content' })
  @IsOptional()
  @IsString()
  text_content?: string;

  @ApiPropertyOptional({ description: 'Schedule send time (ISO string)' })
  @IsOptional()
  @IsDateString()
  scheduled_at?: string;

  @ApiPropertyOptional({ description: 'Template variables and values' })
  @IsOptional()
  @IsObject()
  template_variables?: Record<string, string>;
}

export class EmailCampaignResponseDto {
  @ApiProperty({ description: 'Campaign ID' })
  id: string;

  @ApiProperty({ description: 'Campaign name' })
  name: string;

  @ApiProperty({ description: 'Email subject' })
  subject: string;

  @ApiPropertyOptional({ description: 'Template ID' })
  template_id: string | null;

  @ApiPropertyOptional({ description: 'HTML content' })
  html_content: string | null;

  @ApiPropertyOptional({ description: 'Text content' })
  text_content: string | null;

  @ApiProperty({ description: 'Recipient filter criteria' })
  recipient_filter: Record<string, unknown>;

  @ApiProperty({ description: 'Total recipients' })
  total_recipients: number;

  @ApiProperty({ description: 'Emails sent' })
  sent_count: number;

  @ApiProperty({ description: 'Emails delivered' })
  delivered_count: number;

  @ApiProperty({ description: 'Failed emails' })
  failed_count: number;

  @ApiProperty({ description: 'Unsubscribes from this campaign' })
  unsubscribe_count: number;

  @ApiProperty({ description: 'Campaign status', enum: CampaignStatus })
  status: CampaignStatus;

  @ApiPropertyOptional({ description: 'Scheduled send time' })
  scheduled_at: string | null;

  @ApiPropertyOptional({ description: 'Campaign start time' })
  started_at: string | null;

  @ApiPropertyOptional({ description: 'Campaign completion time' })
  completed_at: string | null;

  @ApiPropertyOptional({ description: 'Created by user ID' })
  created_by: string | null;

  @ApiProperty({ description: 'Created date' })
  created_at: string;

  @ApiProperty({ description: 'Updated date' })
  updated_at: string;
}

export class CampaignListQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by status', enum: CampaignStatus })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @ApiPropertyOptional({ description: 'Search by campaign name' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class CampaignListResponseDto {
  @ApiProperty({ type: [EmailCampaignResponseDto] })
  campaigns: EmailCampaignResponseDto[];

  @ApiProperty({ description: 'Total number of campaigns' })
  total: number;

  @ApiProperty({ description: 'Current page' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total pages' })
  totalPages: number;
}

// Email Log DTOs
export class EmailLogResponseDto {
  @ApiProperty({ description: 'Log ID' })
  id: string;

  @ApiProperty({ description: 'Campaign ID' })
  campaign_id: string;

  @ApiProperty({ description: 'Subscriber ID' })
  subscriber_id: string;

  @ApiProperty({ description: 'Recipient email' })
  email: string;

  @ApiProperty({ description: 'Recipient name' })
  name: string;

  @ApiProperty({ description: 'Email status', enum: EmailLogStatus })
  status: EmailLogStatus;

  @ApiPropertyOptional({ description: 'Gmail message ID' })
  gmail_message_id: string | null;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  error_message: string | null;

  @ApiPropertyOptional({ description: 'Time email was sent' })
  sent_at: string | null;

  @ApiPropertyOptional({ description: 'Time email was delivered' })
  delivered_at: string | null;

  @ApiProperty({ description: 'Created date' })
  created_at: string;

  @ApiProperty({ description: 'Updated date' })
  updated_at: string;
}

// Bulk import DTOs
export class BulkImportSubscribersDto {
  @ApiProperty({ description: 'Array of subscriber data' })
  @IsArray()
  @Type(() => CreateSubscriberDto)
  subscribers: CreateSubscriberDto[];

  @ApiPropertyOptional({ description: 'Skip duplicates instead of failing', default: true })
  @IsOptional()
  @IsBoolean()
  skip_duplicates?: boolean = true;
}

export class BulkImportResponseDto {
  @ApiProperty({ description: 'Number of subscribers successfully imported' })
  imported_count: number;

  @ApiProperty({ description: 'Number of subscribers skipped (duplicates)' })
  skipped_count: number;

  @ApiProperty({ description: 'Number of subscribers that failed to import' })
  failed_count: number;

  @ApiProperty({ description: 'List of errors for failed imports' })
  errors: Array<{
    email: string;
    error: string;
  }>;
}

// Campaign preview and testing
export class PreviewCampaignDto {
  @ApiProperty({ description: 'Sample subscriber data for preview' })
  @IsObject()
  sample_data: {
    name: string;
    email: string;
    [key: string]: string;
  };
}

export class PreviewCampaignResponseDto {
  @ApiProperty({ description: 'Rendered subject line' })
  subject: string;

  @ApiProperty({ description: 'Rendered HTML content' })
  html_content: string;

  @ApiProperty({ description: 'Rendered text content' })
  text_content: string;

  @ApiProperty({ description: 'Variables found in template' })
  variables_used: string[];
}

// Unsubscribe DTOs
export class UnsubscribeDto {
  @ApiProperty({ description: 'Unsubscribe token' })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class UnsubscribeResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Subscriber email that was unsubscribed' })
  email: string;

  @ApiProperty({ description: 'Confirmation message' })
  message: string;
}