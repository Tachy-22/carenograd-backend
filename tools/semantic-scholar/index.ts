// Semantic Scholar Tool Family
import { searchAuthorsTool } from './search-authors';
import { getAuthorTool } from './get-author';
import { searchPapersTool } from './search-papers';
import { getPaperTool } from './get-paper';
import { getAuthorPapersTool } from './get-author-papers';
import { getRecommendationsTool } from './get-recommendations';

// Export individual tools
export { searchAuthorsTool } from './search-authors';
export { getAuthorTool } from './get-author';
export { searchPapersTool } from './search-papers';
export { getPaperTool } from './get-paper';
export { getAuthorPapersTool } from './get-author-papers';
export { getRecommendationsTool } from './get-recommendations';

// Tool family metadata
export const semanticScholarTools = {
  searchAuthors: searchAuthorsTool,
  getAuthor: getAuthorTool,
  searchPapers: searchPapersTool,
  getPaper: getPaperTool,
  getAuthorPapers: getAuthorPapersTool,
  getRecommendations: getRecommendationsTool,
} as const;

export type SemanticScholarToolName = keyof typeof semanticScholarTools;