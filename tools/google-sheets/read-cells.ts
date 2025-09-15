import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import { formatError } from '../../types/common';
import { getAccessToken } from '../../utils/auth-context';

export const readCellsTool = tool({
  description: 'Read cell values from a Google Sheets spreadsheet with flexible range selection',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    range: z.string().describe('A1 notation range (e.g., "Sheet1!A1:B10", "A1:C", "Sheet2!B:B")'),
    valueRenderOption: z.enum(['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA']).optional().describe('How values should be represented'),
    dateTimeRenderOption: z.enum(['SERIAL_NUMBER', 'FORMATTED_STRING']).optional().describe('How dates should be rendered'),
    majorDimension: z.enum(['ROWS', 'COLUMNS']).optional().describe('Indicates which dimension results are returned along'),
  }),
  execute: async ({ spreadsheetId, range, valueRenderOption, dateTimeRenderOption, majorDimension }) => {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return { success: false, error: 'Google access token not found in environment variables' };
    }
    try {
      const params = new URLSearchParams();

      if (valueRenderOption) {
        params.append('valueRenderOption', valueRenderOption);
      }

      if (dateTimeRenderOption) {
        params.append('dateTimeRenderOption', dateTimeRenderOption);
      }

      if (majorDimension) {
        params.append('majorDimension', majorDimension);
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}${params.toString() ? '?' + params.toString() : ''}`;

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${await getAccessToken()}`,
        }
      });

      const data = response.data;

      return {
        success: true,
        range: data.range,
        majorDimension: data.majorDimension,
        values: data.values || [],
        rowCount: data.values?.length || 0,
        columnCount: data.values?.[0]?.length || 0
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const readMultipleRangesTool = tool({
  description: 'Read multiple cell ranges from a Google Sheets spreadsheet in a single request',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    ranges: z.array(z.string()).describe('Array of A1 notation ranges (e.g., ["Sheet1!A1:B10", "Sheet2!C1:D5"])'),
    valueRenderOption: z.enum(['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA']).optional().describe('How values should be represented'),
    dateTimeRenderOption: z.enum(['SERIAL_NUMBER', 'FORMATTED_STRING']).optional().describe('How dates should be rendered'),
    majorDimension: z.enum(['ROWS', 'COLUMNS']).optional().describe('Indicates which dimension results are returned along'),
  }),
  execute: async ({ spreadsheetId, ranges, valueRenderOption, dateTimeRenderOption, majorDimension }) => {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return { success: false, error: 'Google access token not found in environment variables' };
    }
    try {
      const params = new URLSearchParams();

      ranges.forEach(range => params.append('ranges', range));

      if (valueRenderOption) {
        params.append('valueRenderOption', valueRenderOption);
      }

      if (dateTimeRenderOption) {
        params.append('dateTimeRenderOption', dateTimeRenderOption);
      }

      if (majorDimension) {
        params.append('majorDimension', majorDimension);
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${params.toString()}`;

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${await getAccessToken()}`,
        }
      });

      const data = response.data;

      return {
        success: true,
        spreadsheetId: data.spreadsheetId,
        valueRanges: data.valueRanges?.map((valueRange: Record<string, unknown>) => {
          const values = Array.isArray(valueRange.values) ? valueRange.values : [];
          return {
            range: valueRange.range,
            majorDimension: valueRange.majorDimension,
            values: values,
            rowCount: values.length,
            columnCount: values[0]?.length || 0
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