import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import * as cheerio from 'cheerio';

export const extractLinksTool = tool({
  description: 'Extracts all links from a webpage. Useful for discovering related pages, navigation, or collecting URLs.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to extract links from'),
    filterDomain: z.boolean().optional().default(false).describe('Whether to only return links from the same domain'),
    includeInternal: z.boolean().optional().default(true).describe('Include internal links (same domain)'),
    includeExternal: z.boolean().optional().default(true).describe('Include external links (different domains)'),
  }),
  execute: async ({ url, filterDomain, includeInternal, includeExternal }) => {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      const baseUrl = new URL(url);
      const links: Array<{href: string, text: string, isInternal: boolean}> = [];
      
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        
        if (!href) return;
        
        try {
          // Resolve relative URLs
          const resolvedUrl = new URL(href, url).href;
          const linkUrl = new URL(resolvedUrl);
          const isInternal = linkUrl.hostname === baseUrl.hostname;
          
          // Apply filters
          if (filterDomain && !isInternal) return;
          if (!includeInternal && isInternal) return;
          if (!includeExternal && !isInternal) return;
          
          links.push({
            href: resolvedUrl,
            text: text || href,
            isInternal
          });
        } catch {
          // Skip invalid URLs
        }
      });
      
      // Remove duplicates
      const uniqueLinks = links.filter((link, index) => 
        links.findIndex(l => l.href === link.href) === index
      );
      
      return {
        success: true,
        url,
        totalLinks: uniqueLinks.length,
        internalLinks: uniqueLinks.filter(l => l.isInternal).length,
        externalLinks: uniqueLinks.filter(l => !l.isInternal).length,
        links: uniqueLinks
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