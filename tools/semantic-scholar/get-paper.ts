import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import type { SemanticScholarPaper, SemanticScholarAuthor } from '../../types/semantic-scholar';
import { formatError } from '../../types/common';

export const getPaperTool = tool({
  description: 'Get detailed information about a specific paper using its Semantic Scholar ID or DOI. Returns comprehensive paper details including citations and references.',
  inputSchema: z.object({
    paperId: z.string().describe('Semantic Scholar paper ID or DOI (e.g., "649def34f8be52c8b66281af98ae884c09aef38b")'),
    fields: z.array(z.string()).optional().default(['title', 'abstract', 'authors', 'year', 'citationCount', 'referenceCount', 'fieldsOfStudy', 'url', 'venue', 'publicationDate', 'citations', 'references']).describe('Fields to include in response'),
    citationLimit: z.number().min(1).max(100).optional().default(10).describe('Maximum number of citations to return'),
    referenceLimit: z.number().min(1).max(100).optional().default(10).describe('Maximum number of references to return'),
  }),
  execute: async ({ paperId, fields, citationLimit, referenceLimit }) => {
    try {
      const baseUrl = `https://api.semanticscholar.org/graph/v1/paper/${paperId}`;
      const params = new URLSearchParams();
      
      if (fields && fields.length > 0) {
        params.append('fields', fields.join(','));
      }
      
      const response = await axios.get(`${baseUrl}?${params}`, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Academic-Research-Agent/1.0'
        }
      });
      
      const paper = response.data;
      
      // Process citations
      let processedCitations = [];
      if (paper.citations) {
        processedCitations = paper.citations.slice(0, citationLimit).map((citation: SemanticScholarPaper) => ({
          paperId: citation.paperId,
          title: citation.title,
          year: citation.year,
          authors: citation.authors?.map((author: SemanticScholarAuthor) => author.name) || []
        }));
      }
      
      // Process references
      let processedReferences = [];
      if (paper.references) {
        processedReferences = paper.references.slice(0, referenceLimit).map((reference: SemanticScholarPaper) => ({
          paperId: reference.paperId,
          title: reference.title,
          year: reference.year,
          authors: reference.authors?.map((author: SemanticScholarAuthor) => author.name) || []
        }));
      }
      
      return {
        success: true,
        paperId,
        paper: {
          paperId: paper.paperId,
          title: paper.title,
          abstract: paper.abstract,
          url: paper.url,
          year: paper.year,
          publicationDate: paper.publicationDate,
          venue: paper.venue,
          citationCount: paper.citationCount,
          referenceCount: paper.referenceCount,
          fieldsOfStudy: paper.fieldsOfStudy || [],
          authors: paper.authors?.map((author: SemanticScholarAuthor) => ({
            authorId: author.authorId,
            name: author.name
          })) || [],
          citations: processedCitations,
          references: processedReferences
        }
      };
    } catch (error: unknown) {
      return {
        success: false,
        paperId,
        ...formatError(error)
      };
    }
  },
});