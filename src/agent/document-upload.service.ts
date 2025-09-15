import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import pdfParse from 'pdf-parse';
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';

export interface DocumentUploadOptions {
  userId: string;
  fileBuffer: Buffer;
  filename: string;
  metadata?: {
    title?: string;
    author?: string;
    category?: string;
    tags?: string[];
  };
  options?: {
    chunkStrategy?: 'sentence' | 'paragraph' | 'fixed_size';
    chunkSize?: number;
    overlap?: number;
    embeddingModel?: 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002';
  };
}

export interface DocumentUploadResult {
  success: boolean;
  document?: {
    id: string;
    userId: string;
    filename: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    uploadStatus: string;
    chunkCount: number;
    embeddingsStored: number;
  };
  processing?: {
    textLength: number;
    chunksGenerated: number;
    embeddingsCreated: number;
    chunkStrategy: string;
    embeddingModel: string;
    pageCount: number;
  };
  message?: string;
  error?: string;
  errorType?: string;
  processingTimeMs?: number;
}

@Injectable()
export class DocumentUploadService {
  private readonly logger = new Logger(DocumentUploadService.name);

  /**
   * Process a document upload independently of the chat agent
   * Handles PDF processing, text extraction, chunking, and embedding generation
   */
  async processDocument(options: DocumentUploadOptions): Promise<DocumentUploadResult> {
    const startTime = Date.now();
    const { userId, fileBuffer, filename, metadata = {}, options: processingOptions = {} } = options;

    this.logger.log(`📁 Starting document processing: ${filename} for user ${userId}`);
    this.logger.log(`📊 File size: ${(fileBuffer.length / 1024 / 1024).toFixed(1)} MB`);

    try {
      // Set default processing options
      const {
        chunkStrategy = 'paragraph',
        chunkSize = 1000,
        overlap = 100,
        embeddingModel = 'text-embedding-3-small'
      } = processingOptions;

      // Validate PDF format
      if (fileBuffer.subarray(0, 4).toString() !== '%PDF') {
        throw new Error('Invalid PDF file format');
      }

      // Step 1: Extract text from PDF
      this.logger.log('📄 Extracting text from PDF...');
      const pdfData = await pdfParse(fileBuffer);
      const fullText = pdfData.text.replace(/\s+/g, ' ').trim();
      
      if (!fullText || fullText.length < 10) {
        throw new Error('No readable text found in PDF');
      }
      this.logger.log(`✅ Text extracted: ${fullText.length} characters`);

      // Step 2: Chunk the text
      this.logger.log('🔪 Chunking text...');
      const chunks = this.chunkText(fullText, chunkStrategy, chunkSize, overlap);
      
      if (chunks.length === 0) {
        throw new Error('No text chunks generated from document');
      }
      this.logger.log(`✅ Text chunked into ${chunks.length} pieces`);

      // Step 3: Generate embeddings
      this.logger.log('🧠 Generating embeddings...');
      const chunkContents = chunks.map(chunk => chunk.content);
      const embeddingModelToUse = openai.embedding(embeddingModel);
      
      const { embeddings } = await embedMany({
        model: embeddingModelToUse,
        values: chunkContents
      });
      this.logger.log(`✅ Generated ${embeddings.length} embeddings`);

      // Step 4: Store in Supabase
      this.logger.log('💾 Storing in database...');
      const documentId = randomUUID(); // Use proper UUID format
      const now = new Date().toISOString();

      // Initialize Supabase
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables required');
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Store document metadata
      const { error: docError } = await supabase
        .from('documents')
        .insert({
          id: documentId,
          user_id: userId,
          filename: filename,
          original_name: filename,
          mime_type: 'application/pdf',
          size_bytes: fileBuffer.length,
          file_path: 'uploaded_buffer',
          upload_status: 'processing',
          created_at: now,
          updated_at: now
        });

      if (docError) {
        throw new Error(`Failed to store document: ${docError.message}`);
      }

      // Store document chunks
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
          title: metadata.title || filename.replace('.pdf', ''),
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

      // Update document status to completed
      await supabase
        .from('documents')
        .update({ 
          upload_status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId)
        .eq('user_id', userId);

      const processingTime = Date.now() - startTime;
      this.logger.log(`✅ Document processing completed in ${processingTime}ms`);

      return {
        success: true,
        document: {
          id: documentId,
          userId: userId,
          filename: filename,
          originalName: filename,
          mimeType: 'application/pdf',
          sizeBytes: fileBuffer.length,
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
        message: `Document '${filename}' successfully processed and stored for user ${userId}. Ready for querying with ${insertedCount} searchable chunks.`,
        processingTimeMs: processingTime,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`❌ Document processing error after ${processingTime}ms:`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown processing error',
        errorType: 'PROCESSING_ERROR',
        processingTimeMs: processingTime,
      };
    }
  }

  /**
   * Helper function to chunk text
   */
  private chunkText(text: string, strategy: string, maxSize: number, overlap: number): Array<{id: string, content: string}> {
    const chunks: Array<{id: string, content: string}> = [];
    
    switch (strategy) {
      case 'sentence':
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
        sentences.forEach((sentence, index) => {
          const trimmed = sentence.trim();
          if (trimmed) {
            chunks.push({
              id: randomUUID(),
              content: trimmed
            });
          }
        });
        break;
        
      case 'paragraph':
        // Try multiple splitting strategies for better chunking
        let paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 20);
        
        // If we get too few paragraphs, try splitting by single newlines
        if (paragraphs.length < 3) {
          paragraphs = text.split(/\n+/).filter(p => p.trim().length > 50);
        }
        
        // If still too few, use fixed size chunking as fallback
        if (paragraphs.length < 2) {
          for (let i = 0; i < text.length; i += 800) {
            const chunk = text.substring(i, i + 1000).trim();
            if (chunk && chunk.length > 20) {
              chunks.push({
                id: randomUUID(),
                content: chunk
              });
            }
          }
        } else {
          paragraphs.forEach((paragraph) => {
            const trimmed = paragraph.trim().replace(/\s+/g, ' ');
            if (trimmed) {
              chunks.push({
                id: randomUUID(),
                content: trimmed
              });
            }
          });
        }
        break;
        
      case 'fixed_size':
      default:
        for (let i = 0; i < text.length; i += maxSize - overlap) {
          const chunk = text.substring(i, i + maxSize).trim();
          if (chunk) {
            chunks.push({
              id: randomUUID(),
              content: chunk
            });
          }
        }
        break;
    }
    
    return chunks.filter(chunk => chunk.content.length > 10);
  }

  /**
   * Process document asynchronously without blocking the response
   * Useful for fire-and-forget document processing
   */
  async processDocumentAsync(options: DocumentUploadOptions): Promise<void> {
    // Process in background without awaiting
    this.processDocument(options)
      .then(result => {
        if (result.success) {
          this.logger.log(`🎉 Background processing completed: ${options.filename}`);
        } else {
          this.logger.error(`💥 Background processing failed: ${options.filename} - ${result.error}`);
        }
      })
      .catch(error => {
        this.logger.error(`💥 Background processing error: ${options.filename}`, error);
      });
  }

  /**
   * Validate file before processing
   */
  validateFile(file: Express.Multer.File): { valid: boolean; error?: string } {
    if (!file) {
      return { valid: false, error: 'No file provided' };
    }

    if (file.mimetype !== 'application/pdf') {
      return { valid: false, error: 'Only PDF files are supported' };
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return { valid: false, error: 'File too large. Maximum size is 50MB' };
    }

    if (file.size < 100) {
      return { valid: false, error: 'File too small. Minimum size is 100 bytes' };
    }

    return { valid: true };
  }
}