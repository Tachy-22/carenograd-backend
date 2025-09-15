import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import type { GmailHeader, HeadersMap, ModifyLabelsRequest, GmailMessage } from '../../types/gmail';
import { formatError } from '../../types/common';
import { getAccessToken } from '../../utils/auth-context';

export const listThreadsTool = tool({
  description: 'List threads (email conversations) from Gmail with filtering and pagination',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    query: z.string().optional().describe('Search query (e.g., "from:sender@example.com", "subject:meeting")'),
    labelIds: z.array(z.string()).optional().describe('Array of label IDs to filter by'),
    maxResults: z.number().min(1).max(500).optional().describe('Maximum number of threads to return (default: 100, max: 500)'),
    pageToken: z.string().optional().describe('Token for pagination from previous response'),
    includeSpamTrash: z.boolean().optional().describe('Include threads from SPAM and TRASH'),
  }),
  execute: async ({ userId, query, labelIds, maxResults, pageToken, includeSpamTrash }) => {
    try {
      const params = new URLSearchParams();

      if (query) params.append('q', query);
      if (labelIds && labelIds.length > 0) {
        labelIds.forEach(labelId => params.append('labelIds', labelId));
      }
      if (maxResults) params.append('maxResults', maxResults.toString());
      if (pageToken) params.append('pageToken', pageToken);
      if (includeSpamTrash) params.append('includeSpamTrash', 'true');

      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/threads?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      return {
        success: true,
        threads: response.data.threads || [],
        nextPageToken: response.data.nextPageToken,
        resultSizeEstimate: response.data.resultSizeEstimate,
        totalThreads: response.data.threads?.length || 0
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const getThreadTool = tool({
  description: 'Get detailed information about a specific thread (conversation)',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    threadId: z.string().describe('The ID of the thread to retrieve'),
    format: z.enum(['minimal', 'full', 'metadata']).optional().describe('The format to return the messages in'),
    metadataHeaders: z.array(z.string()).optional().describe('Headers to include when format is metadata'),
  }),
  execute: async ({ userId, threadId, format, metadataHeaders }) => {
    try {
      const params = new URLSearchParams();

      if (format) params.append('format', format);
      if (metadataHeaders && metadataHeaders.length > 0) {
        metadataHeaders.forEach(header => params.append('metadataHeaders', header));
      }

      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/threads/${threadId}?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      const thread = response.data;

      // Parse messages in thread
      const messages = thread.messages?.map((message: GmailMessage) => {
        const headers: HeadersMap = {};
        if (message.payload?.headers) {
          message.payload.headers.forEach((header: GmailHeader) => {
            headers[header.name.toLowerCase()] = header.value;
          });
        }

        return {
          id: message.id,
          threadId: message.threadId,
          labelIds: message.labelIds || [],
          snippet: message.snippet,
          historyId: message.historyId,
          internalDate: message.internalDate,
          sizeEstimate: message.sizeEstimate,
          payload: message.payload,
          headers: headers,
          subject: headers.subject || 'No Subject',
          from: headers.from,
          to: headers.to,
          date: headers.date
        };
      }) || [];

      return {
        success: true,
        thread: {
          id: thread.id,
          historyId: thread.historyId,
          messages: messages,
          messageCount: messages.length
        }
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const deleteThreadTool = tool({
  description: 'Permanently delete an entire thread (conversation) from Gmail',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    threadId: z.string().describe('The ID of the thread to delete'),
  }),
  execute: async ({ userId, threadId }) => {
    try {
      await axios.delete(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/threads/${threadId}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      return {
        success: true,
        threadId: threadId,
        message: 'Thread permanently deleted'
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const trashThreadTool = tool({
  description: 'Move an entire thread (conversation) to the trash',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    threadId: z.string().describe('The ID of the thread to trash'),
  }),
  execute: async ({ userId, threadId }) => {
    try {
      const response = await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/threads/${threadId}/trash`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      return {
        success: true,
        threadId: threadId,
        trashedThread: {
          id: response.data.id,
          historyId: response.data.historyId,
          messages: response.data.messages?.map((msg: GmailMessage) => ({
            id: msg.id,
            labelIds: msg.labelIds
          })) || []
        }
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const untrashThreadTool = tool({
  description: 'Remove an entire thread (conversation) from the trash',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    threadId: z.string().describe('The ID of the thread to untrash'),
  }),
  execute: async ({ userId, threadId }) => {
    try {
      const response = await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/threads/${threadId}/untrash`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      return {
        success: true,
        threadId: threadId,
        untrashedThread: {
          id: response.data.id,
          historyId: response.data.historyId,
          messages: response.data.messages?.map((msg: GmailMessage) => ({
            id: msg.id,
            labelIds: msg.labelIds
          })) || []
        }
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const modifyThreadLabelsTool = tool({
  description: 'Add or remove labels from an entire thread (conversation)',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    threadId: z.string().describe('The ID of the thread to modify'),
    addLabelIds: z.array(z.string()).optional().describe('Array of label IDs to add'),
    removeLabelIds: z.array(z.string()).optional().describe('Array of label IDs to remove'),
  }),
  execute: async ({ userId, threadId, addLabelIds, removeLabelIds }) => {
    try {
      const requestBody: ModifyLabelsRequest = {};

      if (addLabelIds && addLabelIds.length > 0) {
        requestBody.addLabelIds = addLabelIds;
      }

      if (removeLabelIds && removeLabelIds.length > 0) {
        requestBody.removeLabelIds = removeLabelIds;
      }

      const response = await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/threads/${threadId}/modify`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        threadId: threadId,
        modifiedThread: {
          id: response.data.id,
          historyId: response.data.historyId,
          messages: response.data.messages?.map((msg: GmailMessage) => ({
            id: msg.id,
            labelIds: msg.labelIds
          })) || []
        },
        addedLabels: addLabelIds || [],
        removedLabels: removeLabelIds || []
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const searchThreadsTool = tool({
  description: 'Search for threads using advanced Gmail search queries',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    searchQuery: z.string().describe('Gmail search query (e.g., "from:example.com", "has:attachment older_than:1y")'),
    maxResults: z.number().min(1).max(100).optional().describe('Maximum number of threads to return'),
    includeDetails: z.boolean().default(false).describe('Whether to include detailed message info for each thread'),
  }),
  execute: async ({ userId, searchQuery, maxResults, includeDetails }) => {
    try {
      const params = new URLSearchParams();
      params.append('q', searchQuery);
      if (maxResults) params.append('maxResults', maxResults.toString());

      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/threads?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      const threads = response.data.threads || [];
      const detailedThreads: Array<{ id: string; historyId?: string; messageCount: number; subject: string; participants?: string; lastMessageDate?: string; snippet?: string; error?: string }> = [];

      if (includeDetails && threads.length > 0) {
        // Get details for first few threads to avoid overwhelming response
        const threadsToDetail = threads.slice(0, Math.min(5, threads.length));

        for (const thread of threadsToDetail) {
          try {
            const detailResponse = await axios.get(
              `https://gmail.googleapis.com/gmail/v1/users/${userId}/threads/${thread.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
              {
                headers: {
                  'Authorization': `Bearer ${await getAccessToken()}`,
                }
              }
            );

            const threadData = detailResponse.data;
            const lastMessage = threadData.messages?.[threadData.messages.length - 1];
            const headers: HeadersMap = {};

            if (lastMessage?.payload?.headers) {
              lastMessage.payload.headers.forEach((header: GmailHeader) => {
                headers[header.name.toLowerCase()] = header.value;
              });
            }

            detailedThreads.push({
              id: thread.id,
              historyId: thread.historyId,
              messageCount: threadData.messages?.length || 0,
              subject: headers.subject || 'No Subject',
              participants: headers.from,
              lastMessageDate: headers.date,
              snippet: lastMessage?.snippet
            });
          } catch (detailError) {
            detailedThreads.push({
              id: thread.id,
              historyId: thread.historyId,
              messageCount: 0,
              subject: 'Unknown',
              error: 'Could not fetch thread details'
            });
          }
        }
      }

      return {
        success: true,
        searchQuery: searchQuery,
        threads: includeDetails ? detailedThreads : threads,
        nextPageToken: response.data.nextPageToken,
        resultSizeEstimate: response.data.resultSizeEstimate,
        totalFound: threads.length,
        includeDetails: includeDetails
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});