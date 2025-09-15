import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import type { SemanticScholarPaper } from '../../types/semantic-scholar';
import { formatError } from '../../types/common';

export const getAuthorPapersTool = tool({
  description: 'Get all publications for a specific author using their Semantic Scholar ID. Returns comprehensive publication list with sorting and filtering options.',
  inputSchema: z.object({
    authorId: z.string().describe('Semantic Scholar author ID (e.g., "1741101")'),
    limit: z.number().min(1).max(1000).optional().default(50).describe('Maximum number of papers to return (1-1000)'),
    offset: z.number().min(0).optional().default(0).describe('Offset for pagination'),
    fields: z.array(z.string()).optional().default(['title', 'abstract', 'year', 'citationCount', 'referenceCount', 'fieldsOfStudy', 'url', 'venue', 'publicationDate']).describe('Fields to include for each paper'),
    sort: z.enum(['year', 'citationCount', 'publicationDate']).optional().describe('Sort papers by field'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc').describe('Sort order'),
  }),
  execute: async ({ authorId, limit, offset, fields, sort, sortOrder }) => {
    try {
      const baseUrl = `https://api.semanticscholar.org/graph/v1/author/${authorId}/papers`;
      const params = new URLSearchParams();
      
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());
      
      if (fields && fields.length > 0) {
        params.append('fields', fields.join(','));
      }
      
      const response = await axios.get(`${baseUrl}?${params}`, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Academic-Research-Agent/1.0'
        }
      });
      
      let papers = response.data?.data || [];
      
      // Apply sorting if requested
      if (sort) {
        papers.sort((a: SemanticScholarPaper, b: SemanticScholarPaper) => {
          let aValue = a[sort as keyof SemanticScholarPaper] as number;
          let bValue = b[sort as keyof SemanticScholarPaper] as number;
          
          // Handle null/undefined values
          if (aValue == null) aValue = sortOrder === 'desc' ? -Infinity : Infinity;
          if (bValue == null) bValue = sortOrder === 'desc' ? -Infinity : Infinity;
          
          if (sortOrder === 'desc') {
            return bValue - aValue;
          } else {
            return aValue - bValue;
          }
        });
      }
      
      const processedPapers = papers.map((paper: SemanticScholarPaper) => ({
        paperId: paper.paperId,
        title: paper.title,
        abstract: paper.abstract,
        url: paper.url,
        year: paper.year,
        publicationDate: paper.publicationDate,
        venue: paper.venue,
        citationCount: paper.citationCount,
        referenceCount: paper.referenceCount,
        fieldsOfStudy: paper.fieldsOfStudy || []
      }));
      
      // Calculate summary statistics
      const totalCitations = processedPapers.reduce((sum: number, paper: SemanticScholarPaper) => sum + (paper.citationCount || 0), 0);
      const years = processedPapers.map((paper: SemanticScholarPaper) => paper.year).filter((year: number | undefined): year is number => year !== undefined);
      const yearRange = years.length > 0 ? {
        earliest: Math.min(...years),
        latest: Math.max(...years)
      } : null;
      
      // Get field distribution
      const fieldCounts: Record<string, number> = {};
      processedPapers.forEach((paper: SemanticScholarPaper) => {
        paper.fieldsOfStudy?.forEach((field: string) => {
          fieldCounts[field] = (fieldCounts[field] || 0) + 1;
        });
      });
      
      return {
        success: true,
        authorId,
        totalPapers: processedPapers.length,
        papers: processedPapers,
        summary: {
          totalCitations,
          yearRange,
          topFields: Object.entries(fieldCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([field, count]) => ({ field, count }))
        },
        pagination: {
          limit,
          offset,
          hasMore: processedPapers.length === limit
        }
      };
    } catch (error: unknown) {
      return {
        success: false,
        authorId,
        ...formatError(error)
      };
    }
  },
});