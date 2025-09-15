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

const ParagraphStyleSchema = z.object({
  headingId: z.string().optional(),
  namedStyleType: z.enum(['NORMAL_TEXT', 'TITLE', 'SUBTITLE', 'HEADING_1', 'HEADING_2', 'HEADING_3', 'HEADING_4', 'HEADING_5', 'HEADING_6']).optional(),
  alignment: z.enum(['ALIGNMENT_UNSPECIFIED', 'START', 'CENTER', 'END', 'JUSTIFIED']).optional(),
  lineSpacing: z.number().optional(),
  direction: z.enum(['LEFT_TO_RIGHT', 'RIGHT_TO_LEFT']).optional(),
  spacingMode: z.enum(['NEVER_COLLAPSE', 'COLLAPSE_LISTS']).optional(),
  spaceAbove: z.object({
    magnitude: z.number(),
    unit: z.enum(['PT'])
  }).optional(),
  spaceBelow: z.object({
    magnitude: z.number(),
    unit: z.enum(['PT'])
  }).optional(),
  borderBetween: z.object({
    color: ColorSchema.optional(),
    width: z.object({
      magnitude: z.number(),
      unit: z.enum(['PT'])
    }).optional(),
    padding: z.object({
      magnitude: z.number(),
      unit: z.enum(['PT'])
    }).optional(),
    dashStyle: z.enum(['SOLID', 'DOT', 'DASH']).optional()
  }).optional(),
  borderTop: z.object({
    color: ColorSchema.optional(),
    width: z.object({
      magnitude: z.number(),
      unit: z.enum(['PT'])
    }).optional(),
    padding: z.object({
      magnitude: z.number(),
      unit: z.enum(['PT'])
    }).optional(),
    dashStyle: z.enum(['SOLID', 'DOT', 'DASH']).optional()
  }).optional(),
  borderBottom: z.object({
    color: ColorSchema.optional(),
    width: z.object({
      magnitude: z.number(),
      unit: z.enum(['PT'])
    }).optional(),
    padding: z.object({
      magnitude: z.number(),
      unit: z.enum(['PT'])
    }).optional(),
    dashStyle: z.enum(['SOLID', 'DOT', 'DASH']).optional()
  }).optional(),
  borderLeft: z.object({
    color: ColorSchema.optional(),
    width: z.object({
      magnitude: z.number(),
      unit: z.enum(['PT'])
    }).optional(),
    padding: z.object({
      magnitude: z.number(),
      unit: z.enum(['PT'])
    }).optional(),
    dashStyle: z.enum(['SOLID', 'DOT', 'DASH']).optional()
  }).optional(),
  borderRight: z.object({
    color: ColorSchema.optional(),
    width: z.object({
      magnitude: z.number(),
      unit: z.enum(['PT'])
    }).optional(),
    padding: z.object({
      magnitude: z.number(),
      unit: z.enum(['PT'])
    }).optional(),
    dashStyle: z.enum(['SOLID', 'DOT', 'DASH']).optional()
  }).optional(),
  indentFirstLine: z.object({
    magnitude: z.number(),
    unit: z.enum(['PT'])
  }).optional(),
  indentStart: z.object({
    magnitude: z.number(),
    unit: z.enum(['PT'])
  }).optional(),
  indentEnd: z.object({
    magnitude: z.number(),
    unit: z.enum(['PT'])
  }).optional(),
  shading: z.object({
    backgroundColor: ColorSchema.optional()
  }).optional()
});

