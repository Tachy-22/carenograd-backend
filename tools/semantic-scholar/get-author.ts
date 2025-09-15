import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import type { SemanticScholarPaper, SemanticScholarAuthor } from '../../types/semantic-scholar';
import { formatError } from '../../types/common';

export const getAuthorTool = tool({
  description: 'Get detailed information about a specific author using their Semantic Scholar ID. Returns comprehensive author profile including publications.',
  inputSchema: z.object({
    authorId: z.string().describe('Semantic Scholar author ID (e.g., "1741101")'),
    fields: z.array(z.string()).optional().default(['url', 'name', 'affiliations', 'homepage', 'paperCount', 'citationCount', 'hIndex', 'papers']).describe('Fields to include in response'),
    paperFields: z.array(z.string()).optional().default(['title', 'abstract', 'year', 'citationCount', 'referenceCount', 'fieldsOfStudy']).describe('Fields to include for each paper'),
    paperLimit: z.number().min(1).max(100).optional().default(20).describe('Maximum number of papers to return'),
  }),
  execute: async ({ authorId, fields, paperFields, paperLimit }) => {
    try {
      const baseUrl = `https://api.semanticscholar.org/graph/v1/author/${authorId}`;
      const params = new URLSearchParams();
      
      if (fields && fields.length > 0) {
        // Add paper fields to the main fields if papers are requested
        const allFields = [...fields];
        if (fields.includes('papers') && paperFields && paperFields.length > 0) {
          const paperFieldsStr = paperFields.map(field => `papers.${field}`).join(',');
          const otherFields = fields.filter(f => f !== 'papers');
          params.append('fields', [...otherFields, paperFieldsStr].join(','));
        } else {
          params.append('fields', fields.join(','));
        }
      }
      
      if (paperLimit) {
        params.append('limit', paperLimit.toString());
      }
      
      const response = await axios.get(`${baseUrl}?${params}`, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Academic-Research-Agent/1.0'
        }
      });
      
      const author = response.data;
      
      // Process papers if included
      let processedPapers = [];
      if (author.papers) {
        processedPapers = author.papers.slice(0, paperLimit).map((paper: SemanticScholarPaper) => ({
          paperId: paper.paperId,
          title: paper.title,
          abstract: paper.abstract,
          year: paper.year,
          citationCount: paper.citationCount,
          referenceCount: paper.referenceCount,
          fieldsOfStudy: paper.fieldsOfStudy || [],
          authors: paper.authors?.map((a: SemanticScholarAuthor) => a.name) || []
        }));
      }
      
      return {
        success: true,
        authorId,
        author: {
          authorId: author.authorId,
          name: author.name,
          url: author.url,
          affiliations: author.affiliations || [],
          homepage: author.homepage,
          paperCount: author.paperCount,
          citationCount: author.citationCount,
          hIndex: author.hIndex,
          papers: processedPapers
        },
        totalPapers: processedPapers.length
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