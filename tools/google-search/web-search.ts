import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import { formatError } from '../../types/common';
import { GoogleSearchKeyManager } from './key-rotation-manager';

export const webSearchTool = tool({
  description: 'Perform a Google web search with automatic API key rotation. Supports 1000 daily queries across 10 keys at $0 cost.',
  inputSchema: z.object({
    query: z.string().describe('Search query (e.g., "artificial intelligence", "climate change news")'),
    num: z.number().min(1).max(10).optional().default(10).describe('Number of results to return (1-10)'),
    start: z.number().min(1).optional().default(1).describe('Starting result index for pagination'),
    safe: z.enum(['active', 'off']).optional().default('active').describe('SafeSearch level'),
    lr: z.string().optional().describe('Language restriction (e.g., "lang_en", "lang_es")'),
  }),
  execute: async ({ query, num, start, safe, lr }) => {
    try {
      const keyManager = GoogleSearchKeyManager.getInstance();
      const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
      
      if (!engineId) {
        return {
          success: false,
          error: 'Google Search Engine ID not configured. Check GOOGLE_SEARCH_ENGINE_ID environment variable.',
          query
        };
      }

      // Get available API key
      const apiKey = keyManager.getAvailableKey();
      
      if (!apiKey) {
        const stats = keyManager.getUsageStats();
        return {
          success: false,
          error: `Daily search quota exhausted. Used ${stats.totalQueries}/1000 queries today. Resets at midnight UTC.`,
          query,
          usageStats: stats
        };
      }
      
      const baseUrl = 'https://www.googleapis.com/customsearch/v1';
      const params = new URLSearchParams();
      params.append('key', apiKey);
      params.append('cx', engineId);
      params.append('q', query);
      params.append('num', num.toString());
      params.append('start', start.toString());
      params.append('safe', safe);
      
      if (lr) {
        params.append('lr', lr);
      }
      
      const response = await axios.get(`${baseUrl}?${params}`, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Google-Search-Agent/1.0'
        }
      });
      
      // Track successful usage
      keyManager.trackUsage(apiKey);
      
      const searchInfo = response.data.searchInformation || {};
      const items = response.data.items || [];
      const usageStats = keyManager.getUsageStats();
      
      return {
        success: true,
        query,
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
          htmlTitle: item.htmlTitle,
          htmlSnippet: item.htmlSnippet,
          formattedUrl: item.formattedUrl
        })),
        totalResults: items.length,
        pagination: {
          currentPage: Math.ceil(start / num),
          resultsPerPage: num,
          hasNextPage: items.length === num
        },
        quotaInfo: {
          queriesUsedToday: usageStats.totalQueries,
          queriesRemaining: usageStats.remainingQueries,
          currentKey: usageStats.currentKey
        }
      };
    } catch (error: unknown) {
      // Track failed usage
      const keyManager = GoogleSearchKeyManager.getInstance();
      const apiKey = keyManager.getAvailableKey();
      if (apiKey) {
        keyManager.trackFailure(apiKey, error);
      }
      
      return {
        success: false,
        query,
        ...formatError(error)
      };
    }
  },
});