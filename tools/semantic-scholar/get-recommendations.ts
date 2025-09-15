import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import type { SemanticScholarPaper, SemanticScholarAuthor } from '../../types/semantic-scholar';
import { formatError } from '../../types/common';

export const getRecommendationsTool = tool({
  description: 'Get paper recommendations based on one or more seed papers using Semantic Scholar\'s recommendation engine. Perfect for finding related research.',
  inputSchema: z.object({
    paperIds: z.array(z.string()).min(1).max(500).describe('List of seed paper IDs or DOIs to base recommendations on'),
    limit: z.number().min(1).max(500).optional().default(10).describe('Maximum number of recommendations to return (1-500)'),
    fields: z.array(z.string()).optional().default(['title', 'abstract', 'authors', 'year', 'citationCount', 'fieldsOfStudy', 'url']).describe('Fields to include for each recommended paper'),
  }),
  execute: async ({ paperIds, limit, fields }) => {
    try {
      const baseUrl = 'https://api.semanticscholar.org/recommendations/v1/papers';
      
      const requestBody = {
        positivePaperIds: paperIds,
        negativePaperIds: [] // Could be extended to exclude certain papers
      };
      
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      
      if (fields && fields.length > 0) {
        params.append('fields', fields.join(','));
      }
      
      const response = await axios.post(`${baseUrl}?${params}`, requestBody, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Academic-Research-Agent/1.0',
          'Content-Type': 'application/json'
        }
      });
      
      const recommendations = response.data?.recommendedPapers || [];
      
      const processedRecommendations = recommendations.map((paper: SemanticScholarPaper) => ({
        paperId: paper.paperId,
        title: paper.title,
        abstract: paper.abstract,
        url: paper.url,
        year: paper.year,
        citationCount: paper.citationCount,
        fieldsOfStudy: paper.fieldsOfStudy || [],
        authors: paper.authors?.map((author: SemanticScholarAuthor) => ({
          authorId: author.authorId,
          name: author.name
        })) || []
      }));
      
      // Analyze recommended papers
      const fieldCounts: Record<string, number> = {};
      const yearCounts: Record<number, number> = {};
      
      processedRecommendations.forEach((paper: SemanticScholarPaper) => {
        // Count fields of study
        paper.fieldsOfStudy?.forEach((field: string) => {
          fieldCounts[field] = (fieldCounts[field] || 0) + 1;
        });
        
        // Count years
        if (paper.year) {
          yearCounts[paper.year] = (yearCounts[paper.year] || 0) + 1;
        }
      });
      
      return {
        success: true,
        seedPapers: paperIds.length,
        totalRecommendations: processedRecommendations.length,
        recommendations: processedRecommendations,
        analysis: {
          topFields: Object.entries(fieldCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([field, count]) => ({ field, count })),
          yearDistribution: Object.entries(yearCounts)
            .sort(([a,], [b,]) => parseInt(b) - parseInt(a))
            .slice(0, 10)
            .map(([year, count]) => ({ year: parseInt(year), count }))
        }
      };
    } catch (error: unknown) {
      return {
        success: false,
        seedPapers: paperIds.length,
        ...formatError(error)
      };
    }
  },
});