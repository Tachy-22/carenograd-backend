import { tool } from 'ai';
import { z } from 'zod';
import { formatError } from '../../types/common';
import { createClient } from '@supabase/supabase-js';

export const storeEmbeddingsTool = tool({
  description: 'STEP 5 (FINAL) of RAG workflow: Store document embeddings in Supabase with pgvector support. Requires embeddings from generateEmbeddings. This completes the RAG setup and enables querying.',
  inputSchema: z.object({
    embeddings: z.array(z.object({
      id: z.string().describe('Unique identifier for the chunk'),
      content: z.string().describe('Text content'),
      embedding: z.array(z.number()).describe('Embedding vector'),
      metadata: z.record(z.unknown()).optional().describe('Additional metadata')
    })).describe('Array of embeddings to store'),
    documentMetadata: z.object({
      documentId: z.string().describe('Unique document identifier'),
      filename: z.string().describe('Original filename'),
      title: z.string().optional().describe('Document title'),
      author: z.string().optional().describe('Document author'),
      category: z.string().optional().describe('Document category'),
      tags: z.array(z.string()).optional().describe('Document tags'),
      fileSize: z.number().optional().describe('File size in bytes'),
      pageCount: z.number().optional().describe('Number of pages')
    }).describe('Document metadata'),
    supabaseOptions: z.object({
      documentsTable: z.string().optional().describe('Documents table name (default: documents)'),
      embeddingsTable: z.string().optional().describe('Embeddings table name (default: embeddings)')
    }).optional().describe('Supabase table configuration')
  }),
  execute: async ({ embeddings, documentMetadata, supabaseOptions = {} }) => {
    try {
      const { 
        documentsTable = 'documents', 
        embeddingsTable = 'embeddings' 
      } = supabaseOptions;

      // Initialize Supabase client using environment variables
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // First, store the document metadata
      const { data: document, error: docError } = await supabase
        .from(documentsTable)
        .upsert({
          id: documentMetadata.documentId,
          filename: documentMetadata.filename,
          title: documentMetadata.title,
          author: documentMetadata.author,
          category: documentMetadata.category,
          tags: documentMetadata.tags,
          file_size: documentMetadata.fileSize,
          page_count: documentMetadata.pageCount,
          chunk_count: embeddings.length,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (docError) {
        throw new Error(`Failed to store document metadata: ${docError.message}`);
      }

      // Prepare embedding data for insertion
      const embeddingData = embeddings.map(item => ({
        id: item.id,
        document_id: documentMetadata.documentId,
        content: item.content,
        embedding: item.embedding,
        metadata: item.metadata || {},
        created_at: new Date().toISOString()
      }));

      // Store embeddings in batches (Supabase has a limit on batch size)
      const batchSize = 100;
      const insertedEmbeddings: Array<{ id: string; document_id: string; created_at: string }> = [];
      const errors: Array<{ batchStart: number; batchEnd: number; error: string }> = [];

      for (let i = 0; i < embeddingData.length; i += batchSize) {
        const batch = embeddingData.slice(i, i + batchSize);
        
        const { data: batchData, error: batchError } = await supabase
          .from(embeddingsTable)
          .insert(batch)
          .select('id, document_id, created_at');

        if (batchError) {
          errors.push({
            batchStart: i,
            batchEnd: Math.min(i + batchSize, embeddingData.length),
            error: batchError.message
          });
        } else {
          insertedEmbeddings.push(...(batchData || []));
        }
      }

      // Update document with final statistics
      await supabase
        .from(documentsTable)
        .update({
          chunk_count: insertedEmbeddings.length,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentMetadata.documentId);

      return {
        success: true,
        document: {
          id: document.id,
          filename: document.filename,
          title: document.title,
          createdAt: document.created_at
        },
        embeddings: {
          totalStored: insertedEmbeddings.length,
          totalFailed: embeddingData.length - insertedEmbeddings.length,
          batchSize: batchSize,
          embeddingDimensions: embeddings.length > 0 ? embeddings[0].embedding.length : 0
        },
        errors: errors.length > 0 ? errors : undefined,
        storedAt: new Date().toISOString()
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const createTablesIfNotExistTool = tool({
  description: 'Create necessary tables (documents and embeddings) in Supabase if they do not exist. Includes pgvector setup.',
  inputSchema: z.object({
    options: z.object({
      embeddingDimensions: z.number().optional().describe('Embedding vector dimensions (default: 1536)')
    }).optional().describe('Table creation options')
  }),
  execute: async ({ options = {} }) => {
    try {
      const { embeddingDimensions = 1536 } = options;

      // Initialize Supabase client using environment variables (service role key needed for schema changes)
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required');
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // SQL statements to create tables and enable pgvector
      const createExtensionSQL = `CREATE EXTENSION IF NOT EXISTS vector;`;
      
      const createDocumentsTableSQL = `
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          filename TEXT NOT NULL,
          title TEXT,
          author TEXT,
          category TEXT,
          tags TEXT[],
          file_size INTEGER,
          page_count INTEGER,
          chunk_count INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      const createEmbeddingsTableSQL = `
        CREATE TABLE IF NOT EXISTS embeddings (
          id TEXT PRIMARY KEY,
          document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          embedding vector(${embeddingDimensions}) NOT NULL,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      const createIndexSQL = `
        CREATE INDEX IF NOT EXISTS embeddings_embedding_idx 
        ON embeddings USING hnsw (embedding vector_cosine_ops);
      `;

      const createDocumentIndexSQL = `
        CREATE INDEX IF NOT EXISTS embeddings_document_id_idx 
        ON embeddings(document_id);
      `;

      // Execute SQL statements
      const { error: extError } = await supabase.rpc('exec_sql', { sql: createExtensionSQL });
      if (extError) throw new Error(`Failed to create vector extension: ${extError.message}`);

      const { error: docTableError } = await supabase.rpc('exec_sql', { sql: createDocumentsTableSQL });
      if (docTableError) throw new Error(`Failed to create documents table: ${docTableError.message}`);

      const { error: embTableError } = await supabase.rpc('exec_sql', { sql: createEmbeddingsTableSQL });
      if (embTableError) throw new Error(`Failed to create embeddings table: ${embTableError.message}`);

      const { error: indexError } = await supabase.rpc('exec_sql', { sql: createIndexSQL });
      if (indexError) throw new Error(`Failed to create embedding index: ${indexError.message}`);

      const { error: docIndexError } = await supabase.rpc('exec_sql', { sql: createDocumentIndexSQL });
      if (docIndexError) throw new Error(`Failed to create document index: ${docIndexError.message}`);

      return {
        success: true,
        tablesCreated: {
          documents: true,
          embeddings: true,
          vectorExtension: true
        },
        indexes: {
          embeddingVectorIndex: true,
          documentIdIndex: true
        },
        embeddingDimensions: embeddingDimensions,
        createdAt: new Date().toISOString()
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});