import { tool } from 'ai';
import { z } from 'zod';
import { formatError } from '../../types/common';
import { embed, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';

export const queryDocumentMultiUserTool = tool({
  description: 'Query user-specific document knowledge base with natural language. Searches only documents owned by the specified user. Provide user ID and question - automatically searches ALL user documents by default.',
  inputSchema: z.object({
    userId: z.string().describe('User ID to search documents for (ensures user isolation)'),
    query: z.string().describe('User question or search query'),
    documentIds: z.array(z.string()).optional().describe('Filter to specific document IDs (optional - searches all user documents by default)'),
    options: z.object({
      limit: z.number().optional().describe('Maximum number of relevant chunks to return (default: 5)'),
      threshold: z.number().optional().describe('Minimum similarity threshold 0-1 (default: 0.7)'),
      generateResponse: z.boolean().optional().describe('Whether to generate AI response from found content (default: true)'),
      responseStyle: z.enum(['concise', 'detailed', 'academic', 'conversational']).optional().describe('Style of AI response (default: detailed)'),
      includeCitations: z.boolean().optional().describe('Include source citations in response (default: true)'),
      embeddingModel: z.enum(['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002']).optional().describe('Model for query embedding (default: text-embedding-3-small)')
    }).optional().describe('Search and response options')
  }),
  execute: async ({ userId, query, documentIds, options = {} }) => {
    console.log(`[queryDocumentMultiUserTool] Called with userId: ${userId}, query: ${query}`);
    try {
      const {
        limit = 5,
        threshold = 0.25, // Lower threshold for better matches
        generateResponse = true,
        responseStyle = 'detailed',
        includeCitations = true,
        embeddingModel = 'text-embedding-3-small'
      } = options;

      // Step 1: Generate embedding for the query
      const embeddingModelToUse = openai.embedding(embeddingModel);
      const result = await embed({
        model: embeddingModelToUse,
        value: query
      });
      const queryEmbedding = result.embedding;

      // Step 2: Initialize Supabase
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables required');
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Step 3: Search for similar chunks (user-specific)
      let chunks, searchError;
      
      try {
        // Try using the RPC function first
        console.log(`[queryDocumentMultiUserTool] Calling RPC with threshold: ${threshold}, limit: ${limit}`);
        
        const rpcQuery = supabase.rpc('match_user_document_chunks', {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: limit,
          user_id_filter: userId
        });

        const rpcResult = await rpcQuery;
        chunks = rpcResult.data;
        searchError = rpcResult.error;
        console.log(`[queryDocumentMultiUserTool] RPC result: ${chunks?.length || 0} chunks found, error:`, searchError);
      } catch (error) {
        // If RPC function doesn't exist, fall back to direct table query
        console.log(`[queryDocumentMultiUserTool] RPC function not found, falling back to table query:`, error.message);
        
        const { data: allChunks, error: tableError } = await supabase
          .from('document_chunks')
          .select(`
            id,
            document_id,
            content,
            metadata,
            embedding
          `)
          .eq('user_id', userId)
          .limit(limit);
        
        console.log(`[queryDocumentMultiUserTool] Table query result: ${allChunks?.length || 0} total chunks, error:`, tableError);
        
        if (tableError) {
          throw new Error(`Failed to search document chunks: ${tableError.message}`);
        }
        
        // Simple text-based search as fallback (not optimal but works)
        chunks = allChunks?.filter(chunk => 
          chunk.content.toLowerCase().includes(query.toLowerCase())
        ).map(chunk => ({
          id: chunk.id,
          document_id: chunk.document_id,
          content: chunk.content,
          metadata: chunk.metadata,
          similarity: 0.8 // Default similarity score for text search
        })) || [];
        
        console.log(`[queryDocumentMultiUserTool] Text search filtered to: ${chunks.length} matching chunks`);
        searchError = null;
      }

      if (searchError) {
        throw new Error(`Failed to search documents: ${searchError.message}`);
      }

      if (!chunks || chunks.length === 0) {
        return {
          success: true,
          query: query,
          userId: userId,
          results: {
            chunks: [],
            count: 0,
            searchThreshold: threshold
          },
          response: generateResponse ? 
            "I couldn't find any relevant information in your uploaded documents to answer that question. You might want to upload documents related to this topic or try rephrasing your question." : 
            null,
          message: "No relevant content found in your document knowledge base.",
          searchedAt: new Date().toISOString()
        };
      }

      // Filter by documentIds if specified
      let filteredChunks = chunks;
      if (documentIds && documentIds.length > 0) {
        filteredChunks = chunks.filter((chunk: any) => 
          documentIds.includes(chunk.document_id)
        );
      }

      // Step 4: Get document metadata for citations
      const documentIdsToFetch = [...new Set(filteredChunks.map((chunk: any) => chunk.document_id))];
      let documentMetadata: any[] = [];

      if (documentIdsToFetch.length > 0) {
        const { data: docs, error: docsError } = await supabase
          .from('documents')
          .select('id, filename, original_name, created_at')
          .in('id', documentIdsToFetch)
          .eq('user_id', userId);

        if (docsError) {
          console.warn('Failed to fetch document metadata:', docsError.message);
        } else {
          documentMetadata = docs || [];
        }
      }

      // Step 5: Generate AI response if requested
      let aiResponse: string | null = null;
      if (generateResponse && filteredChunks.length > 0) {
        const context = filteredChunks
          .map((chunk: any, index: number) => 
            `[Source ${index + 1}]: ${chunk.content}`
          )
          .join('\n\n');

        const responsePrompt = getResponsePrompt(query, context, responseStyle, includeCitations);

        try {
          const { text } = await generateText({
            model: openai('gpt-4o'),
            prompt: responsePrompt,
          });
          aiResponse = text;
        } catch (genError) {
          console.warn('Failed to generate AI response:', genError);
          aiResponse = "I found relevant information but couldn't generate a response. Please refer to the source chunks below.";
        }
      }

      // Step 6: Format results
      const results = {
        chunks: filteredChunks.map((chunk: any, index: number) => {
          const doc = documentMetadata.find(d => d.id === chunk.document_id);
          return {
            id: chunk.id,
            content: chunk.content,
            similarity: chunk.similarity || 0,
            metadata: chunk.metadata || {},
            source: {
              documentId: chunk.document_id,
              documentName: doc?.original_name || doc?.filename || 'Unknown Document',
              sourceIndex: index + 1
            }
          };
        }),
        count: filteredChunks.length,
        searchThreshold: threshold,
        documentsSearched: documentMetadata.length
      };

      return {
        success: true,
        query: query,
        userId: userId,
        results: results,
        response: aiResponse,
        searchParameters: {
          limit: limit,
          threshold: threshold,
          embeddingModel: embeddingModel,
          responseStyle: responseStyle,
          includeCitations: includeCitations,
          documentFilter: documentIds || null
        },
        message: `Found ${results.count} relevant chunks from ${results.documentsSearched} documents.`,
        searchedAt: new Date().toISOString()
      };

    } catch (error: unknown) {
      return {
        success: false,
        query: query,
        userId: userId,
        ...formatError(error)
      };
    }
  }
});

function getResponsePrompt(query: string, context: string, style: string, includeCitations: boolean): string {
  const styleInstructions = {
    concise: "Provide a brief, to-the-point answer.",
    detailed: "Provide a comprehensive, well-structured answer with explanations.",
    academic: "Use formal, academic language with proper analysis and reasoning.",
    conversational: "Use a friendly, conversational tone as if explaining to a colleague."
  };

  const citationInstructions = includeCitations ? 
    "\n\nIMPORTANT: When referencing information, cite the sources using [Source X] format where X is the source number." :
    "\n\nDo not include source citations in your response.";

  return `Based on the following context from the user's documents, answer their question.

QUESTION: ${query}

CONTEXT:
${context}

INSTRUCTIONS:
- ${styleInstructions[style as keyof typeof styleInstructions]}
- Only use information from the provided context
- If the context doesn't contain enough information to fully answer the question, say so
- Be accurate and don't make assumptions beyond what's stated in the context${citationInstructions}

ANSWER:`;
}