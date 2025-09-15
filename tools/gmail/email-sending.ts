import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import type { GmailHeader, HeadersMap, EmailRequestBody, GmailMessagePart } from '../../types/gmail';
import { formatError } from '../../types/common';
import { getAccessToken } from '../../utils/auth-context';



export const sendEmailTool = tool({
  description: 'Send an email message with optional attachments',
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
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return { success: false, error: 'Google access token not found in environment variables' };
    }
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
        const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
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
        requestBody.message!.threadId = threadId;
      }

      const response = await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/send`,
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
        sentMessage: {
          id: response.data.id,
          threadId: response.data.threadId,
          labelIds: response.data.labelIds
        },
        recipients: {
          to: to,
          cc: cc || [],
          bcc: bcc || []
        },
        subject: subject,
        body: body,
        bodyType: bodyType,
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

export const replyToEmailTool = tool({
  description: 'Reply to an existing email message',
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
    const accessToken = await getAccessToken()

    if (!accessToken) {
      return { success: false, error: 'Google access token not found in environment variables' };
    }
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
        const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
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
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/send`,
        {
          raw: encodedEmail,
          threadId: originalMessage.threadId
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
        sentReply: {
          id: response.data.id,
          threadId: response.data.threadId,
          labelIds: response.data.labelIds
        },
        originalMessageId: originalMessageId,
        replyTo: replyTo,
        subject: subject,
        body: body,
        bodyType: bodyType,
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

export const forwardEmailTool = tool({
  description: 'Forward an existing email message to new recipients',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    originalMessageId: z.string().describe('The ID of the original message to forward'),
    to: z.array(z.string()).describe('Array of recipient email addresses'),
    cc: z.array(z.string()).optional().describe('Array of CC recipient email addresses'),
    bcc: z.array(z.string()).optional().describe('Array of BCC recipient email addresses'),
    message: z.string().optional().describe('Additional message to include with the forward'),
    bodyType: z.enum(['text', 'html']).default('text').describe('Content type of the additional message'),
    includeAttachments: z.boolean().default(true).describe('Whether to include attachments from the original message'),
  }),
  execute: async ({ userId, originalMessageId, to, cc, bcc, message, bodyType, includeAttachments }) => {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return { success: false, error: 'Google access token not found in environment variables' };
    }
    try {
      // Get the original message with full content
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

      // Construct forward headers
      const subject = originalHeaders.subject?.startsWith('Fwd: ') ?
        originalHeaders.subject :
        `Fwd: ${originalHeaders.subject || 'No Subject'}`;

      const headers = [
        `To: ${to.join(', ')}`,
        ...(cc && cc.length > 0 ? [`Cc: ${cc.join(', ')}`] : []),
        ...(bcc && bcc.length > 0 ? [`Bcc: ${bcc.join(', ')}`] : []),
        `Subject: ${subject}`,
        'MIME-Version: 1.0'
      ];

      // Build forward content
      let forwardContent = message ? `${message}\n\n---------- Forwarded message ----------\n` : '---------- Forwarded message ----------\n';
      forwardContent += `From: ${originalHeaders.from || 'Unknown'}\n`;
      forwardContent += `Date: ${originalHeaders.date || 'Unknown'}\n`;
      forwardContent += `Subject: ${originalHeaders.subject || 'No Subject'}\n`;
      forwardContent += `To: ${originalHeaders.to || 'Unknown'}\n\n`;

      // Extract original body content
      let originalBody = '';
      if (originalMessage.payload?.body?.data) {
        originalBody = Buffer.from(originalMessage.payload.body.data, 'base64').toString();
      } else if (originalMessage.payload?.parts) {
        const textPart = originalMessage.payload.parts.find((part: GmailMessagePart) =>
          part.mimeType === 'text/plain' || part.mimeType === 'text/html'
        );
        if (textPart?.body?.data) {
          originalBody = Buffer.from(textPart.body.data, 'base64').toString();
        }
      }

      forwardContent += originalBody;

      // Handle attachments if requested
      let attachments: Array<{ filename: string; content: string; mimeType: string }> = [];
      if (includeAttachments && originalMessage.payload?.parts) {
        const attachmentParts = originalMessage.payload.parts.filter((part: GmailMessagePart) =>
          part.filename && part.body?.attachmentId
        );

        for (const part of attachmentParts) {
          try {
            const attachmentResponse = await axios.get(
              `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/${originalMessageId}/attachments/${part.body.attachmentId}`,
              {
                headers: {
                  'Authorization': `Bearer ${await getAccessToken()}`,
                }
              }
            );

            attachments.push({
              filename: part.filename,
              content: attachmentResponse.data.data,
              mimeType: part.mimeType
            });
          } catch (attachmentError) {
            // Continue if attachment download fails
            console.warn(`Failed to download attachment ${part.filename}`);
          }
        }
      }

      let emailBody = '';

      if (attachments.length > 0) {
        // Multipart email with attachments
        const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

        emailBody = `\n--${boundary}\n`;
        emailBody += `Content-Type: ${bodyType === 'html' ? 'text/html' : 'text/plain'}; charset="UTF-8"\n`;
        emailBody += 'Content-Transfer-Encoding: 7bit\n\n';
        emailBody += `${forwardContent}\n`;

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
        emailBody = `\n${forwardContent}`;
      }

      // Combine headers and body
      const rawEmail = headers.join('\n') + emailBody;
      const encodedEmail = Buffer.from(rawEmail).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      const response = await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/send`,
        {
          raw: encodedEmail
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
        forwardedMessage: {
          id: response.data.id,
          threadId: response.data.threadId,
          labelIds: response.data.labelIds
        },
        originalMessageId: originalMessageId,
        recipients: {
          to: to,
          cc: cc || [],
          bcc: bcc || []
        },
        subject: subject,
        forwardContent: forwardContent,
        bodyType: bodyType,
        attachmentCount: attachments.length,
        includeAttachments: includeAttachments
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});