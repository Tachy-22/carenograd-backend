import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import * as cheerio from 'cheerio';

export const extractImagesTool = tool({
  description: 'Extracts all images from a webpage including their URLs, alt text, and dimensions if available.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to extract images from'),
    includeDataUrls: z.boolean().optional().default(false).describe('Include data URLs (base64 encoded images)'),
    minWidth: z.number().optional().describe('Minimum width to filter images'),
    minHeight: z.number().optional().describe('Minimum height to filter images'),
  }),
  execute: async ({ url, includeDataUrls, minWidth, minHeight }) => {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      const images: Array<{
        src: string;
        alt: string;
        width?: number;
        height?: number;
        isDataUrl: boolean;
      }> = [];
      
      $('img').each((_, element) => {
        const src = $(element).attr('src');
        if (!src) return;
        
        const isDataUrl = src.startsWith('data:');
        if (isDataUrl && !includeDataUrls) return;
        
        const alt = $(element).attr('alt') || '';
        const widthAttr = $(element).attr('width');
        const heightAttr = $(element).attr('height');
        
        const width = widthAttr ? parseInt(widthAttr) : undefined;
        const height = heightAttr ? parseInt(heightAttr) : undefined;
        
        // Apply size filters
        if (minWidth && width && width < minWidth) return;
        if (minHeight && height && height < minHeight) return;
        
        try {
          // Resolve relative URLs (skip for data URLs)
          const resolvedSrc = isDataUrl ? src : new URL(src, url).href;
          
          images.push({
            src: resolvedSrc,
            alt,
            width,
            height,
            isDataUrl
          });
        } catch {
          // Skip invalid URLs
        }
      });
      
      // Remove duplicates
      const uniqueImages = images.filter((img, index) => 
        images.findIndex(i => i.src === img.src) === index
      );
      
      return {
        success: true,
        url,
        totalImages: uniqueImages.length,
        dataUrlImages: uniqueImages.filter(img => img.isDataUrl).length,
        externalImages: uniqueImages.filter(img => !img.isDataUrl).length,
        images: uniqueImages
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