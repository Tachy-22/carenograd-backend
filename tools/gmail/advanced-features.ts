import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import type { GmailFilter, GmailAutoForwarding, GmailSendAsAddress, GmailVacationSettings, GmailImapSettings } from '../../types/gmail';
import { formatError } from '../../types/common';
import { getAccessToken } from '../../utils/auth-context';

export const listFiltersTool = tool({
  description: 'List all Gmail filters for the authenticated user',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
  }),
  execute: async ({ userId }) => {

    try {
      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/settings/filters`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      const filters = response.data.filter || [];

      return {
        success: true,
        filters: filters.map((filter: GmailFilter) => ({
          id: filter.id,
          criteria: filter.criteria,
          action: filter.action
        })),
        totalFilters: filters.length
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const createFilterTool = tool({
  description: 'Create a new Gmail filter with criteria and actions',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    criteria: z.object({
      from: z.string().optional().describe('Messages from this email address'),
      to: z.string().optional().describe('Messages sent to this email address'),
      subject: z.string().optional().describe('Messages with this subject'),
      query: z.string().optional().describe('Gmail search query'),
      negatedQuery: z.string().optional().describe('Exclude messages matching this query'),
      hasAttachment: z.boolean().optional().describe('Messages with attachments'),
      excludeChats: z.boolean().optional().describe('Exclude chat messages'),
      size: z.number().optional().describe('Messages larger than this size (bytes)'),
      sizeComparison: z.enum(['larger', 'smaller']).optional().describe('Size comparison operator')
    }).describe('Filter criteria'),
    action: z.object({
      addLabelIds: z.array(z.string()).optional().describe('Labels to add to matching messages'),
      removeLabelIds: z.array(z.string()).optional().describe('Labels to remove from matching messages'),
      forward: z.string().optional().describe('Email address to forward matching messages to'),
      markAsRead: z.boolean().optional().describe('Mark matching messages as read'),
      markAsImportant: z.boolean().optional().describe('Mark matching messages as important'),
      neverMarkAsImportant: z.boolean().optional().describe('Never mark matching messages as important'),
      deleteMessage: z.boolean().optional().describe('Delete matching messages'),
      markAsSpam: z.boolean().optional().describe('Mark matching messages as spam'),
      neverMarkAsSpam: z.boolean().optional().describe('Never mark matching messages as spam')
    }).describe('Actions to perform on matching messages'),
  }),
  execute: async ({ userId, criteria, action }) => {
    try {
      const filterData = {
        criteria: {} as GmailFilter['criteria'],
        action: {} as GmailFilter['action']
      };

      // Build criteria
      if (criteria.from) filterData.criteria.from = criteria.from;
      if (criteria.to) filterData.criteria.to = criteria.to;
      if (criteria.subject) filterData.criteria.subject = criteria.subject;
      if (criteria.query) filterData.criteria.query = criteria.query;
      if (criteria.negatedQuery) filterData.criteria.negatedQuery = criteria.negatedQuery;
      if (criteria.hasAttachment !== undefined) filterData.criteria.hasAttachment = criteria.hasAttachment;
      if (criteria.excludeChats !== undefined) filterData.criteria.excludeChats = criteria.excludeChats;
      if (criteria.size !== undefined) {
        filterData.criteria.size = criteria.size;
        filterData.criteria.sizeComparison = criteria.sizeComparison || 'larger';
      }

      // Build action
      if (action.addLabelIds && action.addLabelIds.length > 0) {
        filterData.action.addLabelIds = action.addLabelIds;
      }
      if (action.removeLabelIds && action.removeLabelIds.length > 0) {
        filterData.action.removeLabelIds = action.removeLabelIds;
      }
      if (action.forward) filterData.action.forward = action.forward;
      if (action.markAsRead !== undefined) filterData.action.markAsRead = action.markAsRead;
      if (action.markAsImportant !== undefined) filterData.action.markAsImportant = action.markAsImportant;
      if (action.neverMarkAsImportant !== undefined) filterData.action.neverMarkAsImportant = action.neverMarkAsImportant;
      if (action.deleteMessage !== undefined) filterData.action.deleteMessage = action.deleteMessage;
      if (action.markAsSpam !== undefined) filterData.action.markAsSpam = action.markAsSpam;
      if (action.neverMarkAsSpam !== undefined) filterData.action.neverMarkAsSpam = action.neverMarkAsSpam;

      const response = await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/settings/filters`,
        filterData,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        createdFilter: {
          id: response.data.id,
          criteria: response.data.criteria,
          action: response.data.action
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

export const deleteFilterTool = tool({
  description: 'Delete a Gmail filter',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    filterId: z.string().describe('The ID of the filter to delete'),
  }),
  execute: async ({ userId, filterId }) => {
    try {
      await axios.delete(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/settings/filters/${filterId}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      return {
        success: true,
        filterId: filterId,
        message: 'Filter deleted successfully'
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const getAutoForwardingTool = tool({
  description: 'Get the current auto-forwarding settings',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
  }),
  execute: async ({ userId }) => {
    try {
      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/settings/autoForwarding`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      return {
        success: true,
        autoForwarding: {
          enabled: response.data.enabled || false,
          emailAddress: response.data.emailAddress,
          disposition: response.data.disposition
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

export const updateAutoForwardingTool = tool({
  description: 'Update auto-forwarding settings for Gmail',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    enabled: z.boolean().describe('Whether auto-forwarding is enabled'),
    emailAddress: z.string().optional().describe('Email address to forward messages to'),
    disposition: z.enum(['leaveInInbox', 'markAsRead', 'archive', 'trash']).optional().describe('What to do with forwarded messages'),
  }),
  execute: async ({ userId, enabled, emailAddress, disposition }) => {
    try {
      const forwardingData: Partial<GmailAutoForwarding> = {
        enabled: enabled
      };

      if (enabled && emailAddress) {
        forwardingData.emailAddress = emailAddress;
      }

      if (disposition) {
        forwardingData.disposition = disposition;
      }

      const response = await axios.put(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/settings/autoForwarding`,
        forwardingData,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        autoForwarding: {
          enabled: response.data.enabled,
          emailAddress: response.data.emailAddress,
          disposition: response.data.disposition
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

export const getSignatureTool = tool({
  description: 'Get the current email signature',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    sendAsEmail: z.string().optional().describe('The "send as" email address to get signature for (defaults to primary)'),
  }),
  execute: async ({ userId, sendAsEmail }) => {
    try {
      let url = `https://gmail.googleapis.com/gmail/v1/users/${userId}/settings/sendAs`;

      if (sendAsEmail) {
        url += `/${encodeURIComponent(sendAsEmail)}`;
      }

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${await getAccessToken()}`,
        }
      });

      if (sendAsEmail) {
        // Single send-as address
        return {
          success: true,
          signature: {
            sendAsEmail: response.data.sendAsEmail,
            displayName: response.data.displayName,
            signature: response.data.signature || '',
            isDefault: response.data.isDefault || false,
            isPrimary: response.data.isPrimary || false
          }
        };
      } else {
        // All send-as addresses
        const sendAsAddresses = response.data.sendAs || [];
        return {
          success: true,
          signatures: sendAsAddresses.map((sendAs: GmailSendAsAddress) => ({
            sendAsEmail: sendAs.sendAsEmail,
            displayName: sendAs.displayName,
            signature: sendAs.signature || '',
            isDefault: sendAs.isDefault || false,
            isPrimary: sendAs.isPrimary || false
          }))
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const updateSignatureTool = tool({
  description: 'Update email signature for a send-as address',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    sendAsEmail: z.string().describe('The "send as" email address to update signature for'),
    signature: z.string().describe('The new email signature (HTML or plain text)'),
    displayName: z.string().optional().describe('Display name for this send-as address'),
  }),
  execute: async ({ userId, sendAsEmail, signature, displayName }) => {
    try {
      const updateData: Partial<GmailSendAsAddress> = {
        signature: signature
      };

      if (displayName) {
        updateData.displayName = displayName;
      }

      const response = await axios.patch(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/settings/sendAs/${encodeURIComponent(sendAsEmail)}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        updatedSignature: {
          sendAsEmail: response.data.sendAsEmail,
          displayName: response.data.displayName,
          signature: response.data.signature,
          isDefault: response.data.isDefault || false,
          isPrimary: response.data.isPrimary || false
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

export const getVacationSettingsTool = tool({
  description: 'Get current vacation responder (auto-reply) settings',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
  }),
  execute: async ({ userId }) => {
    try {
      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/settings/vacation`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      return {
        success: true,
        vacationSettings: {
          enableAutoReply: response.data.enableAutoReply || false,
          responseSubject: response.data.responseSubject || '',
          responseBodyPlainText: response.data.responseBodyPlainText || '',
          responseBodyHtml: response.data.responseBodyHtml || '',
          restrictToContacts: response.data.restrictToContacts || false,
          restrictToDomain: response.data.restrictToDomain || false,
          startTime: response.data.startTime ? new Date(parseInt(response.data.startTime)).toISOString() : null,
          endTime: response.data.endTime ? new Date(parseInt(response.data.endTime)).toISOString() : null
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

export const updateVacationSettingsTool = tool({
  description: 'Update vacation responder (auto-reply) settings',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    enableAutoReply: z.boolean().describe('Whether to enable the vacation responder'),
    responseSubject: z.string().optional().describe('Subject line of the auto-reply'),
    responseBodyPlainText: z.string().optional().describe('Plain text body of the auto-reply'),
    responseBodyHtml: z.string().optional().describe('HTML body of the auto-reply'),
    restrictToContacts: z.boolean().optional().describe('Only send auto-reply to people in contacts'),
    restrictToDomain: z.boolean().optional().describe('Only send auto-reply to people in the same domain'),
    startTime: z.string().optional().describe('Start time for vacation responder (ISO 8601 format)'),
    endTime: z.string().optional().describe('End time for vacation responder (ISO 8601 format)'),
  }),
  execute: async ({ userId, enableAutoReply, responseSubject, responseBodyPlainText, responseBodyHtml, restrictToContacts, restrictToDomain, startTime, endTime }) => {
    try {
      const vacationData: Partial<GmailVacationSettings> = {
        enableAutoReply: enableAutoReply
      };

      if (responseSubject) vacationData.responseSubject = responseSubject;
      if (responseBodyPlainText) vacationData.responseBodyPlainText = responseBodyPlainText;
      if (responseBodyHtml) vacationData.responseBodyHtml = responseBodyHtml;
      if (restrictToContacts !== undefined) vacationData.restrictToContacts = restrictToContacts;
      if (restrictToDomain !== undefined) vacationData.restrictToDomain = restrictToDomain;

      if (startTime) {
        vacationData.startTime = new Date(startTime).getTime().toString();
      }

      if (endTime) {
        vacationData.endTime = new Date(endTime).getTime().toString();
      }

      const response = await axios.put(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/settings/vacation`,
        vacationData,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        updatedVacationSettings: {
          enableAutoReply: response.data.enableAutoReply,
          responseSubject: response.data.responseSubject,
          responseBodyPlainText: response.data.responseBodyPlainText,
          responseBodyHtml: response.data.responseBodyHtml,
          restrictToContacts: response.data.restrictToContacts,
          restrictToDomain: response.data.restrictToDomain,
          startTime: response.data.startTime ? new Date(parseInt(response.data.startTime)).toISOString() : null,
          endTime: response.data.endTime ? new Date(parseInt(response.data.endTime)).toISOString() : null
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

export const getImapSettingsTool = tool({
  description: 'Get current IMAP settings for the Gmail account',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
  }),
  execute: async ({ userId }) => {
    try {
      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/settings/imap`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      return {
        success: true,
        imapSettings: {
          enabled: response.data.enabled || false,
          autoExpunge: response.data.autoExpunge || false,
          expungeBehavior: response.data.expungeBehavior,
          maxFolderSize: response.data.maxFolderSize
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

export const updateImapSettingsTool = tool({
  description: 'Update IMAP settings for the Gmail account',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    enabled: z.boolean().describe('Whether IMAP is enabled'),
    autoExpunge: z.boolean().optional().describe('Whether to automatically expunge deleted messages'),
    expungeBehavior: z.enum(['archive', 'trash', 'deleteForever']).optional().describe('What to do when messages are expunged'),
    maxFolderSize: z.number().optional().describe('Maximum folder size in MB'),
  }),
  execute: async ({ userId, enabled, autoExpunge, expungeBehavior, maxFolderSize }) => {
    try {
      const imapData: Partial<GmailImapSettings> = {
        enabled: enabled
      };

      if (autoExpunge !== undefined) imapData.autoExpunge = autoExpunge;
      if (expungeBehavior) imapData.expungeBehavior = expungeBehavior;
      if (maxFolderSize !== undefined) imapData.maxFolderSize = maxFolderSize;

      const response = await axios.put(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/settings/imap`,
        imapData,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        updatedImapSettings: {
          enabled: response.data.enabled,
          autoExpunge: response.data.autoExpunge,
          expungeBehavior: response.data.expungeBehavior,
          maxFolderSize: response.data.maxFolderSize
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