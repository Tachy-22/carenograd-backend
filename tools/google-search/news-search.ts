import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import { formatError } from '../../types/common';

export const newsSearchTool = tool({
  description: 'Search for recent news articles and current events with date filtering and source restrictions.',
  inputSchema: z.object({
    query: z.string().describe('News search query (e.g., "climate change summit", "AI breakthrough", "stock market")'),
    num: z.number().min(1).max(10).optional().default(10).describe('Number of results to return (1-10)'),
    dateRestrict: z.string().optional().default('m1').describe('Date restriction (e.g., "d1" for last day, "w1" for last week, "m1" for last month)'),
    sort: z.enum(['date', 'relevance']).optional().default('date').describe('Sort by date or relevance'),
    siteSearch: z.string().optional().describe('Restrict to specific news site (e.g., "cnn.com", "bbc.com", "reuters.com")'),
    cr: z.string().optional().describe('Country restriction (e.g., "countryUS", "countryUK")'),
    lr: z.string().optional().describe('Language restriction (e.g., "lang_en", "lang_es")'),
    safe: z.enum(['active', 'off']).optional().default('active').describe('SafeSearch level'),
  }),
  execute: async ({ query, num, dateRestrict, sort, siteSearch, cr, lr, safe }) => {
    try {
      const apiKey = process.env.GOOGLE_SEARCH_ENGINE_API_KEY;
      const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
      
      if (!apiKey || !engineId) {
        return {
          success: false,
          error: 'Google Search API credentials not configured',
          query
        };
      }
      
      // Enhance query for news-specific results
      let enhancedQuery = query;
      if (!siteSearch) {
        // Add common news terms to improve news result relevance
        enhancedQuery = `${query} (news OR article OR breaking OR latest OR update)`;
      }
      
      const baseUrl = 'https://www.googleapis.com/customsearch/v1';
      const params = new URLSearchParams();
      params.append('key', apiKey);
      params.append('cx', engineId);
      params.append('q', enhancedQuery);
      params.append('num', num.toString());
      params.append('safe', safe);
      
      // Add news-specific parameters
      if (dateRestrict) params.append('dateRestrict', dateRestrict);
      if (sort === 'date') params.append('sort', 'date');
      if (siteSearch) params.append('siteSearch', siteSearch);
      if (cr) params.append('cr', cr);
      if (lr) params.append('lr', lr);
      
      const response = await axios.get(`${baseUrl}?${params}`, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Google-Search-Agent/1.0'
        }
      });
      
      const searchInfo = response.data.searchInformation || {};
      const items = response.data.items || [];
      
      // Filter and enhance results for news content
      const newsResults = items.map((item: Record<string, unknown>) => {
        const isNewsSource = /\b(news|cnn|bbc|reuters|ap|bloomberg|wsj|nytimes|guardian|abc|nbc|cbs|fox|npr|usa|today)\b/i.test(item.displayLink as string);
        const hasNewsKeywords = /\b(breaking|latest|news|article|report|update|announced|says|according)\b/i.test(item.snippet as string);
        
        const pagemap = item.pagemap as { metatags?: Record<string, unknown>[] } | undefined;
        
        return {
          title: item.title,
          link: item.link,
          displayLink: item.displayLink,
          snippet: item.snippet,
          formattedUrl: item.formattedUrl,
          isLikelyNews: isNewsSource || hasNewsKeywords,
          source: item.displayLink,
          publishedDate: pagemap?.metatags?.[0]?.['article:published_time'] as string || 
                         pagemap?.metatags?.[0]?.['og:updated_time'] as string || null
        };
      });
      
      return {
        success: true,
        query: query,
        enhancedQuery: enhancedQuery,
        filters: {
          dateRestrict,
          sort,
          siteSearch,
          cr,
          lr
        },
        searchInfo: {
          totalResults: searchInfo.totalResults,
          searchTime: searchInfo.searchTime,
          formattedTotalResults: searchInfo.formattedTotalResults
        },
        articles: newsResults,
        totalResults: newsResults.length,
        newsSourceCount: newsResults.filter(result => result.isLikelyNews).length
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