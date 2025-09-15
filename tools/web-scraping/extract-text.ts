import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import * as cheerio from 'cheerio';

export const extractTextTool = tool({
  description: 'Extracts clean text content from a webpage, removing HTML tags and formatting. Perfect for getting readable text from any URL.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to extract text from'),
    selector: z.string().optional().describe('CSS selector to target specific elements (e.g., "article", ".content", "p")'),
    maxLength: z.number().optional().default(10000).describe('Maximum length of extracted text'),
  }),
  execute: async ({ url, selector, maxLength }) => {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Remove script and style elements
      $('script, style, noscript').remove();
      
      let text: string;
      if (selector) {
        // Extract text from specific selector
        text = $(selector).text();
      } else {
        // Extract text from body, fallback to full document
        text = $('body').text() || $.text();
      }
      
      // Clean up the text
      text = text
        .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
        .trim();
      
      // Truncate if needed
      if (text.length > maxLength) {
        text = text.substring(0, maxLength) + '...';
      }
      
      return {
        success: true,
        url,
        selector: selector || 'body',
        text,
        length: text.length,
        truncated: text.length >= maxLength
      };
    } catch (error: unknown) {
      const err = error as Error & { response?: { status?: number } };
      return {
        success: false,
        url,
        error: err.message || 'Unknown error occurred',
        statusCode: err.response?.status || null
      };
    }
  },
});