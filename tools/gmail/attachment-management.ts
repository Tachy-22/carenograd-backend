import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import type { AttachmentInfo, DownloadedAttachment, FailedDownload, HeadersMap, GmailHeader } from '../../types/gmail';
import { formatError } from '../../types/common';
import { getAccessToken } from '../../utils/auth-context';

export const getAttachmentTool = tool({
  description: 'Download an attachment from a Gmail message',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    messageId: z.string().describe('The ID of the message containing the attachment'),
    attachmentId: z.string().describe('The ID of the attachment to download'),
  }),
  execute: async ({ userId, messageId, attachmentId }) => {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return { success: false, error: 'Google access token not found in environment variables' };
    }
    try {
      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/${messageId}/attachments/${attachmentId}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      return {
        success: true,
        attachment: {
          attachmentId: attachmentId,
          data: response.data.data,
          size: response.data.size
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

export const listAttachmentsTool = tool({
  description: 'List all attachments in a Gmail message',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    messageId: z.string().describe('The ID of the message to list attachments from'),
  }),
  execute: async ({ userId, messageId }) => {
    const accessToken = await getAccessToken()

    if (!accessToken) {
      return { success: false, error: 'Google access token not found in environment variables' };
    }
    try {
      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/${messageId}?format=full`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      const message = response.data;
      const attachments: AttachmentInfo[] = [];

      // Function to recursively find attachments in message parts
      const findAttachments = (parts: unknown[]) => {
        parts?.forEach((part: unknown) => {
          const messagePart = part as { filename?: string; mimeType?: string; body?: { attachmentId?: string; size?: number }; partId?: string; parts?: unknown[] };
          if (messagePart.filename && messagePart.body?.attachmentId) {
            attachments.push({
              filename: messagePart.filename,
              mimeType: messagePart.mimeType || 'application/octet-stream',
              attachmentId: messagePart.body.attachmentId,
              size: messagePart.body.size || 0,
              partId: messagePart.partId
            });
          }

          if (messagePart.parts) {
            findAttachments(messagePart.parts);
          }
        });
      };

      // Check main payload
      if (message.payload) {
        if (message.payload.filename && message.payload.body?.attachmentId) {
          attachments.push({
            filename: message.payload.filename,
            mimeType: message.payload.mimeType,
            attachmentId: message.payload.body.attachmentId,
            size: message.payload.body.size || 0,
            partId: message.payload.partId
          });
        }

        if (message.payload.parts) {
          findAttachments(message.payload.parts);
        }
      }

      return {
        success: true,
        messageId: messageId,
        attachments: attachments,
        attachmentCount: attachments.length
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const downloadAllAttachmentsTool = tool({
  description: 'Download all attachments from a Gmail message',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    messageId: z.string().describe('The ID of the message to download attachments from'),
  }),
  execute: async ({ userId, messageId }) => {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return { success: false, error: 'Google access token not found in environment variables' };
    }
    try {
      // First, list all attachments
      const listResponse = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/${messageId}?format=full`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      const message = listResponse.data;
      const attachmentList: AttachmentInfo[] = [];

      // Function to recursively find attachments in message parts
      const findAttachments = (parts: unknown[]) => {
        parts?.forEach((part: unknown) => {
          const messagePart = part as { filename?: string; mimeType?: string; body?: { attachmentId?: string; size?: number }; partId?: string; parts?: unknown[] };
          if (messagePart.filename && messagePart.body?.attachmentId) {
            attachmentList.push({
              filename: messagePart.filename,
              mimeType: messagePart.mimeType || 'application/octet-stream',
              attachmentId: messagePart.body.attachmentId,
              size: messagePart.body.size || 0
            });
          }

          if (messagePart.parts) {
            findAttachments(messagePart.parts);
          }
        });
      };

      if (message.payload?.parts) {
        findAttachments(message.payload.parts);
      }

      if (attachmentList.length === 0) {
        return {
          success: true,
          messageId: messageId,
          attachments: [],
          message: 'No attachments found in this message'
        };
      }

      // Download all attachments
      const downloadedAttachments: DownloadedAttachment[] = [];
      const failedDownloads: FailedDownload[] = [];

      for (const attachment of attachmentList) {
        try {
          const downloadResponse = await axios.get(
            `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/${messageId}/attachments/${attachment.attachmentId}`,
            {
              headers: {
                'Authorization': `Bearer ${await getAccessToken()}`,
              }
            }
          );

          downloadedAttachments.push({
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            attachmentId: attachment.attachmentId,
            size: attachment.size,
            data: downloadResponse.data.data
          });
        } catch (downloadError: unknown) {
          failedDownloads.push({
            filename: attachment.filename,
            attachmentId: attachment.attachmentId,
            error: downloadError instanceof Error ? downloadError.message : String(downloadError)
          });
        }
      }

      return {
        success: true,
        messageId: messageId,
        attachments: downloadedAttachments,
        failedDownloads: failedDownloads,
        totalAttachments: attachmentList.length,
        successfulDownloads: downloadedAttachments.length,
        failedDownloadsCount: failedDownloads.length
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const saveAttachmentTool = tool({
  description: 'Save an attachment from Gmail to a specific location (returns base64 data for saving)',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    messageId: z.string().describe('The ID of the message containing the attachment'),
    attachmentId: z.string().describe('The ID of the attachment to save'),
    filename: z.string().optional().describe('Custom filename for the saved attachment'),
  }),
  execute: async ({ userId, messageId, attachmentId, filename }) => {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return { success: false, error: 'Google access token not found in environment variables' };
    }
    try {
      // Get attachment data
      const attachmentResponse = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/${messageId}/attachments/${attachmentId}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      // Get message details to get original filename if not provided
      let originalFilename = filename;
      if (!filename) {
        const messageResponse = await axios.get(
          `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/${messageId}?format=full`,
          {
            headers: {
              'Authorization': `Bearer ${await getAccessToken()}`,
            }
          }
        );

        const findAttachmentFilename = (parts: unknown[]): string => {
          for (const part of parts || []) {
            const messagePart = part as { filename?: string; body?: { attachmentId?: string }; parts?: unknown[] };
            if (messagePart.body?.attachmentId === attachmentId && messagePart.filename) {
              return messagePart.filename;
            }
            if (messagePart.parts) {
              const found = findAttachmentFilename(messagePart.parts);
              if (found) return found;
            }
          }
          return `attachment_${attachmentId}`;
        };

        originalFilename = findAttachmentFilename(messageResponse.data.payload?.parts || []);
      }

      return {
        success: true,
        attachment: {
          attachmentId: attachmentId,
          filename: originalFilename,
          data: attachmentResponse.data.data,
          size: attachmentResponse.data.size,
          messageId: messageId
        },
        downloadInfo: {
          sizeBytes: attachmentResponse.data.size,
          base64Data: attachmentResponse.data.data,
          instructions: 'Use the base64Data to save the file to your desired location'
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

export const searchEmailsWithAttachmentsTool = tool({
  description: 'Search for Gmail messages that contain attachments',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    query: z.string().optional().describe('Additional search criteria (combined with has:attachment)'),
    maxResults: z.number().min(1).max(500).optional().describe('Maximum number of messages to return'),
    pageToken: z.string().optional().describe('Token for pagination from previous response'),
  }),
  execute: async ({ userId, query, maxResults, pageToken }) => {
    const accessToken = await getAccessToken()

    if (!accessToken) {
      return { success: false, error: 'Google access token not found in environment variables' };
    }
    try {
      const params = new URLSearchParams();

      // Base query for messages with attachments
      const attachmentQuery = query ? `has:attachment ${query}` : 'has:attachment';
      params.append('q', attachmentQuery);

      if (maxResults) params.append('maxResults', maxResults.toString());
      if (pageToken) params.append('pageToken', pageToken);

      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      // Get details for each message to include attachment info
      const messagesWithAttachments: Array<{ id: string; threadId: string; subject: string; from?: string; date?: string; snippet?: string; error?: string }> = [];
      const messages = response.data.messages || [];

      for (const message of messages.slice(0, Math.min(10, messages.length))) { // Limit to avoid too many requests
        try {
          const messageResponse = await axios.get(
            `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            {
              headers: {
                'Authorization': `Bearer ${await getAccessToken()}`,
              }
            }
          );

          const messageDetails = messageResponse.data;
          const headers: HeadersMap = {};

          messageDetails.payload?.headers?.forEach((header: GmailHeader) => {
            headers[header.name.toLowerCase()] = header.value;
          });

          messagesWithAttachments.push({
            id: message.id,
            threadId: message.threadId,
            subject: headers.subject || 'No Subject',
            from: headers.from,
            date: headers.date,
            snippet: messageDetails.snippet
          });
        } catch (messageError) {
          // Continue if individual message fetch fails
          messagesWithAttachments.push({
            id: message.id,
            threadId: message.threadId,
            subject: 'Could not fetch message details',
            error: 'Could not fetch message details'
          });
        }
      }

      return {
        success: true,
        messages: messagesWithAttachments,
        nextPageToken: response.data.nextPageToken,
        resultSizeEstimate: response.data.resultSizeEstimate,
        searchQuery: attachmentQuery,
        totalFound: response.data.messages?.length || 0
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});