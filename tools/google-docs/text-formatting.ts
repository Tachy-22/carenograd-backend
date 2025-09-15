import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import { formatError } from '../../types/common';
import { getAccessToken } from '../../utils/auth-context';

const ColorSchema = z.object({
  red: z.number().min(0).max(1).optional(),
  green: z.number().min(0).max(1).optional(),
  blue: z.number().min(0).max(1).optional()
});

const TextStyleSchema = z.object({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strikethrough: z.boolean().optional(),
  smallCaps: z.boolean().optional(),
  backgroundColor: ColorSchema.optional(),
  foregroundColor: ColorSchema.optional(),
  fontSize: z.object({
    magnitude: z.number(),
    unit: z.enum(['PT'])
  }).optional(),
  fontFamily: z.string().optional(),
  baselineOffset: z.enum(['NONE', 'SUPERSCRIPT', 'SUBSCRIPT']).optional(),
  link: z.object({
    url: z.string()
  }).optional()
});

export const formatTextTool = tool({
  description: 'Apply text formatting (bold, italic, color, font, etc.) to a specific range in a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    startIndex: z.number().describe('The start index of the text to format (0-based, inclusive)'),
    endIndex: z.number().describe('The end index of the text to format (0-based, exclusive)'),
    textStyle: TextStyleSchema.describe('The text formatting to apply'),
    fields: z.string().optional().describe('Comma-separated list of fields to update (e.g., "bold,italic,foregroundColor")'),
    tabId: z.string().optional().describe('The tab ID if formatting text in a specific tab'),
  }),
  execute: async ({ documentId, startIndex, endIndex, textStyle, fields, tabId }) => {
    try {
      const range = tabId
        ? { tabId, startIndex, endIndex }
        : { startIndex, endIndex };

      // If no specific fields provided, update all provided style properties
      const updateFields = fields || Object.keys(textStyle).map(key => {
        // Convert camelCase to dot notation for nested properties
        if (key === 'backgroundColor' || key === 'foregroundColor') {
          return key;
        }
        if (key === 'fontSize') {
          return 'fontSize.magnitude,fontSize.unit';
        }
        return key;
      }).join(',');

      const request = {
        requests: [
          {
            updateTextStyle: {
              range: range,
              textStyle: textStyle,
              fields: updateFields
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
        formattedRange: {
          startIndex,
          endIndex,
          length: endIndex - startIndex
        },
        appliedStyle: textStyle,
        updatedFields: updateFields,
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

export const addHyperlinkTool = tool({
  description: 'Add a hyperlink to specific text in a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    startIndex: z.number().describe('The start index of the text to link (0-based, inclusive)'),
    endIndex: z.number().describe('The end index of the text to link (0-based, exclusive)'),
    url: z.string().describe('The URL for the hyperlink'),
    tabId: z.string().optional().describe('The tab ID if adding link in a specific tab'),
  }),
  execute: async ({ documentId, startIndex, endIndex, url, tabId }) => {
    try {
      const range = tabId
        ? { tabId, startIndex, endIndex }
        : { startIndex, endIndex };

      const request = {
        requests: [
          {
            updateTextStyle: {
              range: range,
              textStyle: {
                link: {
                  url: url
                }
              },
              fields: 'link'
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
        linkedRange: {
          startIndex,
          endIndex,
          length: endIndex - startIndex
        },
        url: url,
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

export const removeFormattingTool = tool({
  description: 'Remove specific formatting from text in a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    startIndex: z.number().describe('The start index of the text to remove formatting from (0-based, inclusive)'),
    endIndex: z.number().describe('The end index of the text to remove formatting from (0-based, exclusive)'),
    formatTypes: z.array(z.enum(['bold', 'italic', 'underline', 'strikethrough', 'smallCaps', 'backgroundColor', 'foregroundColor', 'fontSize', 'fontFamily', 'baselineOffset', 'link'])).describe('The types of formatting to remove'),
    tabId: z.string().optional().describe('The tab ID if removing formatting in a specific tab'),
  }),
  execute: async ({ documentId, startIndex, endIndex, formatTypes, tabId }) => {
    try {
      const range = tabId
        ? { tabId, startIndex, endIndex }
        : { startIndex, endIndex };

      // Create a text style object with default values to clear formatting
      const clearStyle: Record<string, unknown> = {};
      formatTypes.forEach(formatType => {
        switch (formatType) {
          case 'bold':
          case 'italic':
          case 'underline':
          case 'strikethrough':
          case 'smallCaps':
            clearStyle[formatType] = false;
            break;
          case 'backgroundColor':
          case 'foregroundColor':
            clearStyle[formatType] = null;
            break;
          case 'fontSize':
            clearStyle.fontSize = { magnitude: 11, unit: 'PT' }; // Default font size
            break;
          case 'fontFamily':
            clearStyle.fontFamily = 'Arial'; // Default font family
            break;
          case 'baselineOffset':
            clearStyle.baselineOffset = 'NONE';
            break;
          case 'link':
            clearStyle.link = null;
            break;
        }
      });

      const request = {
        requests: [
          {
            updateTextStyle: {
              range: range,
              textStyle: clearStyle,
              fields: formatTypes.join(',')
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
        clearedRange: {
          startIndex,
          endIndex,
          length: endIndex - startIndex
        },
        removedFormats: formatTypes,
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