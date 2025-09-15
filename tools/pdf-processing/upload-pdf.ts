import { tool } from 'ai';
import { z } from 'zod';
import { formatError } from '../../types/common';
import * as fs from 'fs';
import * as path from 'path';

export const uploadPdfTool = tool({
  description: 'STEP 1 of RAG workflow: Upload and validate a PDF document. This only validates the PDF - you MUST follow with extractText, chunkDocument, generateEmbeddings, and storeEmbeddings to complete the RAG workflow. Accepts either a file path or base64 content.',
  inputSchema: z.object({
    filePath: z.string().optional().describe('Path to PDF file on local filesystem'),
    fileBuffer: z.string().optional().describe('Base64 encoded PDF file buffer'),
    filename: z.string().optional().describe('Original filename of the PDF (auto-detected from filePath if not provided)'),
    mimeType: z.string().optional().describe('MIME type of the file (should be application/pdf)'),
    maxSizeBytes: z.number().optional().describe('Maximum allowed file size in bytes (default: 10MB)'),
    metadata: z.object({
      title: z.string().optional(),
      author: z.string().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional()
    }).optional().describe('Additional metadata for the document')
  }).refine(
    (data) => data.filePath || data.fileBuffer,
    {
      message: "Either filePath or fileBuffer must be provided",
    }
  ),
  execute: async ({ filePath, fileBuffer, filename, mimeType = 'application/pdf', maxSizeBytes = 10485760, metadata }) => {
    try {
      let buffer: Buffer;
      let actualFilename: string;

      // Handle file path input
      if (filePath) {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
          return {
            success: false,
            error: `File not found at path: ${filePath}`,
            errorType: 'FILE_NOT_FOUND'
          };
        }

        // Check if it's a file (not directory)
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
          return {
            success: false,
            error: `Path is not a file: ${filePath}`,
            errorType: 'INVALID_FILE_PATH'
          };
        }

        // Read file from disk
        buffer = fs.readFileSync(filePath);
        actualFilename = filename || path.basename(filePath);

        // Validate file extension
        const ext = path.extname(filePath).toLowerCase();
        if (ext !== '.pdf') {
          return {
            success: false,
            error: 'Invalid file extension. Only .pdf files are supported.',
            errorType: 'INVALID_FILE_TYPE'
          };
        }
      }
      // Handle base64 buffer input
      else if (fileBuffer) {
        // Validate file type
        if (mimeType !== 'application/pdf') {
          return {
            success: false,
            error: 'Invalid file type. Only PDF files are supported.',
            errorType: 'INVALID_FILE_TYPE'
          };
        }

        // Decode base64 buffer
        buffer = Buffer.from(fileBuffer, 'base64');
        actualFilename = filename || 'uploaded_document.pdf';
      }
      else {
        return {
          success: false,
          error: 'Either filePath or fileBuffer must be provided',
          errorType: 'MISSING_INPUT'
        };
      }
      
      // Validate file size
      if (buffer.length > maxSizeBytes) {
        return {
          success: false,
          error: `File size exceeds maximum limit of ${maxSizeBytes} bytes`,
          errorType: 'FILE_TOO_LARGE',
          actualSize: buffer.length,
          maxSize: maxSizeBytes
        };
      }

      // Validate PDF header
      const pdfHeader = buffer.subarray(0, 4).toString();
      if (pdfHeader !== '%PDF') {
        return {
          success: false,
          error: 'Invalid PDF file format',
          errorType: 'INVALID_PDF_FORMAT'
        };
      }

      // Generate document ID
      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

      return {
        success: true,
        documentId: documentId,
        filename: actualFilename,
        fileSize: buffer.length,
        mimeType: mimeType,
        metadata: metadata || {},
        processedBuffer: buffer.toString('base64'),
        uploadedAt: new Date().toISOString(),
        sourcePath: filePath || undefined,
        nextSteps: {
          required: ['extractText', 'chunkDocument', 'generateEmbeddings', 'storeEmbeddings'],
          message: 'PDF uploaded successfully. Now extract text from this document to continue the RAG workflow.',
          readyForTextExtraction: true
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