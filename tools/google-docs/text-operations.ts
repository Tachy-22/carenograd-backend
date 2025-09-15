import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import { formatError } from '../../types/common';
import { getAccessToken } from '../../utils/auth-context';

export const insertTextTool = tool({
  description: 'Insert text at a specific location in a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    text: z.string().describe('The text to insert'),
    index: z.number().describe('The location to insert the text (0-based index)'),
    tabId: z.string().optional().describe('The tab ID if inserting in a specific tab'),
  }),
  execute: async ({ documentId, text, index, tabId }) => {
    try {
      const location = tabId ? { tabId, index } : { index };

      const request = {
        requests: [
          {
            insertText: {
              location: location,
              text: text
            }
          }
        ]
      };

      const response = await axios.post(
        `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
        request,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        documentId: response.data.documentId,
        insertedText: text,
        insertIndex: index,
        tabId: tabId,
        replies: response.data.replies || []
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const replaceTextTool = tool({
  description: 'Replace all instances of specific text in a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    containsText: z.string().describe('The text to find and replace'),
    replaceText: z.string().describe('The replacement text'),
    matchCase: z.boolean().optional().describe('Whether to match case when finding text'),
    tabId: z.string().optional().describe('The tab ID to limit the replacement to a specific tab'),
  }),
  execute: async ({ documentId, containsText, replaceText, matchCase, tabId }) => {
    try {
      const replaceAllTextRequest: Record<string, unknown> = {
        containsText: {
          text: containsText,
          matchCase: matchCase || false
        },
        replaceText: replaceText
      };

      if (tabId) {
        replaceAllTextRequest.tabId = tabId;
      }

      const request = {
        requests: [
          {
            replaceAllText: replaceAllTextRequest
          }
        ]
      };

      const response = await axios.post(
        `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
        request,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const replaceAllTextReply = response.data.replies?.[0]?.replaceAllText;

      return {
        success: true,
        documentId: response.data.documentId,
        searchText: containsText,
        replacementText: replaceText,
        occurrencesChanged: replaceAllTextReply?.occurrencesChanged || 0,
        tabId: tabId,
        matchCase: matchCase || false
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const deleteContentTool = tool({
  description: 'Delete a range of content from a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    startIndex: z.number().describe('The start index of the range to delete (0-based, inclusive)'),
    endIndex: z.number().describe('The end index of the range to delete (0-based, exclusive)'),
    tabId: z.string().optional().describe('The tab ID if deleting from a specific tab'),
  }),
  execute: async ({ documentId, startIndex, endIndex, tabId }) => {
    try {
      const range = tabId
        ? { tabId, startIndex, endIndex }
        : { startIndex, endIndex };

      const request = {
        requests: [
          {
            deleteContentRange: {
              range: range
            }
          }
        ]
      };

      const response = await axios.post(
        `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
        request,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        documentId: response.data.documentId,
        deletedRange: {
          startIndex,
          endIndex,
          length: endIndex - startIndex
        },
        tabId: tabId,
        replies: response.data.replies || []
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const insertPageBreakTool = tool({
  description: 'Insert a page break at a specific location in a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    index: z.number().describe('The location to insert the page break (0-based index)'),
    tabId: z.string().optional().describe('The tab ID if inserting in a specific tab'),
  }),
  execute: async ({ documentId, index, tabId }) => {
    try {
      const location = tabId ? { tabId, index } : { index };

      const request = {
        requests: [
          {
            insertPageBreak: {
              location: location
            }
          }
        ]
      };

      const response = await axios.post(
        `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
        request,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        documentId: response.data.documentId,
        pageBreakIndex: index,
        tabId: tabId,
        replies: response.data.replies || []
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});