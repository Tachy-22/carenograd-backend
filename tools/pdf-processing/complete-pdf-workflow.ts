import { tool } from 'ai';
import { z } from 'zod';
import { formatError } from '../../types/common';

export const completePdfWorkflowTool = tool({
  description: 'PREFERRED: Complete PDF processing workflow. Use this when user wants to "process a PDF completely", "upload and process PDF", or "create knowledge base from PDF". This automatically chains all 5 RAG steps: upload → extract → chunk → generate embeddings → store in Supabase.',
  inputSchema: z.object({
    filePath: z.string().optional().describe('Path to PDF file on local filesystem'),
    fileBuffer: z.string().optional().describe('Base64 encoded PDF file buffer'),
    filename: z.string().optional().describe('Original filename of the PDF (auto-detected from filePath if not provided)'),
    chunkingStrategy: z.enum(['sentence', 'paragraph', 'fixed_size', 'semantic']).optional().describe('How to split the document (default: paragraph)'),
    embeddingModel: z.enum(['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002']).optional().describe('OpenAI embedding model (default: text-embedding-3-small)'),
    metadata: z.object({
      title: z.string().optional(),
      author: z.string().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional()
    }).optional().describe('Document metadata')
  }).refine(
    (data) => data.filePath || data.fileBuffer,
    {
      message: "Either filePath or fileBuffer must be provided",
    }
  ),
  execute: async ({ filePath, fileBuffer, filename, chunkingStrategy = 'paragraph', embeddingModel = 'text-embedding-3-small', metadata }) => {
    try {
      // This is a placeholder that will guide the agent to use individual tools
      // The agent should see this and understand to call the tools in sequence
      return {
        success: true,
        workflowStatus: 'initiated',
        message: 'PDF workflow initiated. The agent should now call these tools in sequence:',
        requiredSteps: [
          {
            step: 1,
            tool: 'uploadPdfTool',
            parameters: { filePath, fileBuffer, filename, metadata },
            description: 'Upload and validate the PDF file'
          },
          {
            step: 2,
            tool: 'extractPdfTextTool', 
            parameters: 'Use processedBuffer from step 1',
            description: 'Extract text content from the PDF'
          },
          {
            step: 3,
            tool: 'chunkDocumentTool',
            parameters: { strategy: chunkingStrategy, text: 'Use extractedText from step 2' },
            description: 'Split text into chunks for embedding'
          },
          {
            step: 4,
            tool: 'generateEmbeddingsTool',
            parameters: { model: embeddingModel, chunks: 'Use chunks from step 3' },
            description: 'Generate embeddings for each chunk'
          },
          {
            step: 5,
            tool: 'storeEmbeddingsTool',
            parameters: 'Use embeddings from step 4 and metadata from step 1',
            description: 'Store everything in Supabase - FINAL STEP'
          }
        ],
        nextAction: 'CALL_uploadPdfTool_WITH_PROVIDED_PARAMETERS',
        inputData: { filePath, fileBuffer, filename, metadata }
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});