import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import { getAccessToken } from '../../utils/auth-context';

export const createDocumentTool = tool({
  description: 'Create a new Google Docs document with specified title and optional initial content',
  inputSchema: z.object({
    title: z.string().describe('The title of the new document'),
  }),
  execute: async ({ title }) => {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return { success: false, error: 'Google access token not found in environment variables' };
    }
    try {
      const response = await axios.post(
        'https://docs.googleapis.com/v1/documents',
        {
          title: title
        },
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const document = response.data;

      return {
        success: true,
        documentId: document.documentId,
        title: document.title,
        documentUrl: `https://docs.google.com/document/d/${document.documentId}/edit`,
        revisionId: document.revisionId,
        createdTime: new Date().toISOString()
      };
    } catch (error: unknown) {
      const err = error as Error & { response?: { status?: number; data?: unknown } };
      return {
        success: false,
        error: err.message || 'Unknown error occurred',
        statusCode: err.response?.status,
        details: err.response?.data
      };
    }
  }
});

export const getDocumentTool = tool({
  description: 'Get the contents and metadata of a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document to retrieve'),
    includeTabsContent: z.boolean().optional().describe('Whether to include content from all tabs'),
    suggestionsViewMode: z.enum(['DEFAULT_FOR_CURRENT_ACCESS', 'SUGGESTIONS_INLINE', 'PREVIEW_SUGGESTIONS_ACCEPTED', 'PREVIEW_WITHOUT_SUGGESTIONS']).optional().describe('The suggestions view mode')
  }),
  execute: async ({ documentId, includeTabsContent, suggestionsViewMode }) => {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return { success: false, error: 'Google access token not found in environment variables' };
    }
    try {
      const params = new URLSearchParams();

      if (includeTabsContent) {
        params.append('includeTabsContent', 'true');
      }

      if (suggestionsViewMode) {
        params.append('suggestionsViewMode', suggestionsViewMode);
      }

      const url = `https://docs.googleapis.com/v1/documents/${documentId}${params.toString() ? '?' + params.toString() : ''}`;

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${await getAccessToken()}`,
        }
      });

      const document = response.data;

      return {
        success: true,
        documentId: document.documentId,
        title: document.title,
        body: document.body,
        headers: document.headers,
        footers: document.footers,
        footnotes: document.footnotes,
        documentStyle: document.documentStyle,
        namedStyles: document.namedStyles,
        lists: document.lists,
        revisionId: document.revisionId,
        suggestionsViewMode: document.suggestionsViewMode,
        namedRanges: document.namedRanges,
        tabs: document.tabs,
        documentUrl: `https://docs.google.com/document/d/${documentId}/edit`
      };
    } catch (error: unknown) {
      const err = error as Error & { response?: { status?: number; data?: unknown } };
      return {
        success: false,
        error: err.message || 'Unknown error occurred',
        statusCode: err.response?.status,
        details: err.response?.data
      };
    }
  }
});