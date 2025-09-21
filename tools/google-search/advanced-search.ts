import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import { formatError } from '../../types/common';
import { GoogleSearchKeyManager } from './key-rotation-manager';

export const advancedSearchTool = tool({
  description: 'Perform advanced Google search with filters like date restrictions, file types, exact terms, and site-specific searches.',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    num: z.number().min(1).max(10).optional().default(10).describe('Number of results to return (1-10)'),
    dateRestrict: z.string().optional().describe('Date restriction (e.g., "d7" for last 7 days, "m1" for last month, "y1" for last year)'),
    exactTerms: z.string().optional().describe('Exact phrase that must appear in results'),
    excludeTerms: z.string().optional().describe('Terms to exclude from results'),
    fileType: z.string().optional().describe('File type to search for (e.g., "pdf", "doc", "ppt", "xls")'),
    siteSearch: z.string().optional().describe('Restrict search to specific site (e.g., "reddit.com", "github.com")'),
    siteSearchFilter: z.enum(['e', 'i']).optional().default('i').describe('Include (i) or exclude (e) the siteSearch'),
    rights: z.string().optional().describe('Licensing filter (e.g., "cc_publicdomain", "cc_attribute", "cc_sharealike")'),
    cr: z.string().optional().describe('Country restriction (e.g., "countryUS", "countryUK")'),
    safe: z.enum(['active', 'off']).optional().default('active').describe('SafeSearch level'),
    sort: z.string().optional().describe('Sort results (e.g., "date" for chronological order)'),
  }),
  execute: async ({ query, num, dateRestrict, exactTerms, excludeTerms, fileType, siteSearch, siteSearchFilter, rights, cr, safe, sort }) => {
    try {
      const keyManager = GoogleSearchKeyManager.getInstance();
      const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
      
      if (!engineId) {
        return {
          success: false,
          error: 'Google Search Engine ID not configured',
          query
        };
      }

      const apiKey = keyManager.getAvailableKey();
      if (!apiKey) {
        return {
          success: false,
          error: 'Daily search quota exhausted across all keys',
          query
        };
      }
      
      const baseUrl = 'https://www.googleapis.com/customsearch/v1';
      const params = new URLSearchParams();
      params.append('key', apiKey);
      params.append('cx', engineId);
      params.append('q', query);
      params.append('num', num.toString());
      params.append('safe', safe);
      
      // Add advanced search parameters
      if (dateRestrict) params.append('dateRestrict', dateRestrict);
      if (exactTerms) params.append('exactTerms', exactTerms);
      if (excludeTerms) params.append('excludeTerms', excludeTerms);
      if (fileType) params.append('fileType', fileType);
      if (siteSearch) {
        params.append('siteSearch', siteSearch);
        params.append('siteSearchFilter', siteSearchFilter);
      }
      if (rights) params.append('rights', rights);
      if (cr) params.append('cr', cr);
      if (sort) params.append('sort', sort);
      
      const response = await axios.get(`${baseUrl}?${params}`, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Google-Search-Agent/1.0'
        }
      });
      
      const searchInfo = response.data.searchInformation || {};
      const items = response.data.items || [];
      
      return {
        success: true,
        query,
        filters: {
          dateRestrict,
          exactTerms,
          excludeTerms,
          fileType,
          siteSearch,
          rights,
          cr,
          sort
        },
        searchInfo: {
          totalResults: searchInfo.totalResults,
          searchTime: searchInfo.searchTime,
          formattedTotalResults: searchInfo.formattedTotalResults
        },
        results: items.map((item: Record<string, unknown>) => ({
          title: item.title,
          link: item.link,
          displayLink: item.displayLink,
          snippet: item.snippet,
          formattedUrl: item.formattedUrl,
          fileFormat: item.fileFormat,
          mime: item.mime
        })),
        totalResults: items.length
      };
    } catch (error: unknown) {
      return {
        success: false,
        query,
        ...formatError(error)
      };
    }
  },
});