import { tool } from 'ai';
import { z } from 'zod';
import { formatError } from '../../types/common';
import { createClient } from '@supabase/supabase-js';

export const listUserDocumentsTool = tool({
  description: 'List documents in the knowledge base for a specific user with pagination and filtering options. Ensures user isolation.',
  inputSchema: z.object({
    userId: z.string().describe('User ID to list documents for (ensures user isolation)'),
    filters: z.object({
      filename: z.string().optional().describe('Filter by filename (partial match)'),
      uploadStatus: z.enum(['pending', 'processing', 'completed', 'failed']).optional().describe('Filter by upload status'),
      dateFrom: z.string().optional().describe('Filter documents created after this date (ISO string)'),
      dateTo: z.string().optional().describe('Filter documents created before this date (ISO string)')
    }).optional().describe('Filtering options'),
    pagination: z.object({
      page: z.number().optional().describe('Page number (1-based, default: 1)'),
      limit: z.number().optional().describe('Number of documents per page (default: 20, max: 100)')
    }).optional().describe('Pagination options'),
    sortBy: z.enum(['created_at', 'updated_at', 'filename', 'original_name', 'size_bytes']).optional().describe('Sort field (default: created_at)'),
    sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort order (default: desc)')
  }),
  execute: async ({ userId, filters = {}, pagination = {}, sortBy = 'created_at', sortOrder = 'desc' }) => {
    try {
      // Initialize Supabase client using environment variables
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
      }

      const { page = 1, limit = 20 } = pagination;
      
      // Validate pagination parameters
      const validLimit = Math.min(Math.max(1, limit), 100);
      const validPage = Math.max(1, page);
      const offset = (validPage - 1) * validLimit;

      // Initialize Supabase client
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Build query with user isolation
      let query = supabase
        .from('documents')
        .select(`
          id,
          user_id,
          filename,
          original_name,
          mime_type,
          size_bytes,
          file_path,
          upload_status,
          processing_error,
          created_at,
          updated_at
        `)
        .eq('user_id', userId);

      // Apply filters
      if (filters.filename) {
        query = query.or(`filename.ilike.%${filters.filename}%,original_name.ilike.%${filters.filename}%`);
      }

      if (filters.uploadStatus) {
        query = query.eq('upload_status', filters.uploadStatus);
      }

      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      // Apply sorting and pagination
      query = query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + validLimit - 1);

      const { data: documents, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch documents: ${error.message}`);
      }

      // Get total count for pagination info
      let countQuery = supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Apply same filters for count
      if (filters.filename) {
        countQuery = countQuery.or(`filename.ilike.%${filters.filename}%,original_name.ilike.%${filters.filename}%`);
      }
      if (filters.uploadStatus) {
        countQuery = countQuery.eq('upload_status', filters.uploadStatus);
      }
      if (filters.dateFrom) {
        countQuery = countQuery.gte('created_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        countQuery = countQuery.lte('created_at', filters.dateTo);
      }

      const { count: totalCount } = await countQuery;
      const totalPages = Math.ceil((totalCount || 0) / validLimit);

      return {
        success: true,
        userId: userId,
        documents: (documents || []).map(doc => ({
          id: doc.id,
          userId: doc.user_id,
          filename: doc.filename,
          originalName: doc.original_name,
          mimeType: doc.mime_type,
          sizeBytes: doc.size_bytes,
          filePath: doc.file_path,
          uploadStatus: doc.upload_status,
          processingError: doc.processing_error,
          createdAt: doc.created_at,
          updatedAt: doc.updated_at
        })),
        pagination: {
          currentPage: validPage,
          totalPages: totalPages,
          totalDocuments: totalCount || 0,
          documentsPerPage: validLimit,
          hasNextPage: validPage < totalPages,
          hasPreviousPage: validPage > 1
        },
        filters: filters,
        sorting: {
          sortBy: sortBy,
          sortOrder: sortOrder
        },
        fetchedAt: new Date().toISOString()
      };
    } catch (error: unknown) {
      return {
        success: false,
        userId: userId,
        ...formatError(error)
      };
    }
  }
});

export const getUserDocumentDetailsTool = tool({
  description: 'Get detailed information about a specific document owned by a user, including its chunks and metadata.',
  inputSchema: z.object({
    userId: z.string().describe('User ID who owns the document (ensures user isolation)'),
    documentId: z.string().describe('Document ID to retrieve details for'),
    includeChunks: z.boolean().optional().describe('Whether to include document chunks (default: true)'),
    chunkLimit: z.number().optional().describe('Maximum number of chunks to return (default: 50)')
  }),
  execute: async ({ userId, documentId, includeChunks = true, chunkLimit = 50 }) => {
    try {
      // Initialize Supabase client using environment variables
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
      }

      // Initialize Supabase client
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Fetch document details with user isolation
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .eq('user_id', userId)
        .single();

      if (docError) {
        if (docError.code === 'PGRST116') {
          return {
            success: false,
            userId: userId,
            error: 'Document not found or access denied',
            errorType: 'NOT_FOUND'
          };
        }
        throw new Error(`Failed to fetch document: ${docError.message}`);
      }

      let chunks: Array<{ id: unknown; content: unknown; metadata: unknown; created_at: unknown; chunk_index: unknown }> | null = null;
      if (includeChunks) {
        const { data: chunkData, error: chunkError } = await supabase
          .from('document_chunks')
          .select(`
            id,
            content,
            chunk_index,
            metadata,
            created_at
          `)
          .eq('document_id', documentId)
          .eq('user_id', userId)
          .order('chunk_index', { ascending: true })
          .limit(chunkLimit);

        if (chunkError) {
          throw new Error(`Failed to fetch document chunks: ${chunkError.message}`);
        }

        chunks = Array.isArray(chunkData) ? chunkData : null;
      }

      return {
        success: true,
        userId: userId,
        document: {
          id: document.id,
          userId: document.user_id,
          filename: document.filename,
          originalName: document.original_name,
          mimeType: document.mime_type,
          sizeBytes: document.size_bytes,
          filePath: document.file_path,
          uploadStatus: document.upload_status,
          processingError: document.processing_error,
          createdAt: document.created_at,
          updatedAt: document.updated_at
        },
        chunks: chunks ? {
          total: chunks.length,
          data: chunks.map(chunk => {
            const content = chunk.content as string;
            return {
              id: chunk.id,
              content: content,
              chunkIndex: chunk.chunk_index,
              metadata: chunk.metadata,
              createdAt: chunk.created_at,
              preview: content.substring(0, 200) + (content.length > 200 ? '...' : '')
            };
          })
        } : null,
        fetchedAt: new Date().toISOString()
      };
    } catch (error: unknown) {
      return {
        success: false,
        userId: userId,
        ...formatError(error)
      };
    }
  }
});

export const deleteUserDocumentTool = tool({
  description: 'Delete a user-owned document and all its associated chunks from the knowledge base. Ensures user isolation.',
  inputSchema: z.object({
    userId: z.string().describe('User ID who owns the document (ensures user isolation)'),
    documentId: z.string().describe('Document ID to delete'),
    confirmDelete: z.boolean().describe('Confirmation flag to prevent accidental deletion')
  }),
  execute: async ({ userId, documentId, confirmDelete }) => {
    try {
      if (!confirmDelete) {
        return {
          success: false,
          userId: userId,
          error: 'Delete operation not confirmed. Set confirmDelete to true to proceed.',
          errorType: 'CONFIRMATION_REQUIRED'
        };
      }

      // Initialize Supabase client using environment variables
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
      }

      // Initialize Supabase client
      const supabase = createClient(supabaseUrl, supabaseKey);

      // First, get document details for the response with user isolation
      const { data: document, error: fetchError } = await supabase
        .from('documents')
        .select('filename, original_name')
        .eq('id', documentId)
        .eq('user_id', userId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          return {
            success: false,
            userId: userId,
            error: 'Document not found or access denied',
            errorType: 'NOT_FOUND'
          };
        }
        throw new Error(`Failed to fetch document for deletion: ${fetchError.message}`);
      }

      // Count chunks to be deleted
      const { count: chunkCount } = await supabase
        .from('document_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', documentId)
        .eq('user_id', userId);

      // Delete chunks first (due to foreign key constraints)
      const { error: chunksError } = await supabase
        .from('document_chunks')
        .delete()
        .eq('document_id', documentId)
        .eq('user_id', userId);

      if (chunksError) {
        throw new Error(`Failed to delete document chunks: ${chunksError.message}`);
      }

      // Then delete the document
      const { error: docError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)
        .eq('user_id', userId);

      if (docError) {
        throw new Error(`Failed to delete document: ${docError.message}`);
      }

      return {
        success: true,
        userId: userId,
        deletedDocument: {
          id: documentId,
          filename: document.filename,
          originalName: document.original_name,
          chunksDeleted: chunkCount || 0
        },
        deletedAt: new Date().toISOString()
      };
    } catch (error: unknown) {
      return {
        success: false,
        userId: userId,
        ...formatError(error)
      };
    }
  }
});