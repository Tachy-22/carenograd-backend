import { tool } from 'ai';
import { z } from 'zod';
import { formatError } from '../../types/common';
import { createClient } from '@supabase/supabase-js';

export const debugKnowledgeBaseTool = tool({
  description: 'Debug tool to see what content is actually stored in the knowledge base. Shows raw text content from all chunks.',
  inputSchema: z.object({
    limit: z.number().optional().describe('Maximum number of chunks to show (default: 5)')
  }),
  execute: async ({ limit = 5 }) => {
    try {
      // Initialize Supabase
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables required');
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Get documents info
      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (docsError) {
        throw new Error(`Failed to fetch documents: ${docsError.message}`);
      }

      // Get sample chunks with their content
      const { data: chunks, error: chunksError } = await supabase
        .from('embeddings')
        .select(`
          id,
          content,
          metadata,
          created_at,
          documents!inner(
            filename,
            title
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (chunksError) {
        throw new Error(`Failed to fetch chunks: ${chunksError.message}`);
      }

      return {
        success: true,
        summary: {
          totalDocuments: documents?.length || 0,
          totalChunks: chunks?.length || 0
        },
        documents: documents?.map(doc => ({
          id: doc.id,
          filename: doc.filename,
          title: doc.title,
          chunkCount: doc.chunk_count,
          createdAt: doc.created_at
        })) || [],
        sampleChunks: chunks?.map((chunk, index) => ({
          chunkNumber: index + 1,
          chunkId: chunk.id,
          document: (chunk.documents as any)?.filename || 'unknown',
          contentLength: chunk.content?.length || 0,
          contentPreview: chunk.content?.substring(0, 300) + (chunk.content?.length > 300 ? '...' : ''),
          wordCount: chunk.content?.split(/\s+/).length || 0,
          createdAt: chunk.created_at
        })) || [],
        debuggedAt: new Date().toISOString()
      };

    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});