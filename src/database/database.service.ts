import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface User {
  id: string;
  email: string;
  google_id: string;
  name: string;
  picture?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: Date;
  role: 'user' | 'admin';
  is_active: boolean;
  last_login_at?: Date;
  subscription_tier_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface Document {
  id: string;
  user_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  file_path: string;
  upload_status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_error?: string;
  created_at: Date;
  updated_at: Date;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  user_id: string;
  content: string;
  chunk_index: number;
  embedding?: number[];
  metadata?: Record<string, any>;
  created_at: Date;
}

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.logger.log('Database service initialized');
  }

  // Raw query method for custom SQL operations
  async query(sql: string, params: any[] = []): Promise<{ rows: any[], error?: any }> {
    try {
      // Use Supabase RPC for custom SQL queries
      const { data, error } = await this.supabase.rpc('execute_sql', {
        sql_query: sql,
        sql_params: params
      });

      if (error) {
        this.logger.error('Database query error:', error);
        return { rows: [], error };
      }

      return { rows: data || [], error: null };
    } catch (error) {
      this.logger.error('Database query exception:', error);
      return { rows: [], error };
    }
  }

  // Get Supabase client for direct access
  getSupabaseClient() {
    return this.supabase;
  }

  // User operations
  async createUser(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const { data, error } = await this.supabase
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    return data;
  }

  async findUserByGoogleId(googleId: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('google_id', googleId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    const { data, error } = await this.supabase
      .from('users')
      .update({ ...userData, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Conversation operations
  async createConversation(userId: string, title: string = 'New Conversation'): Promise<Conversation> {
    const { data, error } = await this.supabase
      .from('conversations')
      .insert({ user_id: userId, title })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getUserConversations(userId: string): Promise<Conversation[]> {
    const { data, error } = await this.supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async updateConversation(id: string, userId: string, updates: Partial<Conversation>): Promise<Conversation> {
    const { data, error } = await this.supabase
      .from('conversations')
      .update({ ...updates, updated_at: new Date() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Message operations
  async createMessage(messageData: Omit<Message, 'id' | 'created_at'>): Promise<Message> {
    const { data, error } = await this.supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getConversationMessages(conversationId: string, userId: string, limit?: number): Promise<Message[]> {
    let query = this.supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (limit) {
      // For limited results, get newest messages first, then reverse
      query = query.order('created_at', { ascending: false }).limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).reverse(); // Return in chronological order (oldest first)
    } else {
      // For unlimited results, get in chronological order directly
      query = query.order('created_at', { ascending: true });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  }

  // Document operations
  async createDocument(documentData: Omit<Document, 'id' | 'created_at' | 'updated_at'>): Promise<Document> {
    const { data, error } = await this.supabase
      .from('documents')
      .insert(documentData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getUserDocuments(userId: string): Promise<Document[]> {
    const { data, error } = await this.supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async updateDocumentStatus(id: string, status: Document['upload_status'], processingError?: string): Promise<Document> {
    const updateData: any = { 
      upload_status: status, 
      updated_at: new Date() 
    };
    
    if (processingError) {
      updateData.processing_error = processingError;
    }

    const { data, error } = await this.supabase
      .from('documents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Document chunk operations
  async createDocumentChunk(chunkData: Omit<DocumentChunk, 'id' | 'created_at'>): Promise<DocumentChunk> {
    const { data, error } = await this.supabase
      .from('document_chunks')
      .insert(chunkData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getUserDocumentChunks(userId: string, query?: string): Promise<DocumentChunk[]> {
    let queryBuilder = this.supabase
      .from('document_chunks')
      .select('*')
      .eq('user_id', userId);

    if (query) {
      // Use text search if query is provided
      queryBuilder = queryBuilder.textSearch('content', query);
    }

    const { data, error } = await queryBuilder.order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async searchSimilarChunks(userId: string, embedding: number[], limit: number = 5): Promise<DocumentChunk[]> {
    // Note: This requires pgvector extension and proper RPC function in Supabase
    const { data, error } = await this.supabase
      .rpc('match_document_chunks', {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: limit,
        user_id_filter: userId
      });

    if (error) throw error;
    return data || [];
  }

  async deleteUserDocuments(userId: string): Promise<void> {
    // Delete chunks first due to foreign key constraints
    await this.supabase
      .from('document_chunks')
      .delete()
      .eq('user_id', userId);

    // Then delete documents
    await this.supabase
      .from('documents')
      .delete()
      .eq('user_id', userId);
  }

  // Admin-specific methods
  async getAllUsers(limit?: number, offset?: number): Promise<{ users: User[], total: number }> {
    let query = this.supabase
      .from('users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (limit) query = query.limit(limit);
    if (offset) query = query.range(offset, offset + (limit || 10) - 1);

    const { data, error, count } = await query;

    if (error) throw error;
    return { users: data || [], total: count || 0 };
  }

  async getUserById(id: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async updateUserRole(id: string, role: 'user' | 'admin'): Promise<User> {
    const { data, error } = await this.supabase
      .from('users')
      .update({ role, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async toggleUserStatus(id: string, isActive: boolean): Promise<User> {
    const { data, error } = await this.supabase
      .from('users')
      .update({ is_active: isActive, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    adminUsers: number;
    newUsersToday: number;
    newUsersThisWeek: number;
    newUsersThisMonth: number;
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalUsers, activeUsers, adminUsers, newUsersToday, newUsersThisWeek, newUsersThisMonth] = await Promise.all([
      this.supabase.from('users').select('id', { count: 'exact', head: true }),
      this.supabase.from('users').select('id', { count: 'exact', head: true }).eq('is_active', true),
      this.supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
      this.supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      this.supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
      this.supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', monthAgo.toISOString()),
    ]);

    return {
      totalUsers: totalUsers.count || 0,
      activeUsers: activeUsers.count || 0,
      adminUsers: adminUsers.count || 0,
      newUsersToday: newUsersToday.count || 0,
      newUsersThisWeek: newUsersThisWeek.count || 0,
      newUsersThisMonth: newUsersThisMonth.count || 0,
    };
  }

  async getConversationStats(): Promise<{
    totalConversations: number;
    conversationsToday: number;
    conversationsThisWeek: number;
    conversationsThisMonth: number;
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [total, today_count, week_count, month_count] = await Promise.all([
      this.supabase.from('conversations').select('id', { count: 'exact', head: true }),
      this.supabase.from('conversations').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      this.supabase.from('conversations').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
      this.supabase.from('conversations').select('id', { count: 'exact', head: true }).gte('created_at', monthAgo.toISOString()),
    ]);

    return {
      totalConversations: total.count || 0,
      conversationsToday: today_count.count || 0,
      conversationsThisWeek: week_count.count || 0,
      conversationsThisMonth: month_count.count || 0,
    };
  }

  async getMessageStats(): Promise<{
    totalMessages: number;
    messagesToday: number;
    messagesThisWeek: number;
    messagesThisMonth: number;
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [total, today_count, week_count, month_count] = await Promise.all([
      this.supabase.from('messages').select('id', { count: 'exact', head: true }),
      this.supabase.from('messages').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      this.supabase.from('messages').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
      this.supabase.from('messages').select('id', { count: 'exact', head: true }).gte('created_at', monthAgo.toISOString()),
    ]);

    return {
      totalMessages: total.count || 0,
      messagesToday: today_count.count || 0,
      messagesThisWeek: week_count.count || 0,
      messagesThisMonth: month_count.count || 0,
    };
  }

  async getUserActivity(userId: string): Promise<{
    conversations: number;
    messages: number;
    documents: number;
    lastActive: Date | null;
  }> {
    const [conversations, messages, documents, user] = await Promise.all([
      this.supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      this.supabase.from('messages').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      this.supabase.from('documents').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      this.supabase.from('users').select('last_login_at').eq('id', userId).single(),
    ]);

    return {
      conversations: conversations.count || 0,
      messages: messages.count || 0,
      documents: documents.count || 0,
      lastActive: user.data?.last_login_at ? new Date(user.data.last_login_at) : null,
    };
  }

  async getAllConversations(limit?: number, offset?: number): Promise<{ conversations: any[], total: number }> {
    let query = this.supabase
      .from('conversations')
      .select(`
        *,
        users!inner (
          id,
          email,
          name,
          picture
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (limit) query = query.limit(limit);
    if (offset) query = query.range(offset, offset + (limit || 10) - 1);

    const { data, error, count } = await query;

    if (error) throw error;
    return { conversations: data || [], total: count || 0 };
  }

  async deleteUser(id: string): Promise<void> {
    // Delete user data in order (FK constraints)
    await this.supabase.from('document_chunks').delete().eq('user_id', id);
    await this.supabase.from('documents').delete().eq('user_id', id);
    await this.supabase.from('messages').delete().eq('user_id', id);
    await this.supabase.from('conversations').delete().eq('user_id', id);
    await this.supabase.from('users').delete().eq('id', id);
  }

  // Chart and Analytics Data Methods
  async getUserRegistrationChart(days: number = 30): Promise<{ date: string; count: number }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('users')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group by date
    const chartData: { [key: string]: number } = {};
    
    // Initialize all dates with 0
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split('T')[0];
      chartData[dateStr] = 0;
    }

    // Count registrations per day
    data?.forEach(user => {
      const dateStr = new Date(user.created_at).toISOString().split('T')[0];
      if (chartData.hasOwnProperty(dateStr)) {
        chartData[dateStr]++;
      }
    });

    return Object.entries(chartData).map(([date, count]) => ({ date, count }));
  }

  async getActiveUsersChart(days: number = 30): Promise<{ date: string; count: number }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('users')
      .select('last_login_at')
      .gte('last_login_at', startDate.toISOString())
      .not('last_login_at', 'is', null);

    if (error) throw error;

    // Group by date
    const chartData: { [key: string]: Set<string> } = {};
    
    // Initialize all dates with empty sets
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split('T')[0];
      chartData[dateStr] = new Set();
    }

    // Count unique active users per day
    data?.forEach(user => {
      if (user.last_login_at) {
        const dateStr = new Date(user.last_login_at).toISOString().split('T')[0];
        if (chartData.hasOwnProperty(dateStr)) {
          chartData[dateStr].add(user.last_login_at); // Using timestamp as unique identifier
        }
      }
    });

    return Object.entries(chartData).map(([date, userSet]) => ({ 
      date, 
      count: userSet.size 
    }));
  }

  async getConversationsChart(days: number = 30): Promise<{ date: string; count: number }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('conversations')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group by date
    const chartData: { [key: string]: number } = {};
    
    // Initialize all dates with 0
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split('T')[0];
      chartData[dateStr] = 0;
    }

    // Count conversations per day
    data?.forEach(conversation => {
      const dateStr = new Date(conversation.created_at).toISOString().split('T')[0];
      if (chartData.hasOwnProperty(dateStr)) {
        chartData[dateStr]++;
      }
    });

    return Object.entries(chartData).map(([date, count]) => ({ date, count }));
  }

  async getMessagesChart(days: number = 30): Promise<{ date: string; count: number }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('messages')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group by date
    const chartData: { [key: string]: number } = {};
    
    // Initialize all dates with 0
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split('T')[0];
      chartData[dateStr] = 0;
    }

    // Count messages per day
    data?.forEach(message => {
      const dateStr = new Date(message.created_at).toISOString().split('T')[0];
      if (chartData.hasOwnProperty(dateStr)) {
        chartData[dateStr]++;
      }
    });

    return Object.entries(chartData).map(([date, count]) => ({ date, count }));
  }

  async getUserActivityHeatmap(): Promise<{ hour: number; day: number; count: number }[]> {
    const { data, error } = await this.supabase
      .from('messages')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (error) throw error;

    const heatmapData: { [key: string]: number } = {};

    data?.forEach(message => {
      const date = new Date(message.created_at);
      const hour = date.getHours();
      const day = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const key = `${day}-${hour}`;
      heatmapData[key] = (heatmapData[key] || 0) + 1;
    });

    const result: { hour: number; day: number; count: number }[] = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${day}-${hour}`;
        result.push({
          hour,
          day,
          count: heatmapData[key] || 0
        });
      }
    }

    return result;
  }

  async getTopActiveUsers(limit: number = 10): Promise<{ 
    user: User; 
    messageCount: number; 
    conversationCount: number; 
    lastActivity: Date 
  }[]> {
    // Get users with their message counts
    const { data: userMessages, error: messagesError } = await this.supabase
      .from('messages')
      .select(`
        user_id,
        created_at,
        users!inner (
          id,
          email,
          google_id,
          name,
          picture,
          role,
          is_active,
          last_login_at,
          created_at,
          updated_at
        )
      `)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (messagesError) throw messagesError;

    // Get conversation counts
    const { data: userConversations, error: conversationsError } = await this.supabase
      .from('conversations')
      .select('user_id')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (conversationsError) throw conversationsError;

    // Aggregate data
    const userActivity: { [userId: string]: { 
      user: User; 
      messageCount: number; 
      conversationCount: number; 
      lastActivity: Date 
    } } = {};

    userMessages?.forEach((message: any) => {
      const userId = message.user_id;
      if (!userActivity[userId]) {
        userActivity[userId] = {
          user: {
            id: message.users.id,
            email: message.users.email,
            google_id: message.users.google_id,
            name: message.users.name,
            picture: message.users.picture,
            role: message.users.role,
            is_active: message.users.is_active,
            last_login_at: message.users.last_login_at ? new Date(message.users.last_login_at) : undefined,
            created_at: new Date(message.users.created_at),
            updated_at: new Date(message.users.updated_at),
          },
          messageCount: 0,
          conversationCount: 0,
          lastActivity: new Date(message.created_at)
        };
      }
      userActivity[userId].messageCount++;
      const messageDate = new Date(message.created_at);
      if (messageDate > userActivity[userId].lastActivity) {
        userActivity[userId].lastActivity = messageDate;
      }
    });

    userConversations?.forEach((conversation: any) => {
      const userId = conversation.user_id;
      if (userActivity[userId]) {
        userActivity[userId].conversationCount++;
      }
    });

    return Object.values(userActivity)
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, limit);
  }

  async getUserGrowthTrend(months: number = 12): Promise<{ 
    month: string; 
    newUsers: number; 
    totalUsers: number 
  }[]> {
    const result: { month: string; newUsers: number; totalUsers: number }[] = [];
    
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
      
      // Get new users for this month
      const { count: newUserCount } = await this.supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      // Get total users up to this month
      const { count: totalUserCount } = await this.supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .lte('created_at', monthEnd.toISOString());

      result.push({
        month: date.toISOString().substring(0, 7), // YYYY-MM format
        newUsers: newUserCount || 0,
        totalUsers: totalUserCount || 0
      });
    }

    return result;
  }
}