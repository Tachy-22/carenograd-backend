import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import type { GoogleSheetsSheetProperties, GoogleSheetsDuplicateSheetRequest } from '../../types/google-sheets';
import { formatError } from '../../types/common';
import { getAccessToken } from '../../utils/auth-context';

export const addSheetTool = tool({
  description: 'Add a new sheet (tab) to an existing Google Sheets spreadsheet',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    title: z.string().describe('Title of the new sheet'),
    index: z.number().optional().describe('Position index for the new sheet (0-based)'),
    sheetType: z.enum(['GRID', 'OBJECT']).optional().describe('Type of sheet to create'),
    gridProperties: z.object({
      rowCount: z.number().optional(),
      columnCount: z.number().optional(),
      frozenRowCount: z.number().optional(),
      frozenColumnCount: z.number().optional(),
      hideGridlines: z.boolean().optional(),
      rowGroupControlAfter: z.boolean().optional(),
      columnGroupControlAfter: z.boolean().optional()
    }).optional().describe('Grid properties for the sheet'),
    tabColor: z.object({
      red: z.number().min(0).max(1).optional(),
      green: z.number().min(0).max(1).optional(),
      blue: z.number().min(0).max(1).optional(),
      alpha: z.number().min(0).max(1).optional()
    }).optional().describe('Tab color in RGBA format'),
    rightToLeft: z.boolean().optional().describe('Whether the sheet is right-to-left'),
    hidden: z.boolean().optional().describe('Whether the sheet should be hidden'),
  }),
  execute: async ({ spreadsheetId, title, index, sheetType, gridProperties, tabColor, rightToLeft, hidden }) => {
    try {
      const sheetProperties: Partial<GoogleSheetsSheetProperties> = {
        title
      };

      if (index !== undefined) sheetProperties.index = index;
      if (sheetType) sheetProperties.sheetType = sheetType;
      if (gridProperties) sheetProperties.gridProperties = gridProperties;
      if (tabColor) sheetProperties.tabColor = tabColor;
      if (rightToLeft !== undefined) sheetProperties.rightToLeft = rightToLeft;
      if (hidden !== undefined) sheetProperties.hidden = hidden;

      const request = {
        requests: [
          {
            addSheet: {
              properties: sheetProperties
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

      const addSheetReply = response.data.replies?.[0]?.addSheet;

      return {
        success: true,
        spreadsheetId: response.data.spreadsheetId,
        addedSheet: {
          sheetId: addSheetReply?.properties?.sheetId,
          title: addSheetReply?.properties?.title,
          index: addSheetReply?.properties?.index,
          sheetType: addSheetReply?.properties?.sheetType,
          gridProperties: addSheetReply?.properties?.gridProperties,
          tabColor: addSheetReply?.properties?.tabColor
        }
      };
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { status?: number; data?: unknown } };
      return {
        success: false,
        error: err.message || 'Unknown error',
        statusCode: err.response?.status,
        details: err.response?.data
      };
    }
  }
});

export const deleteSheetTool = tool({
  description: 'Delete a sheet (tab) from a Google Sheets spreadsheet',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sheetId: z.number().describe('The ID of the sheet to delete'),
  }),
  execute: async ({ spreadsheetId, sheetId }) => {
    try {
      const request = {
        requests: [
          {
            deleteSheet: {
              sheetId: sheetId
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
        deletedSheetId: sheetId
      };
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { status?: number; data?: unknown } };
      return {
        success: false,
        error: err.message || 'Unknown error',
        statusCode: err.response?.status,
        details: err.response?.data
      };
    }
  }
});

export const duplicateSheetTool = tool({
  description: 'Duplicate an existing sheet within a Google Sheets spreadsheet',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sourceSheetId: z.number().describe('The ID of the sheet to duplicate'),
    insertSheetIndex: z.number().optional().describe('Index where the new sheet should be inserted'),
    newSheetId: z.number().optional().describe('ID for the new sheet (auto-generated if not provided)'),
    newSheetName: z.string().optional().describe('Name for the duplicated sheet'),
  }),
  execute: async ({ spreadsheetId, sourceSheetId, insertSheetIndex, newSheetId, newSheetName }) => {
    try {
      const duplicateSheetRequest: Partial<GoogleSheetsDuplicateSheetRequest> = {
        sourceSheetId: sourceSheetId
      };

      if (insertSheetIndex !== undefined) duplicateSheetRequest.insertSheetIndex = insertSheetIndex;
      if (newSheetId !== undefined) duplicateSheetRequest.newSheetId = newSheetId;
      if (newSheetName) duplicateSheetRequest.newSheetName = newSheetName;

      const request = {
        requests: [
          {
            duplicateSheet: duplicateSheetRequest
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

      const duplicateSheetReply = response.data.replies?.[0]?.duplicateSheet;

      return {
        success: true,
        spreadsheetId: response.data.spreadsheetId,
        duplicatedSheet: {
          sheetId: duplicateSheetReply?.properties?.sheetId,
          title: duplicateSheetReply?.properties?.title,
          index: duplicateSheetReply?.properties?.index,
          sheetType: duplicateSheetReply?.properties?.sheetType,
          gridProperties: duplicateSheetReply?.properties?.gridProperties
        }
      };
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { status?: number; data?: unknown } };
      return {
        success: false,
        error: err.message || 'Unknown error',
        statusCode: err.response?.status,
        details: err.response?.data
      };
    }
  }
});

export const updateSheetPropertiesTool = tool({
  description: 'Update properties of an existing sheet in a Google Sheets spreadsheet',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sheetId: z.number().describe('The ID of the sheet to update'),
    title: z.string().optional().describe('New title for the sheet'),
    index: z.number().optional().describe('New position index for the sheet'),
    gridProperties: z.object({
      rowCount: z.number().optional(),
      columnCount: z.number().optional(),
      frozenRowCount: z.number().optional(),
      frozenColumnCount: z.number().optional(),
      hideGridlines: z.boolean().optional(),
      rowGroupControlAfter: z.boolean().optional(),
      columnGroupControlAfter: z.boolean().optional()
    }).optional().describe('Grid properties to update'),
    tabColor: z.object({
      red: z.number().min(0).max(1).optional(),
      green: z.number().min(0).max(1).optional(),
      blue: z.number().min(0).max(1).optional(),
      alpha: z.number().min(0).max(1).optional()
    }).optional().describe('New tab color in RGBA format'),
    rightToLeft: z.boolean().optional().describe('Whether the sheet is right-to-left'),
    hidden: z.boolean().optional().describe('Whether the sheet should be hidden'),
  }),
  execute: async ({ spreadsheetId, sheetId, title, index, gridProperties, tabColor, rightToLeft, hidden }) => {
    try {
      const properties: Partial<GoogleSheetsSheetProperties> = {
        sheetId: sheetId
      };

      const fields = ['sheetId'];

      if (title !== undefined) {
        properties.title = title;
        fields.push('title');
      }
      if (index !== undefined) {
        properties.index = index;
        fields.push('index');
      }
      if (gridProperties) {
        properties.gridProperties = gridProperties;
        fields.push('gridProperties');
      }
      if (tabColor) {
        properties.tabColor = tabColor;
        fields.push('tabColor');
      }
      if (rightToLeft !== undefined) {
        properties.rightToLeft = rightToLeft;
        fields.push('rightToLeft');
      }
      if (hidden !== undefined) {
        properties.hidden = hidden;
        fields.push('hidden');
      }

      const request = {
        requests: [
          {
            updateSheetProperties: {
              properties: properties,
              fields: fields.join(',')
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
        updatedSheetId: sheetId,
        updatedProperties: properties
      };
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { status?: number; data?: unknown } };
      return {
        success: false,
        error: err.message || 'Unknown error',
        statusCode: err.response?.status,
        details: err.response?.data
      };
    }
  }
});

export const insertRowsColumnsTool = tool({
  description: 'Insert rows or columns in a Google Sheets spreadsheet',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sheetId: z.number().describe('The ID of the sheet'),
    dimension: z.enum(['ROWS', 'COLUMNS']).describe('Whether to insert rows or columns'),
    startIndex: z.number().describe('The start index for insertion (0-based)'),
    endIndex: z.number().describe('The end index for insertion (exclusive)'),
    inheritFromBefore: z.boolean().optional().describe('Whether to inherit properties from the row/column before the insertion point'),
  }),
  execute: async ({ spreadsheetId, sheetId, dimension, startIndex, endIndex, inheritFromBefore }) => {
    try {
      const request = {
        requests: [
          {
            insertDimension: {
              range: {
                sheetId: sheetId,
                dimension: dimension,
                startIndex: startIndex,
                endIndex: endIndex
              },
              inheritFromBefore: inheritFromBefore || false
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
        insertedDimension: dimension,
        insertedRange: {
          sheetId,
          startIndex,
          endIndex,
          count: endIndex - startIndex
        }
      };
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { status?: number; data?: unknown } };
      return {
        success: false,
        error: err.message || 'Unknown error',
        statusCode: err.response?.status,
        details: err.response?.data
      };
    }
  }
});

export const deleteRowsColumnsTool = tool({
  description: 'Delete rows or columns from a Google Sheets spreadsheet',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sheetId: z.number().describe('The ID of the sheet'),
    dimension: z.enum(['ROWS', 'COLUMNS']).describe('Whether to delete rows or columns'),
    startIndex: z.number().describe('The start index for deletion (0-based, inclusive)'),
    endIndex: z.number().describe('The end index for deletion (exclusive)'),
  }),
  execute: async ({ spreadsheetId, sheetId, dimension, startIndex, endIndex }) => {
    try {
      const request = {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: dimension,
                startIndex: startIndex,
                endIndex: endIndex
              }
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
        deletedDimension: dimension,
        deletedRange: {
          sheetId,
          startIndex,
          endIndex,
          count: endIndex - startIndex
        }
      };
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { status?: number; data?: unknown } };
      return {
        success: false,
        error: err.message || 'Unknown error',
        statusCode: err.response?.status,
        details: err.response?.data
      };
    }
  }
});