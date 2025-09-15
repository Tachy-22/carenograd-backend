import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import { formatError } from '../../types/common';
import { getAccessToken } from '../../utils/auth-context';

const ColorSchema = z.object({
  red: z.number().min(0).max(1).optional(),
  green: z.number().min(0).max(1).optional(),
  blue: z.number().min(0).max(1).optional(),
  alpha: z.number().min(0).max(1).optional()
});

const BorderSchema = z.object({
  style: z.enum(['SOLID', 'SOLID_MEDIUM', 'SOLID_THICK', 'NONE', 'DOTTED', 'DASHED', 'DOUBLE']).optional(),
  width: z.number().optional(),
  color: ColorSchema.optional()
});

const TextFormatSchema = z.object({
  foregroundColor: ColorSchema.optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  strikethrough: z.boolean().optional(),
  underline: z.boolean().optional(),
  link: z.object({
    uri: z.string()
  }).optional()
});

const NumberFormatSchema = z.object({
  type: z.enum(['TEXT', 'NUMBER', 'PERCENT', 'CURRENCY', 'DATE', 'TIME', 'DATE_TIME', 'SCIENTIFIC']).optional(),
  pattern: z.string().optional()
});

export const formatCellsTool = tool({
  description: 'Apply formatting to cells in a Google Sheets spreadsheet including colors, borders, fonts, and number formats',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    range: z.string().describe('A1 notation range to format (e.g., "Sheet1!A1:C10")'),
    backgroundColor: ColorSchema.optional().describe('Background color for cells'),
    textFormat: TextFormatSchema.optional().describe('Text formatting options'),
    numberFormat: NumberFormatSchema.optional().describe('Number format for cells'),
    borders: z.object({
      top: BorderSchema.optional(),
      bottom: BorderSchema.optional(),
      left: BorderSchema.optional(),
      right: BorderSchema.optional()
    }).optional().describe('Border formatting'),
    horizontalAlignment: z.enum(['LEFT', 'CENTER', 'RIGHT']).optional().describe('Horizontal text alignment'),
    verticalAlignment: z.enum(['TOP', 'MIDDLE', 'BOTTOM']).optional().describe('Vertical text alignment'),
    wrapStrategy: z.enum(['OVERFLOW_CELL', 'LEGACY_WRAP', 'CLIP', 'WRAP']).optional().describe('Text wrapping strategy'),
    textDirection: z.enum(['LEFT_TO_RIGHT', 'RIGHT_TO_LEFT']).optional().describe('Text direction'),
    textRotation: z.object({
      angle: z.number().optional(),
      vertical: z.boolean().optional()
    }).optional().describe('Text rotation settings'),
    hyperlinkDisplayType: z.enum(['LINKED', 'PLAIN_TEXT']).optional().describe('How hyperlinks should be displayed'),
  }),
  execute: async ({
    spreadsheetId,
    range,
    backgroundColor,
    textFormat,
    numberFormat,
    borders,
    horizontalAlignment,
    verticalAlignment,
    wrapStrategy,
    textDirection,
    textRotation,
    hyperlinkDisplayType
  }) => {
    try {
      // Parse the range to get sheet ID and grid coordinates
      const [sheetName, cellRange] = range.split('!');

      const cellFormat: Record<string, unknown> = {};

      if (backgroundColor) {
        cellFormat.backgroundColor = backgroundColor;
      }

      if (textFormat) {
        cellFormat.textFormat = textFormat;
      }

      if (numberFormat) {
        cellFormat.numberFormat = numberFormat;
      }

      if (borders) {
        cellFormat.borders = borders;
      }

      if (horizontalAlignment) {
        cellFormat.horizontalAlignment = horizontalAlignment;
      }

      if (verticalAlignment) {
        cellFormat.verticalAlignment = verticalAlignment;
      }

      if (wrapStrategy) {
        cellFormat.wrapStrategy = wrapStrategy;
      }

      if (textDirection) {
        cellFormat.textDirection = textDirection;
      }

      if (textRotation) {
        cellFormat.textRotation = textRotation;
      }

      if (hyperlinkDisplayType) {
        cellFormat.hyperlinkDisplayType = hyperlinkDisplayType;
      }

      const request = {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0, // This would need to be resolved from sheet name
                startRowIndex: 0,
                endRowIndex: 1000,
                startColumnIndex: 0,
                endColumnIndex: 26
              },
              cell: {
                userEnteredFormat: cellFormat
              },
              fields: Object.keys(cellFormat).map(key => `userEnteredFormat.${key}`).join(',')
            }
          }
        ]
      };

      const response = await axios.post(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
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
        spreadsheetId: response.data.spreadsheetId,
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

export const conditionalFormattingTool = tool({
  description: 'Apply conditional formatting rules to cells based on values or formulas',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    range: z.string().describe('A1 notation range for conditional formatting'),
    condition: z.object({
      type: z.enum(['NUMBER_GREATER', 'NUMBER_GREATER_THAN_EQ', 'NUMBER_LESS', 'NUMBER_LESS_THAN_EQ', 'NUMBER_EQ', 'NUMBER_NOT_EQ', 'NUMBER_BETWEEN', 'NUMBER_NOT_BETWEEN', 'TEXT_CONTAINS', 'TEXT_NOT_CONTAINS', 'TEXT_STARTS_WITH', 'TEXT_ENDS_WITH', 'TEXT_EQ', 'TEXT_IS_EMAIL', 'TEXT_IS_URL', 'DATE_EQ', 'DATE_BEFORE', 'DATE_AFTER', 'DATE_ON_OR_BEFORE', 'DATE_ON_OR_AFTER', 'DATE_BETWEEN', 'DATE_NOT_BETWEEN', 'DATE_IS_VALID', 'ONE_OF_RANGE', 'ONE_OF_LIST', 'BLANK', 'NOT_BLANK', 'CUSTOM_FORMULA']).describe('Type of condition to check'),
      values: z.array(z.object({
        userEnteredValue: z.string().optional(),
        relativeDate: z.enum(['PAST_YEAR', 'PAST_MONTH', 'PAST_WEEK', 'YESTERDAY', 'TODAY', 'TOMORROW']).optional()
      })).optional().describe('Values for the condition (if applicable)')
    }).describe('Condition that triggers formatting'),
    format: z.object({
      backgroundColor: ColorSchema.optional(),
      textFormat: TextFormatSchema.optional()
    }).describe('Formatting to apply when condition is met'),
  }),
  execute: async ({ spreadsheetId, range, condition, format }) => {
    try {
      const request = {
        requests: [
          {
            addConditionalFormatRule: {
              rule: {
                ranges: [
                  {
                    // This would need proper range parsing
                    sheetId: 0,
                    startRowIndex: 0,
                    endRowIndex: 1000,
                    startColumnIndex: 0,
                    endColumnIndex: 26
                  }
                ],
                booleanRule: {
                  condition: condition,
                  format: format
                }
              },
              index: 0
            }
          }
        ]
      };

      const response = await axios.post(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
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
        spreadsheetId: response.data.spreadsheetId,
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

export const clearFormattingTool = tool({
  description: 'Clear formatting from cells in a Google Sheets spreadsheet',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    range: z.string().describe('A1 notation range to clear formatting from'),
    fields: z.string().optional().describe('Specific formatting fields to clear (e.g., "userEnteredFormat.backgroundColor")'),
  }),
  execute: async ({ spreadsheetId, range, fields }) => {
    try {
      const request = {
        requests: [
          {
            repeatCell: {
              range: {
                // This would need proper range parsing
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1000,
                startColumnIndex: 0,
                endColumnIndex: 26
              },
              cell: {},
              fields: fields || 'userEnteredFormat'
            }
          }
        ]
      };

      const response = await axios.post(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
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
        spreadsheetId: response.data.spreadsheetId,
        clearedRange: range,
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