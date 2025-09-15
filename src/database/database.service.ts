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

  async getConversationMessages(conversationId: string, userId: string): Promise<Message[]> {
    const { data, error } = await this.supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
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
}