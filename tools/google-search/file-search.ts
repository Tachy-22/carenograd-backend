import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import { formatError } from '../../types/common';

export const fileSearchTool = tool({
  description: 'Search for specific file types like PDFs, DOCs, spreadsheets, presentations, and other documents.',
  inputSchema: z.object({
    query: z.string().describe('Search query for the file content (e.g., "machine learning tutorial", "financial report")'),
    fileType: z.enum(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp']).describe('File type to search for'),
    num: z.number().min(1).max(10).optional().default(10).describe('Number of results to return (1-10)'),
    siteSearch: z.string().optional().describe('Restrict search to specific site (e.g., "edu" for educational sites)'),
    dateRestrict: z.string().optional().describe('Date restriction (e.g., "y1" for last year, "m6" for last 6 months)'),
    rights: z.string().optional().describe('Usage rights filter (e.g., "cc_publicdomain" for public domain)'),
    cr: z.string().optional().describe('Country restriction'),
    safe: z.enum(['active', 'off']).optional().default('active').describe('SafeSearch level'),
  }),
  execute: async ({ query, fileType, num, siteSearch, dateRestrict, rights, cr, safe }) => {
    try {
      const apiKey = process.env.GOOGLE_SEARCH_ENGINE_API_KEY;
      const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
      
      if (!apiKey || !engineId) {
        return {
          success: false,
          error: 'Google Search API credentials not configured',
          query,
          fileType
        };
      }
      
      const baseUrl = 'https://www.googleapis.com/customsearch/v1';
      const params = new URLSearchParams();
      params.append('key', apiKey);
      params.append('cx', engineId);
      params.append('q', query);
      params.append('num', num.toString());
      params.append('fileType', fileType);
      params.append('safe', safe);
      
      // Add optional parameters
      if (siteSearch) params.append('siteSearch', siteSearch);
      if (dateRestrict) params.append('dateRestrict', dateRestrict);
      if (rights) params.append('rights', rights);
      if (cr) params.append('cr', cr);
      
      const response = await axios.get(`${baseUrl}?${params}`, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Google-Search-Agent/1.0'
        }
      });
      
      const searchInfo = response.data.searchInformation || {};
      const items = response.data.items || [];
      
      // Process file results with additional metadata
      const files = items.map((item: Record<string, unknown>) => {
        const fileUrl = new URL(item.link as string);
        const fileName = fileUrl.pathname.split('/').pop() || 'Unknown';
        const fileExtension = fileName.split('.').pop()?.toLowerCase();
        
        return {
          title: item.title,
          link: item.link,
          displayLink: item.displayLink,
          snippet: item.snippet,
          formattedUrl: item.formattedUrl,
          fileName: fileName,
          fileExtension: fileExtension,
          fileFormat: item.fileFormat,
          mime: item.mime,
          // Estimate file category
          category: getFileCategory(fileType),
          // Extract potential file size if available in snippet
          estimatedSize: extractFileSizeFromSnippet(item.snippet as string)
        };
      });
      
      // Categorize results
      const categoryStats = files.reduce((acc: Record<string, number>, file) => {
        const category = file.category;
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});
      
      return {
        success: true,
        query,
        fileType,
        searchInfo: {
          totalResults: searchInfo.totalResults,
          searchTime: searchInfo.searchTime,
          formattedTotalResults: searchInfo.formattedTotalResults
        },
        files,
        totalFiles: files.length,
        categoryStats,
        filters: {
          siteSearch,
          dateRestrict,
          rights,
          cr
        }
      };
    } catch (error: unknown) {
      return {
        success: false,
        query,
        fileType,
        ...formatError(error)
      };
    }
  },
});

// Helper function to categorize file types
function getFileCategory(fileType: string): string {
  const categories = {
    'pdf': 'Document',
    'doc': 'Word Document',
    'docx': 'Word Document', 
    'xls': 'Spreadsheet',
    'xlsx': 'Spreadsheet',
    'ppt': 'Presentation',
    'pptx': 'Presentation',
    'txt': 'Text File',
    'rtf': 'Rich Text',
    'odt': 'OpenDocument Text',
    'ods': 'OpenDocument Spreadsheet',
    'odp': 'OpenDocument Presentation'
  };
  return categories[fileType as keyof typeof categories] || 'Document';
}

// Helper function to extract file size from snippet text
function extractFileSizeFromSnippet(snippet: string): string | null {
  const sizeRegex = /(\d+(?:\.\d+)?)\s*(KB|MB|GB|bytes?)/i;
  const match = snippet.match(sizeRegex);
  return match ? `${match[1]} ${match[2].toUpperCase()}` : null;
}