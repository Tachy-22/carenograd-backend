import { tool } from 'ai';
import { z } from 'zod';
import { formatError } from '../../types/common';
import pdfParse from 'pdf-parse';

export const extractPdfTextTool = tool({
  description: 'STEP 2 of RAG workflow: Extract text content from a PDF buffer using pdf-parse. Requires processedBuffer from uploadPdf. After this, you MUST call chunkDocument to continue the workflow.',
  inputSchema: z.object({
    fileBuffer: z.string().describe('Base64 encoded PDF file buffer'),
    options: z.object({
      maxPages: z.number().optional().describe('Maximum number of pages to process (default: no limit)'),
      password: z.string().optional().describe('Password for encrypted PDFs'),
      normalizeWhitespace: z.boolean().optional().describe('Whether to normalize whitespace (default: true)'),
      disableCombineTextItems: z.boolean().optional().describe('Whether to disable combining text items (default: false)')
    }).optional().describe('PDF extraction options')
  }),
  execute: async ({ fileBuffer, options = {} }) => {
    try {
      const buffer = Buffer.from(fileBuffer, 'base64');
      const {
        maxPages,
        password,
        normalizeWhitespace = true,
        disableCombineTextItems = false
      } = options;

      // Configure pdf-parse options
      const parseOptions: Record<string, unknown> = {
        max: maxPages || 0,
        version: 'v1.10.100'
      };

      if (password) {
        parseOptions.password = password;
      }

      // Extract text using pdf-parse
      const data = await pdfParse(buffer, parseOptions);
      
      let extractedText = data.text;
      
      // Apply text normalization if requested
      if (normalizeWhitespace) {
        extractedText = extractedText.replace(/\s+/g, ' ').trim();
      }

      // Calculate metadata
      const wordCount = extractedText.split(/\s+/).filter((word: string) => word.length > 0).length;
      const characterCount = extractedText.length;

      return {
        success: true,
        extractedText: extractedText,
        metadata: {
          totalPages: data.numpages,
          processedPages: maxPages ? Math.min(maxPages, data.numpages) : data.numpages,
          wordCount: wordCount,
          characterCount: characterCount,
          hasPassword: !!password,
          pdfInfo: data.info || {},
          extractionOptions: {
            normalizeWhitespace,
            disableCombineTextItems,
            maxPages: maxPages || null
          }
        },
        rawData: {
          version: data.version,
          info: data.info,
          metadata: data.metadata
        },
        extractedAt: new Date().toISOString(),
        nextSteps: {
          required: ['chunkDocument', 'generateEmbeddings', 'storeEmbeddings'],
          message: 'Text extracted successfully. Now chunk this text into smaller pieces for embedding generation.',
          readyForChunking: true,
          textData: extractedText
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