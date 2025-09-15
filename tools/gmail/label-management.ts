import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import type { GmailLabel } from '../../types/gmail';
import { formatError } from '../../types/common';
import { getAccessToken } from '../../utils/auth-context';

export const listLabelsTool = tool({
  description: 'List all labels in a Gmail account',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
  }),
  execute: async ({ userId }) => {
    try {
      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/labels`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      return {
        success: true,
        labels: response.data.labels?.map((label: GmailLabel) => ({
          id: label.id,
          name: label.name,
          type: label.type,
          messageListVisibility: label.messageListVisibility,
          labelListVisibility: label.labelListVisibility,
          messagesTotal: label.messagesTotal,
          messagesUnread: label.messagesUnread,
          threadsTotal: label.threadsTotal,
          threadsUnread: label.threadsUnread,
          color: label.color
        })) || [],
        totalLabels: response.data.labels?.length || 0
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const createLabelTool = tool({
  description: 'Create a new label in Gmail',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    name: z.string().describe('The name of the label'),
    messageListVisibility: z.enum(['show', 'hide']).optional().describe('Whether to show label in message list'),
    labelListVisibility: z.enum(['labelShow', 'labelHide', 'labelShowIfUnread']).optional().describe('Visibility in label list'),
    backgroundColor: z.string().optional().describe('Background color for the label (hex color)'),
    textColor: z.string().optional().describe('Text color for the label (hex color)'),
  }),
  execute: async ({ userId, name, messageListVisibility, labelListVisibility, backgroundColor, textColor }) => {
    try {
      const labelData: Partial<GmailLabel> = {
        name: name
      };

      if (messageListVisibility) {
        labelData.messageListVisibility = messageListVisibility;
      }

      if (labelListVisibility) {
        labelData.labelListVisibility = labelListVisibility;
      }

      if (backgroundColor || textColor) {
        labelData.color = {};
        if (backgroundColor) labelData.color.backgroundColor = backgroundColor;
        if (textColor) labelData.color.textColor = textColor;
      }

      const response = await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/labels`,
        labelData,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        createdLabel: {
          id: response.data.id,
          name: response.data.name,
          type: response.data.type,
          messageListVisibility: response.data.messageListVisibility,
          labelListVisibility: response.data.labelListVisibility,
          color: response.data.color
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

export const getLabelTool = tool({
  description: 'Get detailed information about a specific label',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    labelId: z.string().describe('The ID of the label to retrieve'),
  }),
  execute: async ({ userId, labelId }) => {
    try {
      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/labels/${labelId}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      return {
        success: true,
        label: {
          id: response.data.id,
          name: response.data.name,
          type: response.data.type,
          messageListVisibility: response.data.messageListVisibility,
          labelListVisibility: response.data.labelListVisibility,
          messagesTotal: response.data.messagesTotal,
          messagesUnread: response.data.messagesUnread,
          threadsTotal: response.data.threadsTotal,
          threadsUnread: response.data.threadsUnread,
          color: response.data.color
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

export const updateLabelTool = tool({
  description: 'Update an existing label in Gmail',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    labelId: z.string().describe('The ID of the label to update'),
    name: z.string().optional().describe('The new name of the label'),
    messageListVisibility: z.enum(['show', 'hide']).optional().describe('Whether to show label in message list'),
    labelListVisibility: z.enum(['labelShow', 'labelHide', 'labelShowIfUnread']).optional().describe('Visibility in label list'),
    backgroundColor: z.string().optional().describe('Background color for the label (hex color)'),
    textColor: z.string().optional().describe('Text color for the label (hex color)'),
  }),
  execute: async ({ userId, labelId, name, messageListVisibility, labelListVisibility, backgroundColor, textColor }) => {
    try {
      const labelData: Partial<GmailLabel> = {};

      if (name) labelData.name = name;
      if (messageListVisibility) labelData.messageListVisibility = messageListVisibility;
      if (labelListVisibility) labelData.labelListVisibility = labelListVisibility;

      if (backgroundColor || textColor) {
        labelData.color = {};
        if (backgroundColor) labelData.color.backgroundColor = backgroundColor;
        if (textColor) labelData.color.textColor = textColor;
      }

      const response = await axios.patch(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/labels/${labelId}`,
        labelData,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        updatedLabel: {
          id: response.data.id,
          name: response.data.name,
          type: response.data.type,
          messageListVisibility: response.data.messageListVisibility,
          labelListVisibility: response.data.labelListVisibility,
          color: response.data.color
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

export const deleteLabelTool = tool({
  description: 'Delete a label from Gmail',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    labelId: z.string().describe('The ID of the label to delete'),
  }),
  execute: async ({ userId, labelId }) => {
    try {
      await axios.delete(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/labels/${labelId}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      return {
        success: true,
        deletedLabelId: labelId,
        message: 'Label deleted successfully'
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const getSystemLabelsTool = tool({
  description: 'Get all system labels (INBOX, SENT, DRAFT, etc.) in Gmail',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
  }),
  execute: async ({ userId }) => {
    try {
      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/labels`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      const systemLabels = response.data.labels?.filter((label: GmailLabel) => label.type === 'system') || [];

      return {
        success: true,
        systemLabels: systemLabels.map((label: GmailLabel) => ({
          id: label.id,
          name: label.name,
          type: label.type,
          messageListVisibility: label.messageListVisibility,
          labelListVisibility: label.labelListVisibility,
          messagesTotal: label.messagesTotal,
          messagesUnread: label.messagesUnread,
          threadsTotal: label.threadsTotal,
          threadsUnread: label.threadsUnread
        })),
        totalSystemLabels: systemLabels.length
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const getUserLabelsTool = tool({
  description: 'Get all user-created labels in Gmail',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
  }),
  execute: async ({ userId }) => {
    try {
      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/labels`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      const userLabels = response.data.labels?.filter((label: GmailLabel) => label.type === 'user') || [];

      return {
        success: true,
        userLabels: userLabels.map((label: GmailLabel) => ({
          id: label.id,
          name: label.name,
          type: label.type,
          messageListVisibility: label.messageListVisibility,
          labelListVisibility: label.labelListVisibility,
          messagesTotal: label.messagesTotal,
          messagesUnread: label.messagesUnread,
          threadsTotal: label.threadsTotal,
          threadsUnread: label.threadsUnread,
          color: label.color
        })),
        totalUserLabels: userLabels.length
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const searchLabelsTool = tool({
  description: 'Search for labels by name in Gmail',
  inputSchema: z.object({
    userId: z.string().optional().default('me').describe('The user ID (default: "me" for authenticated user)'),
    searchTerm: z.string().describe('The term to search for in label names'),
    caseInsensitive: z.boolean().default(true).describe('Whether to perform case-insensitive search'),
  }),
  execute: async ({ userId, searchTerm, caseInsensitive }) => {
    try {
      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${userId}/labels`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      const allLabels = response.data.labels || [];
      const searchTermLower = caseInsensitive ? searchTerm.toLowerCase() : searchTerm;

      const matchingLabels = allLabels.filter((label: GmailLabel) => {
        const labelName = caseInsensitive ? label.name.toLowerCase() : label.name;
        return labelName.includes(searchTermLower);
      });

      return {
        success: true,
        matchingLabels: matchingLabels.map((label: GmailLabel) => ({
          id: label.id,
          name: label.name,
          type: label.type,
          messageListVisibility: label.messageListVisibility,
          labelListVisibility: label.labelListVisibility,
          messagesTotal: label.messagesTotal,
          messagesUnread: label.messagesUnread,
          threadsTotal: label.threadsTotal,
          threadsUnread: label.threadsUnread,
          color: label.color
        })),
        searchTerm: searchTerm,
        matchingCount: matchingLabels.length,
        totalLabels: allLabels.length
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});