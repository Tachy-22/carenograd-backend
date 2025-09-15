import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';

export const fetchHtmlTool = tool({
  description: 'Fetches the HTML content of a webpage. Use this to get the raw HTML of any URL.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to fetch HTML content from'),
    timeout: z.number().optional().default(10000).describe('Request timeout in milliseconds'),
  }),
  execute: async ({ url, timeout }) => {
    try {
      const response = await axios.get(url, {
        timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      return {
        success: true,
        url,
        statusCode: response.status,
        html: response.data,
        headers: Object.fromEntries(
          Object.entries(response.headers).map(([key, value]) => [key, String(value)])
        )
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