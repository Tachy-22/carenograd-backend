import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import { formatError } from '../../types/common';
import { getAccessToken } from '../../utils/auth-context';

export const createNamedRangeTool = tool({
  description: 'Create a named range in a Google Docs document for easy reference and navigation',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    name: z.string().describe('The name for the range'),
    startIndex: z.number().describe('The start index of the range (0-based, inclusive)'),
    endIndex: z.number().describe('The end index of the range (0-based, exclusive)'),
    tabId: z.string().optional().describe('The tab ID if creating named range in a specific tab'),
  }),
  execute: async ({ documentId, name, startIndex, endIndex, tabId }) => {
    try {
      const range = tabId
        ? { tabId, startIndex, endIndex }
        : { startIndex, endIndex };

      const request = {
        requests: [
          {
            createNamedRange: {
              name: name,
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

      const createNamedRangeReply = response.data.replies?.[0]?.createNamedRange;

      return {
        success: true,
        documentId: response.data.documentId,
        createdNamedRange: {
          namedRangeId: createNamedRangeReply?.namedRangeId,
          name: name,
          range: {
            startIndex,
            endIndex,
            length: endIndex - startIndex
          }
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

export const deleteNamedRangeTool = tool({
  description: 'Delete a named range from a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    namedRangeId: z.string().optional().describe('The ID of the named range to delete'),
    name: z.string().optional().describe('The name of the named range to delete (alternative to namedRangeId)'),
    tabId: z.string().optional().describe('The tab ID if deleting named range from a specific tab'),
  }),
  execute: async ({ documentId, namedRangeId, name, tabId }) => {
    try {
      if (!namedRangeId && !name) {
        return {
          success: false,
          error: 'Either namedRangeId or name must be provided'
        };
      }

      const deleteNamedRangeRequest: Record<string, unknown> = {};

      if (namedRangeId) {
        deleteNamedRangeRequest.namedRangeId = namedRangeId;
      } else if (name) {
        deleteNamedRangeRequest.name = name;
      }

      if (tabId) {
        deleteNamedRangeRequest.tabId = tabId;
      }

      const request = {
        requests: [
          {
            deleteNamedRange: deleteNamedRangeRequest
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
        deletedNamedRange: {
          namedRangeId: namedRangeId,
          name: name
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

export const replaceNamedRangeContentTool = tool({
  description: 'Replace the content of a named range in a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    namedRangeId: z.string().optional().describe('The ID of the named range to replace content in'),
    namedRangeName: z.string().optional().describe('The name of the named range to replace content in (alternative to namedRangeId)'),
    text: z.string().describe('The new text content for the named range'),
    tabId: z.string().optional().describe('The tab ID if replacing content in a specific tab'),
  }),
  execute: async ({ documentId, namedRangeId, namedRangeName, text, tabId }) => {
    try {
      if (!namedRangeId && !namedRangeName) {
        return {
          success: false,
          error: 'Either namedRangeId or namedRangeName must be provided'
        };
      }

      const replaceNamedRangeContentRequest: Record<string, unknown> = {
        text: text
      };

      if (namedRangeId) {
        replaceNamedRangeContentRequest.namedRangeId = namedRangeId;
      } else if (namedRangeName) {
        replaceNamedRangeContentRequest.namedRangeName = namedRangeName;
      }

      if (tabId) {
        replaceNamedRangeContentRequest.tabId = tabId;
      }

      const request = {
        requests: [
          {
            replaceNamedRangeContent: replaceNamedRangeContentRequest
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
        replacedNamedRange: {
          namedRangeId: namedRangeId,
          namedRangeName: namedRangeName,
          newText: text
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