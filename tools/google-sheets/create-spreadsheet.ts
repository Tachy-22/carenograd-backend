import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import { formatError } from '../../types/common';
import { getAccessToken } from '../../utils/auth-context';

export const createSpreadsheetTool = tool({
  description: 'Create a new Google Sheets spreadsheet with specified properties',
  inputSchema: z.object({
    title: z.string().describe('The title of the spreadsheet'),
    locale: z.string().optional().describe('The locale of the spreadsheet (e.g., "en_US")'),
    timeZone: z.string().optional().describe('The timezone of the spreadsheet (e.g., "America/New_York")'),
    sheets: z.array(z.object({
      title: z.string().describe('Title of the sheet'),
      rowCount: z.number().optional().describe('Number of rows in the sheet'),
      columnCount: z.number().optional().describe('Number of columns in the sheet'),
      tabColor: z.object({
        red: z.number().min(0).max(1).optional(),
        green: z.number().min(0).max(1).optional(),
        blue: z.number().min(0).max(1).optional(),
        alpha: z.number().min(0).max(1).optional()
      }).optional().describe('Tab color in RGBA format')
    })).optional().describe('Initial sheets to create'),
  }),
  execute: async ({ title, locale, timeZone, sheets }) => {
    try {
      const requestBody: Record<string, unknown> = {
        properties: {
          title,
          ...(locale && { locale }),
          ...(timeZone && { timeZone })
        }
      };

      if (sheets && sheets.length > 0) {
        requestBody.sheets = sheets.map(sheet => ({
          properties: {
            title: sheet.title,
            gridProperties: {
              rowCount: sheet.rowCount || 1000,
              columnCount: sheet.columnCount || 26
            },
            ...(sheet.tabColor && { tabColor: sheet.tabColor })
          }
        }));
      }

      const accessToken = await getAccessToken();
      const response = await axios.post(
        'https://sheets.googleapis.com/v4/spreadsheets',
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        spreadsheetId: response.data.spreadsheetId,
        spreadsheetUrl: response.data.spreadsheetUrl,
        title: response.data.properties.title,
        locale: response.data.properties.locale,
        timeZone: response.data.properties.timeZone,
        sheets: response.data.sheets?.map((sheet: Record<string, unknown>) => {
          const properties = sheet.properties as Record<string, unknown>;
          return {
            sheetId: properties.sheetId,
            title: properties.title,
            index: properties.index,
            sheetType: properties.sheetType,
            gridProperties: properties.gridProperties,
            tabColor: properties.tabColor
          };
        }) || []
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});