import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import { formatError } from '../../types/common';

export const imageSearchTool = tool({
  description: 'Search for images on Google with various filters like size, color, type, and usage rights.',
  inputSchema: z.object({
    query: z.string().describe('Image search query (e.g., "sunset landscape", "business meeting")'),
    num: z.number().min(1).max(10).optional().default(10).describe('Number of images to return (1-10)'),
    imgSize: z.enum(['icon', 'small', 'medium', 'large', 'xlarge', 'xxlarge', 'huge']).optional().describe('Image size filter'),
    imgType: z.enum(['photo', 'clipart', 'face', 'lineart', 'animated', 'stock']).optional().describe('Image type filter'),
    imgColorType: z.enum(['color', 'gray', 'mono', 'trans']).optional().describe('Color type (color, grayscale, monochrome, transparent)'),
    imgDominantColor: z.enum(['black', 'blue', 'brown', 'gray', 'green', 'orange', 'pink', 'purple', 'red', 'teal', 'white', 'yellow']).optional().describe('Dominant color filter'),
    rights: z.string().optional().describe('Usage rights (e.g., "cc_publicdomain", "cc_attribute", "cc_sharealike", "cc_noncommercial")'),
    safe: z.enum(['active', 'off']).optional().default('active').describe('SafeSearch level'),
    siteSearch: z.string().optional().describe('Restrict search to specific site'),
  }),
  execute: async ({ query, num, imgSize, imgType, imgColorType, imgDominantColor, rights, safe, siteSearch }) => {
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
      
      const baseUrl = 'https://www.googleapis.com/customsearch/v1';
      const params = new URLSearchParams();
      params.append('key', apiKey);
      params.append('cx', engineId);
      params.append('q', query);
      params.append('num', num.toString());
      params.append('searchType', 'image');
      params.append('safe', safe);
      
      // Add image-specific parameters
      if (imgSize) params.append('imgSize', imgSize);
      if (imgType) params.append('imgType', imgType);
      if (imgColorType) params.append('imgColorType', imgColorType);
      if (imgDominantColor) params.append('imgDominantColor', imgDominantColor);
      if (rights) params.append('rights', rights);
      if (siteSearch) params.append('siteSearch', siteSearch);
      
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
          imgSize,
          imgType,
          imgColorType,
          imgDominantColor,
          rights,
          siteSearch
        },
        searchInfo: {
          totalResults: searchInfo.totalResults,
          searchTime: searchInfo.searchTime,
          formattedTotalResults: searchInfo.formattedTotalResults
        },
        images: items.map((item: Record<string, unknown>) => {
          const imageData = item.image as Record<string, unknown> | undefined;
          return {
            title: item.title,
            link: item.link,
            displayLink: item.displayLink,
            snippet: item.snippet,
            thumbnailLink: imageData?.thumbnailLink,
            thumbnailWidth: imageData?.thumbnailWidth,
            thumbnailHeight: imageData?.thumbnailHeight,
            contextLink: imageData?.contextLink,
            width: imageData?.width,
            height: imageData?.height,
            byteSize: imageData?.byteSize,
            mime: item.mime
          };
        }),
        totalImages: items.length
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