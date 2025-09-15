import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import type { GmailMessage, GmailHeader, HeadersMap, ApiError, ModifyLabelsRequest, BatchModifyRequest } from '../../types/gmail';
import { formatError } from '../../types/common';
import { getAccessToken } from '../../utils/auth-context';

export const listEmailsTool = tool({
  description: 'List emails from a Gmail mailbox with filtering, searching, and pagination',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    query: z.string().optional().describe('Search query (e.g., "from:sender@example.com", "subject:meeting", "has:attachment")'),
    labelIds: z.array(z.string()).optional().describe('Array of label IDs to filter by'),
    maxResults: z.number().min(1).max(500).optional().describe('Maximum number of messages to return (default: 100, max: 500)'),
    pageToken: z.string().optional().describe('Token for pagination from previous response'),
    includeSpamTrash: z.boolean().optional().describe('Include messages from SPAM and TRASH'),
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

      const accessToken = await getAccessToken();
      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );

      return {
        success: true,
        messages: response.data.messages || [],
        nextPageToken: response.data.nextPageToken,
        resultSizeEstimate: response.data.resultSizeEstimate,
        totalMessages: response.data.messages?.length || 0
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const getEmailTool = tool({
  description: 'Get detailed information about a specific email message',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    messageId: z.string().describe('The ID of the message to retrieve'),
    format: z.enum(['minimal', 'full', 'raw', 'metadata']).optional().describe('The format to return the message in'),
    metadataHeaders: z.array(z.string()).optional().describe('Headers to include when format is metadata'),
  }),
  execute: async ({ userId, messageId, format, metadataHeaders }) => {
    try {
      const params = new URLSearchParams();

      if (format) params.append('format', format);
      if (metadataHeaders && metadataHeaders.length > 0) {
        metadataHeaders.forEach(header => params.append('metadataHeaders', header));
      }

      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/${messageId}?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      const message = response.data;

      // Parse headers if available
      const headers: HeadersMap = {};
      if (message.payload?.headers) {
        message.payload.headers.forEach((header: GmailHeader) => {
          headers[header.name.toLowerCase()] = header.value;
        });
      }

      return {
        success: true,
        message: {
          id: message.id,
          threadId: message.threadId,
          labelIds: message.labelIds || [],
          snippet: message.snippet,
          historyId: message.historyId,
          internalDate: message.internalDate,
          sizeEstimate: message.sizeEstimate,
          raw: message.raw,
          payload: message.payload,
          headers: headers,
          subject: headers.subject || 'No Subject',
          from: headers.from,
          to: headers.to,
          cc: headers.cc,
          bcc: headers.bcc,
          date: headers.date
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

export const deleteEmailTool = tool({
  description: 'Permanently delete an email message from Gmail',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    messageId: z.string().describe('The ID of the message to delete'),
  }),
  execute: async ({ userId, messageId }) => {
    try {
      await axios.delete(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/${messageId}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      return {
        success: true,
        messageId: messageId,
        message: 'Message permanently deleted'
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const trashEmailTool = tool({
  description: 'Move an email message to the trash',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    messageId: z.string().describe('The ID of the message to trash'),
  }),
  execute: async ({ userId, messageId }) => {
    try {
      const response = await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/${messageId}/trash`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      return {
        success: true,
        messageId: messageId,
        trashedMessage: {
          id: response.data.id,
          threadId: response.data.threadId,
          labelIds: response.data.labelIds
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

export const untrashEmailTool = tool({
  description: 'Remove an email message from the trash',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    messageId: z.string().describe('The ID of the message to untrash'),
  }),
  execute: async ({ userId, messageId }) => {
    try {
      const response = await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/${messageId}/untrash`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      return {
        success: true,
        messageId: messageId,
        untrashedMessage: {
          id: response.data.id,
          threadId: response.data.threadId,
          labelIds: response.data.labelIds
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

export const modifyEmailLabelsTool = tool({
  description: 'Add or remove labels from an email message',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    messageId: z.string().describe('The ID of the message to modify'),
    addLabelIds: z.array(z.string()).optional().describe('Array of label IDs to add'),
    removeLabelIds: z.array(z.string()).optional().describe('Array of label IDs to remove'),
  }),
  execute: async ({ userId, messageId, addLabelIds, removeLabelIds }) => {
    try {
      const requestBody: ModifyLabelsRequest = {};

      if (addLabelIds && addLabelIds.length > 0) {
        requestBody.addLabelIds = addLabelIds;
      }

      if (removeLabelIds && removeLabelIds.length > 0) {
        requestBody.removeLabelIds = removeLabelIds;
      }

      const response = await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/${messageId}/modify`,
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
        messageId: messageId,
        modifiedMessage: {
          id: response.data.id,
          threadId: response.data.threadId,
          labelIds: response.data.labelIds
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

export const batchDeleteEmailsTool = tool({
  description: 'Permanently delete multiple email messages at once',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    messageIds: z.array(z.string()).describe('Array of message IDs to delete'),
  }),
  execute: async ({ userId, messageIds }) => {
    try {
      await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/batchDelete`,
        {
          ids: messageIds
        },
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        deletedMessageIds: messageIds,
        deletedCount: messageIds.length,
        message: `Successfully deleted ${messageIds.length} messages`
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const batchModifyEmailsTool = tool({
  description: 'Modify labels for multiple email messages at once',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    messageIds: z.array(z.string()).describe('Array of message IDs to modify'),
    addLabelIds: z.array(z.string()).optional().describe('Array of label IDs to add to all messages'),
    removeLabelIds: z.array(z.string()).optional().describe('Array of label IDs to remove from all messages'),
  }),
  execute: async ({ userId, messageIds, addLabelIds, removeLabelIds }) => {
    try {
      const requestBody: BatchModifyRequest = {
        ids: messageIds
      };

      if (addLabelIds && addLabelIds.length > 0) {
        requestBody.addLabelIds = addLabelIds;
      }

      if (removeLabelIds && removeLabelIds.length > 0) {
        requestBody.removeLabelIds = removeLabelIds;
      }

      await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/batchModify`,
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
        modifiedMessageIds: messageIds,
        modifiedCount: messageIds.length,
        addedLabels: addLabelIds || [],
        removedLabels: removeLabelIds || [],
        message: `Successfully modified ${messageIds.length} messages`
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});