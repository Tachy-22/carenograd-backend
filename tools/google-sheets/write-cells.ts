import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import { formatError } from '../../types/common';
import { getAccessToken } from '../../utils/auth-context';

export const writeCellsTool = tool({
  description: 'Write values to cells in a Google Sheets spreadsheet with flexible data input',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    range: z.string().describe('A1 notation range where data should be written (e.g., "Sheet1!A1", "A1:B10")'),
    values: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).describe('2D array of values to write (rows and columns)'),
    valueInputOption: z.enum(['RAW', 'USER_ENTERED']).optional().describe('How input data should be interpreted (RAW = literal, USER_ENTERED = parsed)'),
    insertDataOption: z.enum(['OVERWRITE', 'INSERT_ROWS']).optional().describe('How data should be inserted'),
    includeValuesInResponse: z.boolean().optional().describe('Whether to include updated values in response'),
    responseValueRenderOption: z.enum(['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA']).optional().describe('How response values should be rendered'),
    responseDateTimeRenderOption: z.enum(['SERIAL_NUMBER', 'FORMATTED_STRING']).optional().describe('How response dates should be rendered'),
  }),
  execute: async ({
    spreadsheetId,
    range,
    values,
    valueInputOption,
    insertDataOption,
    includeValuesInResponse,
    responseValueRenderOption,
    responseDateTimeRenderOption,
  }) => {
    try {
      const params = new URLSearchParams();

      if (valueInputOption) {
        params.append('valueInputOption', valueInputOption);
      }

      if (insertDataOption) {
        params.append('insertDataOption', insertDataOption);
      }

      if (includeValuesInResponse) {
        params.append('includeValuesInResponse', 'true');
      }

      if (responseValueRenderOption) {
        params.append('responseValueRenderOption', responseValueRenderOption);
      }

      if (responseDateTimeRenderOption) {
        params.append('responseDateTimeRenderOption', responseDateTimeRenderOption);
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}${params.toString() ? '?' + params.toString() : ''}`;

      const response = await axios.put(url, {
        range,
        majorDimension: 'ROWS',
        values
      }, {
        headers: {
          'Authorization': `Bearer ${await getAccessToken()}`,
          'Content-Type': 'application/json'
        }
      });

      const data = response.data;

      return {
        success: true,
        spreadsheetId: data.spreadsheetId,
        updatedRange: data.updatedRange,
        updatedRows: data.updatedRows,
        updatedColumns: data.updatedColumns,
        updatedCells: data.updatedCells,
        updatedData: data.updatedData || null
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const batchWriteCellsTool = tool({
  description: 'Write values to multiple ranges in a Google Sheets spreadsheet in a single batch request',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    valueRanges: z.array(z.object({
      range: z.string().describe('A1 notation range'),
      values: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).describe('2D array of values for this range')
    })).describe('Array of ranges and their corresponding values'),
    valueInputOption: z.enum(['RAW', 'USER_ENTERED']).optional().describe('How input data should be interpreted'),
    includeValuesInResponse: z.boolean().optional().describe('Whether to include updated values in response'),
    responseValueRenderOption: z.enum(['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA']).optional().describe('How response values should be rendered'),
    responseDateTimeRenderOption: z.enum(['SERIAL_NUMBER', 'FORMATTED_STRING']).optional().describe('How response dates should be rendered'),
  }),
  execute: async ({
    spreadsheetId,
    valueRanges,
    valueInputOption,
    includeValuesInResponse,
    responseValueRenderOption,
    responseDateTimeRenderOption,
  }) => {
    try {
      const params = new URLSearchParams();

      if (valueInputOption) {
        params.append('valueInputOption', valueInputOption);
      }

      if (includeValuesInResponse) {
        params.append('includeValuesInResponse', 'true');
      }

      if (responseValueRenderOption) {
        params.append('responseValueRenderOption', responseValueRenderOption);
      }

      if (responseDateTimeRenderOption) {
        params.append('responseDateTimeRenderOption', responseDateTimeRenderOption);
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate${params.toString() ? '?' + params.toString() : ''}`;

      const requestBody = {
        valueInputOption: valueInputOption || 'USER_ENTERED',
        data: valueRanges.map(vr => ({
          range: vr.range,
          majorDimension: 'ROWS',
          values: vr.values
        }))
      };

      const response = await axios.post(url, requestBody, {
        headers: {
          'Authorization': `Bearer ${await getAccessToken()}`,
          'Content-Type': 'application/json'
        }
      });

      const data = response.data;

      return {
        success: true,
        spreadsheetId: data.spreadsheetId,
        totalUpdatedRows: data.totalUpdatedRows,
        totalUpdatedColumns: data.totalUpdatedColumns,
        totalUpdatedCells: data.totalUpdatedCells,
        totalUpdatedSheets: data.totalUpdatedSheets,
        responses: data.responses?.map((resp: Record<string, unknown>) => ({
          spreadsheetId: resp.spreadsheetId,
          updatedRange: resp.updatedRange,
          updatedRows: resp.updatedRows,
          updatedColumns: resp.updatedColumns,
          updatedCells: resp.updatedCells,
          updatedData: resp.updatedData
        })) || []
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const appendCellsTool = tool({
  description: 'Append values to the end of existing data in a Google Sheets spreadsheet',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    range: z.string().describe('A1 notation range indicating where to search for existing data (e.g., "Sheet1!A1:D1")'),
    values: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).describe('2D array of values to append'),
    valueInputOption: z.enum(['RAW', 'USER_ENTERED']).optional().describe('How input data should be interpreted'),
    insertDataOption: z.enum(['OVERWRITE', 'INSERT_ROWS']).optional().describe('How data should be inserted'),
    includeValuesInResponse: z.boolean().optional().describe('Whether to include updated values in response'),
    responseValueRenderOption: z.enum(['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA']).optional().describe('How response values should be rendered'),
    responseDateTimeRenderOption: z.enum(['SERIAL_NUMBER', 'FORMATTED_STRING']).optional().describe('How response dates should be rendered'),
  }),
  execute: async ({
    spreadsheetId,
    range,
    values,
    valueInputOption,
    insertDataOption,
    includeValuesInResponse,
    responseValueRenderOption,
    responseDateTimeRenderOption,
  }) => {
    try {
      const params = new URLSearchParams();

      if (valueInputOption) {
        params.append('valueInputOption', valueInputOption);
      }

      if (insertDataOption) {
        params.append('insertDataOption', insertDataOption);
      }

      if (includeValuesInResponse) {
        params.append('includeValuesInResponse', 'true');
      }

      if (responseValueRenderOption) {
        params.append('responseValueRenderOption', responseValueRenderOption);
      }

      if (responseDateTimeRenderOption) {
        params.append('responseDateTimeRenderOption', responseDateTimeRenderOption);
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append${params.toString() ? '?' + params.toString() : ''}`;

      const response = await axios.post(url, {
        range,
        majorDimension: 'ROWS',
        values
      }, {
        headers: {
          'Authorization': `Bearer ${await getAccessToken()}`,
          'Content-Type': 'application/json'
        }
      });

      const data = response.data;

      return {
        success: true,
        spreadsheetId: data.spreadsheetId,
        tableRange: data.tableRange,
        updatedRange: data.updates?.updatedRange,
        updatedRows: data.updates?.updatedRows,
        updatedColumns: data.updates?.updatedColumns,
        updatedCells: data.updates?.updatedCells,
        updatedData: data.updates?.updatedData || null
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});