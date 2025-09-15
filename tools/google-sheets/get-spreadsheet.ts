import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import { formatError } from '../../types/common';
import { getAccessToken } from '../../utils/auth-context';

export const getSpreadsheetTool = tool({
  description: 'Get detailed information about a Google Sheets spreadsheet including metadata and sheets',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    includeGridData: z.boolean().optional().describe('Whether to include grid data in the response'),
    ranges: z.array(z.string()).optional().describe('Specific ranges to include (e.g., ["Sheet1!A1:B10", "Sheet2!C1:D5"])'),
    fields: z.string().optional().describe('Specific fields to return (e.g., "properties,sheets.properties")'),
  }),
  execute: async ({ spreadsheetId, includeGridData, ranges, fields }) => {
    try {
      const params = new URLSearchParams();

      if (includeGridData) {
        params.append('includeGridData', 'true');
      }

      if (ranges && ranges.length > 0) {
        ranges.forEach(range => params.append('ranges', range));
      }

      if (fields) {
        params.append('fields', fields);
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${params.toString() ? '?' + params.toString() : ''}`;

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${await getAccessToken()}`,
        }
      });

      const data = response.data;

      return {
        success: true,
        spreadsheetId: data.spreadsheetId,
        properties: {
          title: data.properties?.title,
          locale: data.properties?.locale,
          timeZone: data.properties?.timeZone,
          autoRecalc: data.properties?.autoRecalc,
          defaultFormat: data.properties?.defaultFormat,
          iterativeCalculationSettings: data.properties?.iterativeCalculationSettings,
          spreadsheetTheme: data.properties?.spreadsheetTheme
        },
        sheets: data.sheets?.map((sheet: Record<string, unknown>) => {
          const properties = sheet.properties as Record<string, unknown>;
          return {
            sheetId: properties.sheetId,
            title: properties.title,
            index: properties.index,
            sheetType: properties.sheetType,
            gridProperties: properties.gridProperties,
            tabColor: properties.tabColor,
            rightToLeft: properties.rightToLeft,
            hidden: properties.hidden,
            ...(sheet.data && typeof sheet.data === 'object' ? { data: sheet.data } : {})
          };
        }) || [],
        namedRanges: data.namedRanges?.map((range: Record<string, unknown>) => ({
          namedRangeId: range.namedRangeId,
          name: range.name,
          range: range.range
        })) || [],
        spreadsheetUrl: data.spreadsheetUrl,
        developerMetadata: data.developerMetadata || []
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});