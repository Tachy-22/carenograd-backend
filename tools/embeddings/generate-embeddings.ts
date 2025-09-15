import { tool } from 'ai';
import { z } from 'zod';
import { formatError } from '../../types/common';
import { embedMany, embed } from 'ai';
import { openai } from '@ai-sdk/openai';


export const generateEmbeddingsTool = tool({
  description: 'STEP 4 of RAG workflow: Generate embeddings for text chunks using OpenAI embedding models. Requires chunks from chunkDocument. After this, you MUST call storeEmbeddings to complete the workflow.',
  inputSchema: z.object({
    chunks: z.array(z.object({
      id: z.string().describe('Unique identifier for the chunk'),
      content: z.string().describe('Text content to embed'),
      metadata: z.record(z.unknown()).optional().describe('Additional metadata for the chunk')
    })).describe('Array of text chunks to generate embeddings for'),
    model: z.enum(['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002']).optional().describe('Embedding model to use'),
    dimensions: z.number().optional().describe('Number of dimensions for embeddings (only for text-embedding-3 models)'),
    batchSize: z.number().optional().describe('Number of chunks to process in each batch (default: 100)')
  }),
  execute: async ({ chunks, model = 'text-embedding-3-small', batchSize = 100 }) => {
    try {
      // Configure embedding model
      const embeddingModelToUse = openai.embedding(model);

      const results: Array<{
        id: string;
        content: string;
        embedding: number[];
        metadata: Record<string, unknown>;
      }> = [];
      const errors: Array<{
        chunkId: string;
        error: string;
      }> = [];

      // Process chunks in batches
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        
        try {
          // Extract text content for embedding
          const texts = batch.map(chunk => chunk.content);
          
          // Generate embeddings for the batch
          const { embeddings } = await embedMany({
            model: embeddingModelToUse,
            values: texts
          });

          // Combine embeddings with chunk data
          for (let j = 0; j < batch.length; j++) {
            const embeddingResult = embeddings[j] as unknown as { values: number[] };
            const embeddingVector = embeddingResult.values || [];
            results.push({
              id: batch[j].id,
              content: batch[j].content,
              embedding: embeddingVector,
              metadata: {
                ...batch[j].metadata,
                embeddingModel: model,
                dimensions: embeddingVector.length,
                embeddedAt: new Date().toISOString()
              }
            });
          }
        } catch (batchError: unknown) {
          // Handle batch errors
          const err = batchError as Error;
          for (const chunk of batch) {
            errors.push({
              chunkId: chunk.id,
              error: err.message || 'Unknown error during embedding generation'
            });
          }
        }
      }

      return {
        success: true,
        embeddings: results,
        summary: {
          totalChunks: chunks.length,
          successfulEmbeddings: results.length,
          failedEmbeddings: errors.length,
          model: model,
          dimensions: results.length > 0 ? results[0].embedding.length : null,
          batchSize: batchSize
        },
        errors: errors.length > 0 ? errors : undefined,
        processedAt: new Date().toISOString()
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const generateSingleEmbeddingTool = tool({
  description: 'Generate a single embedding for a text query. Useful for search queries.',
  inputSchema: z.object({
    text: z.string().describe('Text to generate embedding for'),
    model: z.enum(['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002']).optional().describe('Embedding model to use'),
    dimensions: z.number().optional().describe('Number of dimensions for embeddings (only for text-embedding-3 models)')
  }),
  execute: async ({ text, model = 'text-embedding-3-small' }) => {
    try {
      // Configure embedding model
      const embeddingModelToUse = openai.embedding(model);

      // Generate single embedding
      const { embedding } = await embed({
        model: embeddingModelToUse,
        value: text
      });

      const embeddingResult = embedding as unknown as { values: number[] };
      const embeddingVector = embeddingResult.values || [];
      
      return {
        success: true,
        embedding: embeddingVector,
        metadata: {
          text: text,
          model: model,
          dimensions: embeddingVector.length,
          embeddedAt: new Date().toISOString()
        }
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});