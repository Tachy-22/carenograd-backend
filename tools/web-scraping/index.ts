// Web Scraping Tool Family
import { fetchHtmlTool } from './fetch-html';
import { extractTextTool } from './extract-text';
import { extractLinksTool } from './extract-links';
import { extractMetadataTool } from './extract-metadata';
import { extractImagesTool } from './extract-images';
import { scrapeTableTool } from './scrape-table';

// Export individual tools
export { fetchHtmlTool } from './fetch-html';
export { extractTextTool } from './extract-text';
export { extractLinksTool } from './extract-links';
export { extractMetadataTool } from './extract-metadata';
export { extractImagesTool } from './extract-images';
export { scrapeTableTool } from './scrape-table';

// Tool family metadata
export const webScrapingTools = {
  fetchHtml: fetchHtmlTool,
  extractText: extractTextTool,
  extractLinks: extractLinksTool,
  extractMetadata: extractMetadataTool,
  extractImages: extractImagesTool,
  scrapeTable: scrapeTableTool,
} as const;

export type WebScrapingToolName = keyof typeof webScrapingTools;