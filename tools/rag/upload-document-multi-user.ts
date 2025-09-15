import { tool } from 'ai';
import { z } from 'zod';
import { formatError } from '../../types/common';
import * as fs from 'fs';
import * as path from 'path';
import pdfParse from 'pdf-parse';
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';
import * as pako from 'pako';

export const uploadDocumentMultiUserTool = tool({
  description: 'Complete document upload and processing for multi-user system. Takes a PDF file (raw, base64, or compressed base64) and fully processes it: validates, extracts text, chunks content, generates embeddings, and stores everything in Supabase with user isolation. Supports pako compression for large files. Returns ready-to-query document.',
  inputSchema: z.object({
    userId: z.string().describe('User ID for document ownership and isolation'),
    filePath: z.string().optional().describe('Path to PDF file on local filesystem'),
    fileBuffer: z.string().optional().describe('Base64 encoded PDF file buffer'),
    compressedBuffer: z.string().optional().describe('Compressed base64 encoded PDF file buffer (using pako)'),
    filename: z.string().optional().describe('Original filename (auto-detected from filePath if not provided)'),
    metadata: z.object({
      title: z.string().optional(),
      author: z.string().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional()
    }).optional().describe('Document metadata'),
    options: z.object({
      chunkStrategy: z.enum(['sentence', 'paragraph', 'fixed_size']).optional().describe('Text chunking strategy (default: paragraph)'),
      chunkSize: z.number().optional().describe('Max characters per chunk for fixed_size (default: 1000)'),
      overlap: z.number().optional().describe('Character overlap between chunks (default: 100)'),
      embeddingModel: z.enum(['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002']).optional().describe('OpenAI embedding model (default: text-embedding-3-small)')
    }).optional().describe('Processing options')
  }).refine(
    (data) => data.filePath || data.fileBuffer || data.compressedBuffer,
    { message: "Either filePath, fileBuffer, or compressedBuffer must be provided" }
  ),
  execute: async ({ userId, filePath, fileBuffer, compressedBuffer, filename, metadata = {}, options = {} }) => {
    try {
      const {
        chunkStrategy = 'paragraph',
        chunkSize = 1000,
        overlap = 100,
        embeddingModel = 'text-embedding-3-small'
      } = options;

      // Step 1: Read and validate PDF
      let buffer: Buffer;
      let actualFilename: string;

      if (filePath) {
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }
        if (!fs.statSync(filePath).isFile()) {
          throw new Error(`Path is not a file: ${filePath}`);
        }
        if (!path.extname(filePath).toLowerCase().endsWith('.pdf')) {
          throw new Error('Only PDF files are supported');
        }
        buffer = fs.readFileSync(filePath);
        actualFilename = filename || path.basename(filePath);
      } else if (compressedBuffer) {
        // Decompress the compressed base64 data
        try {
          // First decode from base64 to get compressed bytes
          const compressedBytes = Buffer.from(compressedBuffer, 'base64');
          // Then decompress using pako
          const decompressedBase64 = pako.inflate(compressedBytes, { to: 'string' });
          // Finally convert the decompressed base64 to buffer
          buffer = Buffer.from(decompressedBase64, 'base64');
          actualFilename = filename || 'uploaded_document.pdf';
        } catch (error) {
          throw new Error(`Failed to decompress file data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else if (fileBuffer) {
        buffer = Buffer.from(fileBuffer, 'base64');
        actualFilename = filename || 'uploaded_document.pdf';
      } else {
        throw new Error('Either filePath, fileBuffer, or compressedBuffer must be provided');
      }

      // Validate PDF format
      if (buffer.subarray(0, 4).toString() !== '%PDF') {
        throw new Error('Invalid PDF file format');
      }

      // Step 2: Extract text from PDF
      const pdfData = await pdfParse(buffer);
      const fullText = pdfData.text.replace(/\s+/g, ' ').trim();
      
      if (!fullText || fullText.length < 10) {
        throw new Error('No readable text found in PDF');
      }

      // Step 3: Chunk the text
      const chunks = chunkText(fullText, chunkStrategy, chunkSize, overlap);
      
      if (chunks.length === 0) {
        throw new Error('No text chunks generated from document');
      }

      // Step 4: Generate embeddings
      const chunkContents = chunks.map(chunk => chunk.content);
      const embeddingModelToUse = openai.embedding(embeddingModel);
      
      const { embeddings } = await embedMany({
        model: embeddingModelToUse,
        values: chunkContents
      });

      // Step 5: Prepare data for Supabase
      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const now = new Date().toISOString();

      // Initialize Supabase
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables required');
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Step 6: Store document metadata (updated schema)
      const { error: docError } = await supabase
        .from('documents')
        .insert({
          id: documentId,
          user_id: userId,
          filename: actualFilename,
          original_name: actualFilename,
          mime_type: 'application/pdf',
          size_bytes: buffer.length,
          file_path: filePath || 'uploaded_buffer',
          upload_status: 'processing',
          created_at: now,
          updated_at: now
        });

      if (docError) {
        throw new Error(`Failed to store document: ${docError.message}`);
      }

      // Step 7: Store document chunks (updated schema)
      const chunkData = chunks.map((chunk, index) => ({
        id: chunk.id,
        document_id: documentId,
        user_id: userId,
        content: chunk.content,
        chunk_index: index,
        embedding: embeddings[index],
        metadata: {
          chunkIndex: index,
          chunkStrategy: chunkStrategy,
          wordCount: chunk.content.split(/\s+/).length,
          pageCount: pdfData.numpages,
          title: metadata.title || actualFilename.replace('.pdf', ''),
          author: metadata.author,
          category: metadata.category,
          tags: metadata.tags || []
        },
        created_at: now
      }));

      // Insert in batches to avoid size limits
      const batchSize = 100;
      let insertedCount = 0;
      
      for (let i = 0; i < chunkData.length; i += batchSize) {
        const batch = chunkData.slice(i, i + batchSize);
        const { error: chunkError } = await supabase
          .from('document_chunks')
          .insert(batch);
        
        if (chunkError) {
          throw new Error(`Failed to store document chunks batch ${i}-${i + batch.length}: ${chunkError.message}`);
        }
        insertedCount += batch.length;
      }

      // Step 8: Update document status to completed
      await supabase
        .from('documents')
        .update({ 
          upload_status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId)
        .eq('user_id', userId);

      return {
        success: true,
        document: {
          id: documentId,
          userId: userId,
          filename: actualFilename,
          originalName: actualFilename,
          mimeType: 'application/pdf',
          sizeBytes: buffer.length,
          uploadStatus: 'completed',
          chunkCount: chunks.length,
          embeddingsStored: insertedCount
        },
        processing: {
          textLength: fullText.length,
          chunksGenerated: chunks.length,
          embeddingsCreated: embeddings.length,
          chunkStrategy: chunkStrategy,
          embeddingModel: embeddingModel,
          pageCount: pdfData.numpages
        },
        message: `Document '${actualFilename}' successfully processed and stored for user ${userId}. Ready for querying with ${insertedCount} searchable chunks.`,
        readyForQuerying: true,
        processedAt: now
      };

    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

// Helper function to chunk text
function chunkText(text: string, strategy: string, maxSize: number, overlap: number): Array<{id: string, content: string}> {
  const chunks: Array<{id: string, content: string}> = [];
  
  switch (strategy) {
    case 'sentence':
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
      sentences.forEach((sentence, index) => {
        const trimmed = sentence.trim();
        if (trimmed) {
          chunks.push({
            id: `chunk_${index}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            content: trimmed
          });
        }
      });
      break;
      
    case 'paragraph':
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 20);
      paragraphs.forEach((paragraph, index) => {
        const trimmed = paragraph.trim().replace(/\s+/g, ' ');
        if (trimmed) {
          chunks.push({
            id: `chunk_${index}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            content: trimmed
          });
        }
      });
      break;
      
    case 'fixed_size':
    default:
      for (let i = 0; i < text.length; i += maxSize - overlap) {
        const chunk = text.substring(i, i + maxSize).trim();
        if (chunk) {
          chunks.push({
            id: `chunk_${chunks.length}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            content: chunk
          });
        }
      }
      break;
  }
  
  return chunks.filter(chunk => chunk.content.length > 10);
}