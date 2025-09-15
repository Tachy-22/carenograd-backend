// Google Search Tool Family
import { webSearchTool } from './web-search';
import { advancedSearchTool } from './advanced-search';
import { imageSearchTool } from './image-search';
import { newsSearchTool } from './news-search';
import { siteSearchTool } from './site-search';
import { fileSearchTool } from './file-search';

// Export individual tools
export { webSearchTool } from './web-search';
export { advancedSearchTool } from './advanced-search';
export { imageSearchTool } from './image-search';
export { newsSearchTool } from './news-search';
export { siteSearchTool } from './site-search';
export { fileSearchTool } from './file-search';

// Tool family metadata
export const googleSearchTools = {
  webSearch: webSearchTool,
  advancedSearch: advancedSearchTool,
  imageSearch: imageSearchTool,
  newsSearch: newsSearchTool,
  siteSearch: siteSearchTool,
  fileSearch: fileSearchTool,
} as const;

export type GoogleSearchToolName = keyof typeof googleSearchTools;