import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import * as cheerio from 'cheerio';

export const extractMetadataTool = tool({
  description: 'Extracts webpage metadata including title, description, keywords, Open Graph, and Twitter Card data.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to extract metadata from'),
  }),
  execute: async ({ url }) => {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Basic metadata
      const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
      const description = $('meta[name="description"]').attr('content') || 
                         $('meta[property="og:description"]').attr('content') || '';
      const keywords = $('meta[name="keywords"]').attr('content') || '';
      const author = $('meta[name="author"]').attr('content') || '';
      const canonical = $('link[rel="canonical"]').attr('href') || '';
      
      // Open Graph metadata
      const openGraph = {
        title: $('meta[property="og:title"]').attr('content') || '',
        description: $('meta[property="og:description"]').attr('content') || '',
        image: $('meta[property="og:image"]').attr('content') || '',
        url: $('meta[property="og:url"]').attr('content') || '',
        type: $('meta[property="og:type"]').attr('content') || '',
        siteName: $('meta[property="og:site_name"]').attr('content') || ''
      };
      
      // Twitter Card metadata
      const twitterCard = {
        card: $('meta[name="twitter:card"]').attr('content') || '',
        title: $('meta[name="twitter:title"]').attr('content') || '',
        description: $('meta[name="twitter:description"]').attr('content') || '',
        image: $('meta[name="twitter:image"]').attr('content') || '',
        site: $('meta[name="twitter:site"]').attr('content') || '',
        creator: $('meta[name="twitter:creator"]').attr('content') || ''
      };
      
      // Additional useful metadata
      const favicon = $('link[rel="icon"], link[rel="shortcut icon"]').attr('href') || 
                     $('link[rel="apple-touch-icon"]').attr('href') || '';
      
      const language = $('html').attr('lang') || $('meta[http-equiv="content-language"]').attr('content') || '';
      
      return {
        success: true,
        url,
        title,
        description,
        keywords,
        author,
        canonical,
        language,
        favicon,
        openGraph,
        twitterCard
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