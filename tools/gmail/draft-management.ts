import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import type { GmailHeader, HeadersMap, EmailRequestBody } from '../../types/gmail';
import { formatError } from '../../types/common';
import { getAccessToken } from '../../utils/auth-context';

export const listDraftsTool = tool({
  description: 'List all draft messages in Gmail',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    maxResults: z.number().min(1).max(500).optional().describe('Maximum number of drafts to return (default: 100, max: 500)'),
    pageToken: z.string().optional().describe('Token for pagination from previous response'),
    query: z.string().optional().describe('Search query to filter drafts'),
    includeSpamTrash: z.boolean().optional().describe('Include drafts from SPAM and TRASH'),
  }),
  execute: async ({ userId, maxResults, pageToken, query, includeSpamTrash }) => {
    try {
      const params = new URLSearchParams();

      if (maxResults) params.append('maxResults', maxResults.toString());
      if (pageToken) params.append('pageToken', pageToken);
      if (query) params.append('q', query);
      if (includeSpamTrash) params.append('includeSpamTrash', 'true');

      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/drafts?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      return {
        success: true,
        drafts: response.data.drafts || [],
        nextPageToken: response.data.nextPageToken,
        resultSizeEstimate: response.data.resultSizeEstimate,
        totalDrafts: response.data.drafts?.length || 0
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const getDraftTool = tool({
  description: 'Get detailed information about a specific draft message',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    draftId: z.string().describe('The ID of the draft to retrieve'),
    format: z.enum(['minimal', 'full', 'raw', 'metadata']).optional().describe('The format to return the draft in'),
  }),
  execute: async ({ userId, draftId, format }) => {
    try {
      const params = new URLSearchParams();
      if (format) params.append('format', format);

      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/drafts/${draftId}?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      const draft = response.data;
      const message = draft.message;

      // Parse headers if available
      const headers: HeadersMap = {};
      if (message?.payload?.headers) {
        message.payload.headers.forEach((header: GmailHeader) => {
          headers[header.name.toLowerCase()] = header.value;
        });
      }

      return {
        success: true,
        draft: {
          id: draft.id,
          message: {
            id: message?.id,
            threadId: message?.threadId,
            labelIds: message?.labelIds || [],
            snippet: message?.snippet,
            payload: message?.payload,
            sizeEstimate: message?.sizeEstimate,
            historyId: message?.historyId,
            internalDate: message?.internalDate
          },
          headers: headers,
          to: headers.to,
          cc: headers.cc,
          bcc: headers.bcc,
          subject: headers.subject || 'No Subject',
          from: headers.from
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

export const createDraftTool = tool({
  description: 'Create a new draft email message',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    to: z.array(z.string()).describe('Array of recipient email addresses'),
    cc: z.array(z.string()).optional().describe('Array of CC recipient email addresses'),
    bcc: z.array(z.string()).optional().describe('Array of BCC recipient email addresses'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body content'),
    bodyType: z.enum(['text', 'html']).default('text').describe('Content type of the email body'),
    attachments: z.array(z.object({
      filename: z.string().describe('Name of the attachment file'),
      content: z.string().describe('Base64 encoded content of the attachment'),
      mimeType: z.string().describe('MIME type of the attachment')
    })).optional().describe('Array of attachments'),
    threadId: z.string().optional().describe('Thread ID if replying to an existing thread'),
  }),
  execute: async ({ userId, to, cc, bcc, subject, body, bodyType, attachments, threadId }) => {
    try {
      // Construct email headers
      const headers = [
        `To: ${to.join(', ')}`,
        ...(cc && cc.length > 0 ? [`Cc: ${cc.join(', ')}`] : []),
        ...(bcc && bcc.length > 0 ? [`Bcc: ${bcc.join(', ')}`] : []),
        `Subject: ${subject}`,
        'MIME-Version: 1.0'
      ];

      let emailBody = '';

      if (attachments && attachments.length > 0) {
        // Multipart email with attachments
        const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

        emailBody = `\n--${boundary}\n`;
        emailBody += `Content-Type: ${bodyType === 'html' ? 'text/html' : 'text/plain'}; charset="UTF-8"\n`;
        emailBody += 'Content-Transfer-Encoding: 7bit\n\n';
        emailBody += `${body}\n`;

        // Add attachments
        attachments.forEach(attachment => {
          emailBody += `\n--${boundary}\n`;
          emailBody += `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"\n`;
          emailBody += 'Content-Transfer-Encoding: base64\n';
          emailBody += `Content-Disposition: attachment; filename="${attachment.filename}"\n\n`;
          emailBody += `${attachment.content}\n`;
        });

        emailBody += `\n--${boundary}--`;
      } else {
        // Simple text/html email
        headers.push(`Content-Type: ${bodyType === 'html' ? 'text/html' : 'text/plain'}; charset="UTF-8"`);
        headers.push('Content-Transfer-Encoding: 7bit');
        emailBody = `\n\n${body}`;
      }

      // Combine headers and body
      const rawEmail = headers.join('\n') + emailBody;
      const encodedEmail = Buffer.from(rawEmail).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      const requestBody: EmailRequestBody = {
        message: {
          raw: encodedEmail
        }
      };

      if (threadId) {
        requestBody.threadId = threadId;
      }

      const response = await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/drafts`,
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
        createdDraft: {
          id: response.data.id,
          message: {
            id: response.data.message?.id,
            threadId: response.data.message?.threadId,
            labelIds: response.data.message?.labelIds || []
          }
        },
        recipients: {
          to: to,
          cc: cc || [],
          bcc: bcc || []
        },
        subject: subject,
        attachmentCount: attachments?.length || 0
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const updateDraftTool = tool({
  description: 'Update an existing draft email message',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    draftId: z.string().describe('The ID of the draft to update'),
    to: z.array(z.string()).describe('Array of recipient email addresses'),
    cc: z.array(z.string()).optional().describe('Array of CC recipient email addresses'),
    bcc: z.array(z.string()).optional().describe('Array of BCC recipient email addresses'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body content'),
    bodyType: z.enum(['text', 'html']).default('text').describe('Content type of the email body'),
    attachments: z.array(z.object({
      filename: z.string().describe('Name of the attachment file'),
      content: z.string().describe('Base64 encoded content of the attachment'),
      mimeType: z.string().describe('MIME type of the attachment')
    })).optional().describe('Array of attachments'),
  }),
  execute: async ({ userId, draftId, to, cc, bcc, subject, body, bodyType, attachments }) => {
    try {
      // Construct email headers
      const headers = [
        `To: ${to.join(', ')}`,
        ...(cc && cc.length > 0 ? [`Cc: ${cc.join(', ')}`] : []),
        ...(bcc && bcc.length > 0 ? [`Bcc: ${bcc.join(', ')}`] : []),
        `Subject: ${subject}`,
        'MIME-Version: 1.0'
      ];

      let emailBody = '';

      if (attachments && attachments.length > 0) {
        // Multipart email with attachments
        const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

        emailBody = `\n--${boundary}\n`;
        emailBody += `Content-Type: ${bodyType === 'html' ? 'text/html' : 'text/plain'}; charset="UTF-8"\n`;
        emailBody += 'Content-Transfer-Encoding: 7bit\n\n';
        emailBody += `${body}\n`;

        // Add attachments
        attachments.forEach(attachment => {
          emailBody += `\n--${boundary}\n`;
          emailBody += `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"\n`;
          emailBody += 'Content-Transfer-Encoding: base64\n';
          emailBody += `Content-Disposition: attachment; filename="${attachment.filename}"\n\n`;
          emailBody += `${attachment.content}\n`;
        });

        emailBody += `\n--${boundary}--`;
      } else {
        // Simple text/html email
        headers.push(`Content-Type: ${bodyType === 'html' ? 'text/html' : 'text/plain'}; charset="UTF-8"`);
        headers.push('Content-Transfer-Encoding: 7bit');
        emailBody = `\n\n${body}`;
      }

      // Combine headers and body
      const rawEmail = headers.join('\n') + emailBody;
      const encodedEmail = Buffer.from(rawEmail).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      const response = await axios.put(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/drafts/${draftId}`,
        {
          message: {
            raw: encodedEmail
          }
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
        updatedDraft: {
          id: response.data.id,
          message: {
            id: response.data.message?.id,
            threadId: response.data.message?.threadId,
            labelIds: response.data.message?.labelIds || []
          }
        },
        recipients: {
          to: to,
          cc: cc || [],
          bcc: bcc || []
        },
        subject: subject,
        attachmentCount: attachments?.length || 0
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const deleteDraftTool = tool({
  description: 'Delete a draft email message permanently',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    draftId: z.string().describe('The ID of the draft to delete'),
  }),
  execute: async ({ userId, draftId }) => {
    try {
      await axios.delete(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/drafts/${draftId}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      return {
        success: true,
        draftId: draftId,
        message: 'Draft deleted successfully'
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const sendDraftTool = tool({
  description: 'Send a draft email message',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    draftId: z.string().describe('The ID of the draft to send'),
  }),
  execute: async ({ userId, draftId }) => {
    try {
      const response = await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/drafts/${draftId}/send`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        sentMessage: {
          id: response.data.id,
          threadId: response.data.threadId,
          labelIds: response.data.labelIds || []
        },
        originalDraftId: draftId,
        message: 'Draft sent successfully'
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const createReplyDraftTool = tool({
  description: 'Create a draft reply to an existing message',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    originalMessageId: z.string().describe('The ID of the original message to reply to'),
    body: z.string().describe('Reply body content'),
    bodyType: z.enum(['text', 'html']).default('text').describe('Content type of the reply body'),
    replyAll: z.boolean().default(false).describe('Whether to reply to all recipients'),
    attachments: z.array(z.object({
      filename: z.string().describe('Name of the attachment file'),
      content: z.string().describe('Base64 encoded content of the attachment'),
      mimeType: z.string().describe('MIME type of the attachment')
    })).optional().describe('Array of attachments'),
  }),
  execute: async ({ userId, originalMessageId, body, bodyType, replyAll, attachments }) => {
    try {
      // First, get the original message to extract thread ID and headers
      const originalResponse = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/${originalMessageId}?format=full`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      const originalMessage = originalResponse.data;
      const originalHeaders: HeadersMap = {};

      if (originalMessage.payload?.headers) {
        originalMessage.payload.headers.forEach((header: GmailHeader) => {
          originalHeaders[header.name.toLowerCase()] = header.value;
        });
      }

      // Construct reply headers
      const replyTo = replyAll ?
        [originalHeaders.from, originalHeaders.cc].filter(Boolean).join(', ') :
        originalHeaders.from;

      const subject = originalHeaders.subject?.startsWith('Re: ') ?
        originalHeaders.subject :
        `Re: ${originalHeaders.subject || 'No Subject'}`;

      const headers = [
        `To: ${replyTo}`,
        `Subject: ${subject}`,
        `In-Reply-To: ${originalHeaders['message-id'] || ''}`,
        `References: ${originalHeaders['references'] || originalHeaders['message-id'] || ''}`,
        'MIME-Version: 1.0'
      ];

      let emailBody = '';

      if (attachments && attachments.length > 0) {
        // Multipart email with attachments
        const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

        emailBody = `\n--${boundary}\n`;
        emailBody += `Content-Type: ${bodyType === 'html' ? 'text/html' : 'text/plain'}; charset="UTF-8"\n`;
        emailBody += 'Content-Transfer-Encoding: 7bit\n\n';
        emailBody += `${body}\n`;

        // Add attachments
        attachments.forEach(attachment => {
          emailBody += `\n--${boundary}\n`;
          emailBody += `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"\n`;
          emailBody += 'Content-Transfer-Encoding: base64\n';
          emailBody += `Content-Disposition: attachment; filename="${attachment.filename}"\n\n`;
          emailBody += `${attachment.content}\n`;
        });

        emailBody += `\n--${boundary}--`;
      } else {
        // Simple text/html email
        headers.push(`Content-Type: ${bodyType === 'html' ? 'text/html' : 'text/plain'}; charset="UTF-8"`);
        headers.push('Content-Transfer-Encoding: 7bit');
        emailBody = `\n\n${body}`;
      }

      // Combine headers and body
      const rawEmail = headers.join('\n') + emailBody;
      const encodedEmail = Buffer.from(rawEmail).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      const response = await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/drafts`,
        {
          message: {
            raw: encodedEmail,
            threadId: originalMessage.threadId
          }
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
        createdDraft: {
          id: response.data.id,
          message: {
            id: response.data.message?.id,
            threadId: response.data.message?.threadId,
            labelIds: response.data.message?.labelIds || []
          }
        },
        originalMessageId: originalMessageId,
        replyTo: replyTo,
        subject: subject,
        replyAll: replyAll,
        attachmentCount: attachments?.length || 0
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});