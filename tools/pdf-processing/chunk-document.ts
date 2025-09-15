import { tool } from 'ai';
import { z } from 'zod';
import { formatError } from '../../types/common';

export const chunkDocumentTool = tool({
  description: 'STEP 3 of RAG workflow: Split document text into semantic chunks for embedding. Requires extractedText from extractPdfText. After this, you MUST call generateEmbeddings to continue.',
  inputSchema: z.object({
    text: z.string().describe('The full text content to be chunked'),
    strategy: z.enum(['sentence', 'paragraph', 'fixed_size', 'semantic']).describe('Chunking strategy to use'),
    options: z.object({
      maxChunkSize: z.number().optional().describe('Maximum characters per chunk (for fixed_size strategy)'),
      overlap: z.number().optional().describe('Character overlap between chunks (default: 100)'),
      minChunkSize: z.number().optional().describe('Minimum characters per chunk (default: 50)'),
      preserveStructure: z.boolean().optional().describe('Whether to preserve document structure markers'),
      customDelimiters: z.array(z.string()).optional().describe('Custom delimiters for splitting')
    }).optional().describe('Chunking options'),
    metadata: z.object({
      documentId: z.string().optional(),
      filename: z.string().optional(),
      source: z.string().optional()
    }).optional().describe('Document metadata to attach to chunks')
  }),
  execute: async ({ text, strategy, options = {}, metadata = {} }) => {
    try {
      const {
        maxChunkSize = 1000,
        overlap = 100,
        minChunkSize = 50,
        preserveStructure = true,
        customDelimiters = []
      } = options;

      let chunks: string[] = [];

      switch (strategy) {
        case 'sentence':
          chunks = chunkBySentence(text, maxChunkSize, overlap);
          break;
        case 'paragraph':
          chunks = chunkByParagraph(text, maxChunkSize, overlap);
          break;
        case 'fixed_size':
          chunks = chunkByFixedSize(text, maxChunkSize, overlap);
          break;
        case 'semantic':
          chunks = chunkBySemantic(text, maxChunkSize, overlap);
          break;
        default:
          throw new Error(`Unknown chunking strategy: ${strategy}`);
      }

      // Filter out chunks that are too small
      chunks = chunks.filter(chunk => chunk.trim().length >= minChunkSize);

      // Generate chunk metadata
      const processedChunks = chunks.map((chunk, index) => ({
        id: `chunk_${index + 1}`,
        content: chunk.trim(),
        index: index,
        characterCount: chunk.length,
        wordCount: chunk.split(/\s+/).length,
        metadata: {
          ...metadata,
          chunkIndex: index,
          strategy: strategy,
          overlap: overlap,
          createdAt: new Date().toISOString()
        }
      }));

      return {
        success: true,
        chunks: processedChunks,
        summary: {
          totalChunks: processedChunks.length,
          strategy: strategy,
          averageChunkSize: Math.round(processedChunks.reduce((sum, chunk) => sum + chunk.characterCount, 0) / processedChunks.length),
          totalCharacters: processedChunks.reduce((sum, chunk) => sum + chunk.characterCount, 0),
          options: options
        },
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

// Helper functions for different chunking strategies
function chunkBySentence(text: string, maxSize: number, overlap: number): string[] {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (currentChunk.length + trimmedSentence.length > maxSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Add overlap
      const words = currentChunk.split(/\s+/);
      const overlapWords = words.slice(-Math.floor(overlap / 10)); // Approximate word overlap
      currentChunk = overlapWords.join(' ') + ' ' + trimmedSentence;
    } else {
      currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

function chunkByParagraph(text: string, maxSize: number, overlap: number): string[] {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (currentChunk.length + trimmedParagraph.length > maxSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Add overlap
      const lastSentences = currentChunk.split(/[.!?]+/).slice(-2).join('. ').trim();
      currentChunk = lastSentences + '\n\n' + trimmedParagraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

function chunkByFixedSize(text: string, maxSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + maxSize, text.length);
    let chunk = text.substring(start, end);
    
    // Try to end at a word boundary if possible
    if (end < text.length) {
      const lastSpaceIndex = chunk.lastIndexOf(' ');
      if (lastSpaceIndex > maxSize * 0.8) { // Only if we're not losing too much content
        chunk = chunk.substring(0, lastSpaceIndex);
      }
    }
    
    chunks.push(chunk.trim());
    start = end - overlap;
    
    if (start >= text.length) break;
  }
  
  return chunks;
}

function chunkBySemantic(text: string, maxSize: number, overlap: number): string[] {
  // For semantic chunking, we'll use a combination of paragraph and sentence boundaries
  // This is a simplified version - in production, you might use more sophisticated NLP
  const sections = text.split(/\n\s*\n/).filter(s => s.trim().length > 0);
  const chunks: string[] = [];
  
  for (const section of sections) {
    if (section.length <= maxSize) {
      chunks.push(section.trim());
    } else {
      // Split large sections by sentences
      const sectionChunks = chunkBySentence(section, maxSize, overlap);
      chunks.push(...sectionChunks);
    }
  }
  
  return chunks;
}