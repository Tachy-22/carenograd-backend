import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { 
  CreateSubscriberDto, 
  UpdateSubscriberDto, 
  SubscriberResponseDto, 
  SubscriberListQueryDto, 
  SubscriberListResponseDto,
  BulkImportSubscribersDto,
  BulkImportResponseDto,
  SubscriberStatus,
  SubscriberSource
} from '../dto/email.dto';

interface SubscriberRecord {
  id: string;
  email: string;
  name: string;
  user_id: string | null;
  status: SubscriberStatus;
  source: SubscriberSource;
  metadata: Record<string, unknown>;
  unsubscribe_token: string | null;
  subscribed_at: string;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class SubscriberService {
  private readonly logger = new Logger(SubscriberService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Create a new subscriber
   */
  async createSubscriber(createDto: CreateSubscriberDto): Promise<SubscriberResponseDto> {
    const supabase = this.databaseService.getSupabaseClient();

    this.logger.log(`Creating new subscriber: ${createDto.email}`);

    // Check if subscriber already exists
    const { data: existing } = await supabase
      .from('subscribers')
      .select('id, email, status')
      .eq('email', createDto.email)
      .single();

    if (existing) {
      if (existing.status === SubscriberStatus.UNSUBSCRIBED) {
        // Reactivate unsubscribed user
        const { data: updated, error } = await supabase
          .from('subscribers')
          .update({
            name: createDto.name,
            status: SubscriberStatus.ACTIVE,
            metadata: createDto.metadata || {},
            subscribed_at: new Date().toISOString(),
            unsubscribed_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          this.logger.error('Failed to reactivate subscriber:', error);
          throw new BadRequestException(`Failed to reactivate subscriber: ${error.message}`);
        }

        this.logger.log(`Reactivated subscriber: ${createDto.email}`);
        return this.mapToResponseDto(updated as SubscriberRecord);
      } else {
        throw new ConflictException('Subscriber already exists and is active');
      }
    }

    // Create new subscriber
    const { data, error } = await supabase
      .from('subscribers')
      .insert({
        email: createDto.email,
        name: createDto.name,
        source: SubscriberSource.MANUAL_ADD,
        metadata: createDto.metadata || {},
        status: SubscriberStatus.ACTIVE
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create subscriber:', error);
      throw new BadRequestException(`Failed to create subscriber: ${error.message}`);
    }

    this.logger.log(`Created subscriber: ${createDto.email}`);
    return this.mapToResponseDto(data as SubscriberRecord);
  }

  /**
   * Get subscriber by ID
   */
  async getSubscriberById(id: string): Promise<SubscriberResponseDto> {
    const supabase = this.databaseService.getSupabaseClient();

    const { data, error } = await supabase
      .from('subscribers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Subscriber not found');
    }

    return this.mapToResponseDto(data as SubscriberRecord);
  }

  /**
   * Get subscriber by email
   */
  async getSubscriberByEmail(email: string): Promise<SubscriberResponseDto | null> {
    const supabase = this.databaseService.getSupabaseClient();

    const { data, error } = await supabase
      .from('subscribers')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToResponseDto(data as SubscriberRecord);
  }

  /**
   * Update subscriber
   */
  async updateSubscriber(id: string, updateDto: UpdateSubscriberDto): Promise<SubscriberResponseDto> {
    const supabase = this.databaseService.getSupabaseClient();

    this.logger.log(`Updating subscriber: ${id}`);

    const updateData: Partial<SubscriberRecord> = {
      ...updateDto,
      updated_at: new Date().toISOString()
    };

    // Handle status changes
    if (updateDto.status === SubscriberStatus.UNSUBSCRIBED) {
      updateData.unsubscribed_at = new Date().toISOString();
    } else if (updateDto.status === SubscriberStatus.ACTIVE) {
      updateData.unsubscribed_at = null;
      updateData.subscribed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('subscribers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to update subscriber:', error);
      throw new BadRequestException(`Failed to update subscriber: ${error.message}`);
    }

    if (!data) {
      throw new NotFoundException('Subscriber not found');
    }

    this.logger.log(`Updated subscriber: ${id}`);
    return this.mapToResponseDto(data as SubscriberRecord);
  }

  /**
   * Delete subscriber
   */
  async deleteSubscriber(id: string): Promise<void> {
    const supabase = this.databaseService.getSupabaseClient();

    this.logger.log(`Deleting subscriber: ${id}`);

    const { error } = await supabase
      .from('subscribers')
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error('Failed to delete subscriber:', error);
      throw new BadRequestException(`Failed to delete subscriber: ${error.message}`);
    }

    this.logger.log(`Deleted subscriber: ${id}`);
  }

  /**
   * List subscribers with filtering and pagination
   */
  async listSubscribers(query: SubscriberListQueryDto): Promise<SubscriberListResponseDto> {
    const supabase = this.databaseService.getSupabaseClient();
    const { page = 1, limit = 20, status, source, search } = query;
    const offset = (page - 1) * limit;

    let baseQuery = supabase
      .from('subscribers')
      .select('*', { count: 'exact' });

    // Apply filters
    if (status) {
      baseQuery = baseQuery.eq('status', status);
    }

    if (source) {
      baseQuery = baseQuery.eq('source', source);
    }

    if (search) {
      baseQuery = baseQuery.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
    }

    // Apply pagination and ordering
    const { data, error, count } = await baseQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error('Failed to list subscribers:', error);
      throw new BadRequestException(`Failed to list subscribers: ${error.message}`);
    }

    const subscribers = (data || []).map(record => this.mapToResponseDto(record as SubscriberRecord));

    return {
      subscribers,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    };
  }

  /**
   * Get subscribers by filter criteria (for campaigns)
   */
  async getSubscribersByFilter(filter: Record<string, unknown>): Promise<SubscriberResponseDto[]> {
    const supabase = this.databaseService.getSupabaseClient();

    let query = supabase
      .from('subscribers')
      .select('*');

    // Apply status filter - default to active only if no status specified
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      query = query.in('status', statuses);
    } else {
      // Default to active only for safety
      query = query.eq('status', SubscriberStatus.ACTIVE);
    }

    // Apply filters
    if (filter.source) {
      const sources = Array.isArray(filter.source) ? filter.source : [filter.source];
      query = query.in('source', sources);
    }

    if (filter.include_users === false) {
      query = query.is('user_id', null);
    }

    if (filter.include_manual === false) {
      query = query.neq('source', SubscriberSource.MANUAL_ADD);
    }

    // Add metadata filters if needed
    if (filter.metadata_filters && typeof filter.metadata_filters === 'object') {
      const metadataFilters = filter.metadata_filters as Record<string, unknown>;
      for (const [key, value] of Object.entries(metadataFilters)) {
        query = query.contains('metadata', { [key]: value });
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Failed to get subscribers by filter:', error);
      throw new BadRequestException(`Failed to get subscribers: ${error.message}`);
    }

    return (data || []).map(record => this.mapToResponseDto(record as SubscriberRecord));
  }

  /**
   * Bulk import subscribers
   */
  async bulkImportSubscribers(importDto: BulkImportSubscribersDto): Promise<BulkImportResponseDto> {
    const supabase = this.databaseService.getSupabaseClient();
    const { subscribers, skip_duplicates = true } = importDto;

    this.logger.log(`Bulk importing ${subscribers.length} subscribers`);

    const results: BulkImportResponseDto = {
      imported_count: 0,
      skipped_count: 0,
      failed_count: 0,
      errors: []
    };

    for (const subscriberData of subscribers) {
      try {
        // Check if subscriber exists
        const { data: existing } = await supabase
          .from('subscribers')
          .select('id, status')
          .eq('email', subscriberData.email)
          .single();

        if (existing) {
          if (skip_duplicates) {
            results.skipped_count++;
            continue;
          } else {
            results.errors.push({
              email: subscriberData.email,
              error: 'Subscriber already exists'
            });
            results.failed_count++;
            continue;
          }
        }

        // Create subscriber
        const { error } = await supabase
          .from('subscribers')
          .insert({
            email: subscriberData.email,
            name: subscriberData.name,
            source: SubscriberSource.IMPORTED,
            metadata: subscriberData.metadata || {},
            status: SubscriberStatus.ACTIVE
          });

        if (error) {
          results.errors.push({
            email: subscriberData.email,
            error: error.message
          });
          results.failed_count++;
        } else {
          results.imported_count++;
        }
      } catch (error) {
        results.errors.push({
          email: subscriberData.email,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        results.failed_count++;
      }
    }

    this.logger.log(`Bulk import completed: ${results.imported_count} imported, ${results.skipped_count} skipped, ${results.failed_count} failed`);
    return results;
  }

  /**
   * Unsubscribe by token
   */
  async unsubscribeByToken(token: string): Promise<SubscriberResponseDto> {
    const supabase = this.databaseService.getSupabaseClient();

    this.logger.log(`Unsubscribing with token: ${token}`);

    const { data, error } = await supabase
      .from('subscribers')
      .update({
        status: SubscriberStatus.UNSUBSCRIBED,
        unsubscribed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('unsubscribe_token', token)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Invalid unsubscribe token');
    }

    this.logger.log(`Unsubscribed subscriber: ${data.email}`);
    return this.mapToResponseDto(data as SubscriberRecord);
  }

  /**
   * Sync existing users to subscribers
   */
  async syncUsersToSubscribers(): Promise<number> {
    const supabase = this.databaseService.getSupabaseClient();

    this.logger.log('Syncing existing users to subscribers');

    const { data, error } = await supabase.rpc('sync_users_to_subscribers');

    if (error) {
      this.logger.error('Failed to sync users to subscribers:', error);
      throw new BadRequestException(`Failed to sync users: ${error.message}`);
    }

    const syncedCount = data as number;
    this.logger.log(`Synced ${syncedCount} users to subscribers`);
    return syncedCount;
  }

  /**
   * Get subscriber statistics
   */
  async getSubscriberStats(): Promise<{
    total: number;
    active: number;
    unsubscribed: number;
    bounced: number;
    by_source: Record<SubscriberSource, number>;
  }> {
    const supabase = this.databaseService.getSupabaseClient();

    const [totalResult, statusResult, sourceResult] = await Promise.all([
      supabase.from('subscribers').select('id', { count: 'exact', head: true }),
      supabase.from('subscribers').select('status', { count: 'exact' }),
      supabase.from('subscribers').select('source', { count: 'exact' })
    ]);

    const total = totalResult.count || 0;
    
    // Count by status
    const statusCounts = {
      active: 0,
      unsubscribed: 0,
      bounced: 0
    };

    if (statusResult.data) {
      statusResult.data.forEach(row => {
        const status = row.status as SubscriberStatus;
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
    }

    // Count by source
    const sourceCounts: Record<SubscriberSource, number> = {
      [SubscriberSource.USER_REGISTRATION]: 0,
      [SubscriberSource.MANUAL_ADD]: 0,
      [SubscriberSource.IMPORTED]: 0
    };

    if (sourceResult.data) {
      sourceResult.data.forEach(row => {
        const source = row.source as SubscriberSource;
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
      });
    }

    return {
      total,
      active: statusCounts.active,
      unsubscribed: statusCounts.unsubscribed,
      bounced: statusCounts.bounced,
      by_source: sourceCounts
    };
  }

  /**
   * Map database record to response DTO
   */
  private mapToResponseDto(record: SubscriberRecord): SubscriberResponseDto {
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      user_id: record.user_id,
      status: record.status,
      source: record.source,
      metadata: record.metadata,
      unsubscribe_token: record.unsubscribe_token,
      subscribed_at: record.subscribed_at,
      unsubscribed_at: record.unsubscribed_at,
      created_at: record.created_at,
      updated_at: record.updated_at
    };
  }
}