import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import type { SemanticScholarPaper, SemanticScholarAuthor } from '../../types/semantic-scholar';
import { formatError } from '../../types/common';

export const searchPapersTool = tool({
  description: 'Search for academic papers by keywords, topics, or research areas on Semantic Scholar. Returns paper details including title, authors, abstract, and citation information.',
  inputSchema: z.object({
    query: z.string().describe('Search query (e.g., "machine learning", "neural networks", "climate change")'),
    limit: z.number().min(1).max(100).optional().default(10).describe('Maximum number of papers to return (1-100)'),
    fields: z.array(z.string()).optional().default(['title', 'abstract', 'authors', 'year', 'citationCount', 'referenceCount', 'fieldsOfStudy', 'url']).describe('Fields to include in response'),
    year: z.string().optional().describe('Filter by publication year (e.g., "2023", "2020-2023")'),
    fieldsOfStudy: z.array(z.string()).optional().describe('Filter by fields of study (e.g., ["Computer Science", "Medicine"])'),
  }),
  execute: async ({ query, limit, fields, year, fieldsOfStudy }) => {
    try {
      const baseUrl = 'https://api.semanticscholar.org/graph/v1/paper/search';
      const params = new URLSearchParams();
      params.append('query', query);
      params.append('limit', limit.toString());
      
      if (fields && fields.length > 0) {
        params.append('fields', fields.join(','));
      }
      
      if (year) {
        params.append('year', year);
      }
      
      if (fieldsOfStudy && fieldsOfStudy.length > 0) {
        params.append('fieldsOfStudy', fieldsOfStudy.join(','));
      }
      
      const response = await axios.get(`${baseUrl}?${params}`, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Academic-Research-Agent/1.0'
        }
      });
      
      const papers = response.data?.data || [];
      
      return {
        success: true,
        query,
        totalPapers: papers.length,
        papers: papers.map((paper: SemanticScholarPaper) => ({
          paperId: paper.paperId,
          title: paper.title,
          abstract: paper.abstract,
          url: paper.url,
          year: paper.year,
          citationCount: paper.citationCount,
          referenceCount: paper.referenceCount,
          fieldsOfStudy: paper.fieldsOfStudy || [],
          authors: paper.authors?.map((author: SemanticScholarAuthor) => ({
            authorId: author.authorId,
            name: author.name
          })) || []
        }))
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