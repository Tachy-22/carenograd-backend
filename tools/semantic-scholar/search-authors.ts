import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import type { SemanticScholarAuthor } from '../../types/semantic-scholar';
import { formatError } from '../../types/common';

export const searchAuthorsTool = tool({
  description: 'Search for authors by name on Semantic Scholar. Returns basic author information including their ID, name, and affiliation.',
  inputSchema: z.object({
    query: z.string().describe('Author name to search for (e.g., "Geoffrey Hinton", "Yann LeCun")'),
    limit: z.number().min(1).max(100).optional().default(10).describe('Maximum number of authors to return (1-100)'),
    fields: z.array(z.string()).optional().describe('Additional fields to include: url, affiliations, homepage, paperCount, citationCount, hIndex'),
  }),
  execute: async ({ query, limit, fields }) => {
    try {
      const baseUrl = 'https://api.semanticscholar.org/graph/v1/author/search';
      const params = new URLSearchParams();
      params.append('query', query);
      params.append('limit', limit.toString());
      
      if (fields && fields.length > 0) {
        params.append('fields', fields.join(','));
      }
      
      const response = await axios.get(`${baseUrl}?${params}`, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Academic-Research-Agent/1.0'
        }
      });
      
      const authors = response.data?.data || [];
      
      return {
        success: true,
        query,
        totalAuthors: authors.length,
        authors: authors.map((author: SemanticScholarAuthor) => ({
          authorId: author.authorId,
          name: author.name,
          url: author.url,
          affiliations: author.affiliations || [],
          homepage: author.homepage,
          paperCount: author.paperCount,
          citationCount: author.citationCount,
          hIndex: author.hIndex
        }))
      };
    } catch (error: unknown) {
      const errorDetails = {
        success: false,
        query,
        ...formatError(error),
        errorType: (error as {code?: string}).code || 'UNKNOWN_ERROR'
      };
      
      console.error('Semantic Scholar API Error:', errorDetails);
      return errorDetails;
    }
  },
});