export const formatParagraphTool = tool({
  description: 'Apply paragraph formatting (alignment, spacing, borders, indentation) to specific paragraphs in a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    startIndex: z.number().describe('The start index of the paragraph range to format (0-based, inclusive)'),
    endIndex: z.number().describe('The end index of the paragraph range to format (0-based, exclusive)'),
    paragraphStyle: ParagraphStyleSchema.describe('The paragraph formatting to apply'),
    fields: z.string().optional().describe('Comma-separated list of fields to update'),
    tabId: z.string().optional().describe('The tab ID if formatting paragraphs in a specific tab'),
  }),
  execute: async ({ documentId, startIndex, endIndex, paragraphStyle, fields, tabId }) => {
    try {
      const range = tabId
        ? { tabId, startIndex, endIndex }
        : { startIndex, endIndex };

      // If no specific fields provided, update all provided style properties
      const updateFields = fields || Object.keys(paragraphStyle).join(',');

      const request = {
        requests: [
          {
            updateParagraphStyle: {
              range: range,
              paragraphStyle: paragraphStyle,
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
        appliedStyle: paragraphStyle,
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

export const createBulletListTool = tool({
  description: 'Create a bulleted list from existing paragraphs in a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    startIndex: z.number().describe('The start index of the paragraphs to convert to bullets (0-based, inclusive)'),
    endIndex: z.number().describe('The end index of the paragraphs to convert to bullets (0-based, exclusive)'),
    bulletPreset: z.enum(['BULLET_DISC_CIRCLE_SQUARE', 'BULLET_DIAMONDX_ARROW3D_SQUARE', 'BULLET_CHECKBOX', 'BULLET_ARROW_DIAMOND_DISC', 'BULLET_STAR_CIRCLE_SQUARE', 'BULLET_ARROW3D_CIRCLE_SQUARE', 'BULLET_LEFTTRIANGLE_DIAMOND_DISC', 'BULLET_DIAMONDX_HOLLOWDIAMOND_SQUARE', 'BULLET_DIAMOND_CIRCLE_SQUARE']).optional().describe('The bullet list preset to use'),
    nestingLevel: z.number().min(0).max(8).optional().describe('The nesting level (0-8, default is 0)'),
    tabId: z.string().optional().describe('The tab ID if creating bullets in a specific tab'),
  }),
  execute: async ({ documentId, startIndex, endIndex, bulletPreset, nestingLevel, tabId }) => {
    try {
      const range = tabId
        ? { tabId, startIndex, endIndex }
        : { startIndex, endIndex };

      const createParagraphBulletsRequest: Record<string, unknown> = {
        range: range
      };

      if (bulletPreset) {
        createParagraphBulletsRequest.bulletPreset = bulletPreset;
      }

      const requests: Record<string, unknown>[] = [
        {
          createParagraphBullets: createParagraphBulletsRequest
        }
      ];

      // If nesting level is specified, add an additional request to update paragraph style
      if (nestingLevel !== undefined && nestingLevel > 0) {
        requests.push({
          updateParagraphStyle: {
            range: range,
            paragraphStyle: {
              indentStart: {
                magnitude: nestingLevel * 18, // 18pt per level
                unit: 'PT'
              }
            },
            fields: 'indentStart'
          }
        });
      }

      const request = { requests };

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
        bulletRange: {
          startIndex,
          endIndex,
          length: endIndex - startIndex
        },
        bulletPreset: bulletPreset || 'BULLET_DISC_CIRCLE_SQUARE',
        nestingLevel: nestingLevel || 0,
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

export const createNumberedListTool = tool({
  description: 'Create a numbered list from existing paragraphs in a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    startIndex: z.number().describe('The start index of the paragraphs to convert to numbers (0-based, inclusive)'),
    endIndex: z.number().describe('The end index of the paragraphs to convert to numbers (0-based, exclusive)'),
    numberingPreset: z.enum(['NUMBERED_DECIMAL_ALPHA_ROMAN', 'NUMBERED_DECIMAL_ALPHA_ROMAN_PARENS', 'NUMBERED_DECIMAL_NESTED', 'NUMBERED_UPPERALPHA_ALPHA_ROMAN', 'NUMBERED_UPPERROMAN_UPPERALPHA_DECIMAL', 'NUMBERED_ZERODECIMAL_ALPHA_ROMAN']).optional().describe('The numbered list preset to use'),
    nestingLevel: z.number().min(0).max(8).optional().describe('The nesting level (0-8, default is 0)'),
    tabId: z.string().optional().describe('The tab ID if creating numbered list in a specific tab'),
  }),
  execute: async ({ documentId, startIndex, endIndex, numberingPreset, nestingLevel, tabId }) => {
    try {
      const range = tabId
        ? { tabId, startIndex, endIndex }
        : { startIndex, endIndex };

      const createParagraphBulletsRequest: Record<string, unknown> = {
        range: range
      };

      if (numberingPreset) {
        createParagraphBulletsRequest.bulletPreset = numberingPreset;
      }

      const requests: Record<string, unknown>[] = [
        {
          createParagraphBullets: createParagraphBulletsRequest
        }
      ];

      // If nesting level is specified, add an additional request to update paragraph style
      if (nestingLevel !== undefined && nestingLevel > 0) {
        requests.push({
          updateParagraphStyle: {
            range: range,
            paragraphStyle: {
              indentStart: {
                magnitude: nestingLevel * 18, // 18pt per level
                unit: 'PT'
              }
            },
            fields: 'indentStart'
          }
        });
      }

      const request = { requests };

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
        numberedRange: {
          startIndex,
          endIndex,
          length: endIndex - startIndex
        },
        numberingPreset: numberingPreset || 'NUMBERED_DECIMAL_ALPHA_ROMAN',
        nestingLevel: nestingLevel || 0,
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

export const removeBulletsNumberingTool = tool({
  description: 'Remove bullet points or numbering from paragraphs in a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    startIndex: z.number().describe('The start index of the paragraphs to remove bullets/numbering from (0-based, inclusive)'),
    endIndex: z.number().describe('The end index of the paragraphs to remove bullets/numbering from (0-based, exclusive)'),
    tabId: z.string().optional().describe('The tab ID if removing bullets/numbering in a specific tab'),
  }),
  execute: async ({ documentId, startIndex, endIndex, tabId }) => {
    try {
      const range = tabId
        ? { tabId, startIndex, endIndex }
        : { startIndex, endIndex };

      const request = {
        requests: [
          {
            deleteParagraphBullets: {
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
        clearedRange: {
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