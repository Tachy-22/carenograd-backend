import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import { formatError } from '../../types/common';

export const siteSearchTool = tool({
  description: 'Search within specific websites or domains. Perfect for finding content on particular sites like GitHub, Reddit, Stack Overflow, etc.',
  inputSchema: z.object({
    query: z.string().describe('Search query to find within the site'),
    site: z.string().describe('Website or domain to search within (e.g., "github.com", "reddit.com", "stackoverflow.com")'),
    num: z.number().min(1).max(10).optional().default(10).describe('Number of results to return (1-10)'),
    dateRestrict: z.string().optional().describe('Date restriction (e.g., "d7" for last 7 days, "m1" for last month)'),
    fileType: z.string().optional().describe('File type to search for within the site (e.g., "pdf", "doc")'),
    exactTerms: z.string().optional().describe('Exact phrase that must appear in results'),
    excludeTerms: z.string().optional().describe('Terms to exclude from results'),
    safe: z.enum(['active', 'off']).optional().default('active').describe('SafeSearch level'),
  }),
  execute: async ({ query, site, num, dateRestrict, fileType, exactTerms, excludeTerms, safe }) => {
    try {
      const apiKey = process.env.GOOGLE_SEARCH_ENGINE_API_KEY;
      const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
      
      if (!apiKey || !engineId) {
        return {
          success: false,
          error: 'Google Search API credentials not configured',
          query,
          site
        };
      }
      
      const baseUrl = 'https://www.googleapis.com/customsearch/v1';
      const params = new URLSearchParams();
      params.append('key', apiKey);
      params.append('cx', engineId);
      params.append('q', query);
      params.append('num', num.toString());
      params.append('siteSearch', site);
      params.append('siteSearchFilter', 'i'); // Include the site
      params.append('safe', safe);
      
      // Add optional parameters
      if (dateRestrict) params.append('dateRestrict', dateRestrict);
      if (fileType) params.append('fileType', fileType);
      if (exactTerms) params.append('exactTerms', exactTerms);
      if (excludeTerms) params.append('excludeTerms', excludeTerms);
      
      const response = await axios.get(`${baseUrl}?${params}`, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Google-Search-Agent/1.0'
        }
      });
      
      const searchInfo = response.data.searchInformation || {};
      const items = response.data.items || [];
      
      // Extract site-specific information
      const siteType = getSiteType(site);
      const results = items.map((item: Record<string, unknown>) => {
        const result = {
          title: item.title,
          link: item.link,
          displayLink: item.displayLink,
          snippet: item.snippet,
          formattedUrl: item.formattedUrl,
          siteType: siteType
        };
        
        // Add site-specific metadata
        const link = item.link as string;
        if (siteType === 'github' && link.includes('/')) {
          const pathParts = new URL(link).pathname.split('/').filter(p => p);
          (result as { githubRepo?: string }).githubRepo = pathParts.length >= 2 ? `${pathParts[0]}/${pathParts[1]}` : undefined;
        } else if (siteType === 'reddit' && link.includes('/r/')) {
          const subredditMatch = link.match(/\/r\/([^\/]+)/);
          (result as { subreddit?: string }).subreddit = subredditMatch ? subredditMatch[1] : undefined;
        } else if (siteType === 'stackoverflow' && link.includes('/questions/')) {
          (result as { isQuestion?: boolean; questionId?: string }).isQuestion = true;
          const questionIdMatch = link.match(/\/questions\/(\d+)/);
          (result as { questionId?: string }).questionId = questionIdMatch ? questionIdMatch[1] : undefined;
        }
        
        return result;
      });
      
      return {
        success: true,
        query,
        site,
        siteType,
        searchInfo: {
          totalResults: searchInfo.totalResults,
          searchTime: searchInfo.searchTime,
          formattedTotalResults: searchInfo.formattedTotalResults
        },
        results,
        totalResults: results.length,
        filters: {
          dateRestrict,
          fileType,
          exactTerms,
          excludeTerms
        }
      };
    } catch (error: unknown) {
      return {
        success: false,
        query,
        site,
        ...formatError(error)
      };
    }
  },
});

// Helper function to identify site type
function getSiteType(site: string): string {
  const domain = site.toLowerCase();
  if (domain.includes('github.com')) return 'github';
  if (domain.includes('reddit.com')) return 'reddit';
  if (domain.includes('stackoverflow.com')) return 'stackoverflow';
  if (domain.includes('stackexchange.com')) return 'stackexchange';
  if (domain.includes('youtube.com')) return 'youtube';
  if (domain.includes('linkedin.com')) return 'linkedin';
  if (domain.includes('medium.com')) return 'medium';
  if (domain.includes('wikipedia.org')) return 'wikipedia';
  if (domain.includes('.edu')) return 'academic';
  if (domain.includes('.gov')) return 'government';
  return 'general';
}