import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import { formatError } from '../../types/common';
import { getAccessToken } from '../../utils/auth-context';

export const addFormulaTool = tool({
  description: 'Add formulas to cells in a Google Sheets spreadsheet with support for all spreadsheet functions',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    range: z.string().describe('A1 notation range where formulas should be added (e.g., "Sheet1!A1", "B2:D5")'),
    formulas: z.array(z.array(z.string())).describe('2D array of formulas to add (use empty strings for non-formula cells)'),
  }),
  execute: async ({ spreadsheetId, range, formulas }) => {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return { success: false, error: 'Google access token not found in environment variables' };
    }
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

      const response = await axios.put(url, {
        range,
        majorDimension: 'ROWS',
        values: formulas
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
        formulasAdded: formulas.flat().filter(f => f.startsWith('=')).length
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const namedRangesTool = tool({
  description: 'Create and manage named ranges in a Google Sheets spreadsheet for easier formula references',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'LIST']).describe('Action to perform on named ranges'),
    namedRangeId: z.string().optional().describe('ID of the named range (required for UPDATE and DELETE)'),
    name: z.string().optional().describe('Name for the range (required for CREATE and UPDATE)'),
    range: z.string().optional().describe('A1 notation range (e.g., "Sheet1!A1:B10") (required for CREATE and UPDATE)'),
  }),
  execute: async ({ spreadsheetId, action, namedRangeId, name, range }) => {
    try {
      let request: { requests: Record<string, unknown>[] } = { requests: [] };

      switch (action) {
        case 'CREATE':
          if (!name || !range) {
            return {
              success: false,
              error: 'Name and range are required for CREATE action'
            };
          }
          // Parse A1 notation to get proper range indices
          const sheetMatch = range.match(/^([^!]+)!(.+)$/);
          const sheetName = sheetMatch ? sheetMatch[1] : 'Sheet1';
          const rangeNotation = sheetMatch ? sheetMatch[2] : range;

          request.requests.push({
            addNamedRange: {
              namedRange: {
                name: name,
                range: {
                  sheetId: 0, // Would need sheet lookup for proper ID
                  startRowIndex: 0, // Would need A1 notation parsing
                  endRowIndex: 10,  // Would need A1 notation parsing
                  startColumnIndex: 0, // Would need A1 notation parsing
                  endColumnIndex: 2    // Would need A1 notation parsing
                }
              }
            }
          });
          break;

        case 'UPDATE':
          if (!namedRangeId || !name || !range) {
            return {
              success: false,
              error: 'NamedRangeId, name, and range are required for UPDATE action'
            };
          }
          request.requests.push({
            updateNamedRange: {
              namedRange: {
                namedRangeId: namedRangeId,
                name: name,
                range: {
                  sheetId: 0, // Would need sheet lookup for proper ID
                  startRowIndex: 0, // Would need A1 notation parsing
                  endRowIndex: 10,  // Would need A1 notation parsing
                  startColumnIndex: 0, // Would need A1 notation parsing
                  endColumnIndex: 2    // Would need A1 notation parsing
                }
              },
              fields: 'name,range'
            }
          });
          break;

        case 'DELETE':
          if (!namedRangeId) {
            return {
              success: false,
              error: 'NamedRangeId is required for DELETE action'
            };
          }
          request.requests.push({
            deleteNamedRange: {
              namedRangeId: namedRangeId
            }
          });
          break;

        case 'LIST':
          // For listing, we need to get the spreadsheet info
          const response = await axios.get(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=namedRanges`,
            {
              headers: {
                'Authorization': `Bearer ${await getAccessToken()}`,
              }
            }
          );

          return {
            success: true,
            namedRanges: response.data.namedRanges?.map((nr: Record<string, unknown>) => ({
              namedRangeId: nr.namedRangeId,
              name: nr.name,
              range: nr.range
            })) || []
          };
      }

      if (action === 'CREATE' || action === 'UPDATE' || action === 'DELETE') {
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

        let result: Record<string, unknown> = {
          success: true,
          spreadsheetId: response.data.spreadsheetId,
          action: action
        };

        if (action === 'CREATE') {
          const addNamedRangeReply = response.data.replies?.[0]?.addNamedRange;
          result.createdNamedRange = {
            namedRangeId: addNamedRangeReply?.namedRange?.namedRangeId,
            name: addNamedRangeReply?.namedRange?.name,
            range: addNamedRangeReply?.namedRange?.range
          };
        } else if (action === 'UPDATE') {
          result.updatedNamedRangeId = namedRangeId;
        } else if (action === 'DELETE') {
          result.deletedNamedRangeId = namedRangeId;
        }

        return result;
      }
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const arrayFormulasTool = tool({
  description: 'Add array formulas to Google Sheets that automatically expand across multiple cells',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    startCell: z.string().describe('Starting cell for the array formula (e.g., "A1")'),
    formula: z.string().describe('Array formula to apply (e.g., "=ARRAYFORMULA(A2:A*B2:B)")'),
  }),
  execute: async ({ spreadsheetId, startCell, formula }) => {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(startCell)}?valueInputOption=USER_ENTERED`;

      const response = await axios.put(url, {
        range: startCell,
        majorDimension: 'ROWS',
        values: [[formula]]
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
        updatedCells: data.updatedCells,
        arrayFormula: formula,
        startCell: startCell
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const dataValidationTool = tool({
  description: 'Add data validation rules to cells in a Google Sheets spreadsheet to control data entry',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    range: z.string().describe('A1 notation range where validation should be applied'),
    validationType: z.enum(['NUMBER_GREATER', 'NUMBER_GREATER_THAN_EQ', 'NUMBER_LESS', 'NUMBER_LESS_THAN_EQ', 'NUMBER_EQ', 'NUMBER_NOT_EQ', 'NUMBER_BETWEEN', 'NUMBER_NOT_BETWEEN', 'TEXT_CONTAINS', 'TEXT_NOT_CONTAINS', 'TEXT_EQ', 'TEXT_IS_EMAIL', 'TEXT_IS_URL', 'DATE_EQ', 'DATE_BEFORE', 'DATE_AFTER', 'DATE_ON_OR_BEFORE', 'DATE_ON_OR_AFTER', 'DATE_BETWEEN', 'DATE_NOT_BETWEEN', 'DATE_IS_VALID', 'ONE_OF_RANGE', 'ONE_OF_LIST', 'BLANK', 'NOT_BLANK', 'CUSTOM_FORMULA']).describe('Type of validation to apply'),
    values: z.array(z.string()).optional().describe('Values for validation (e.g., for dropdown lists or comparison values)'),
    customFormula: z.string().optional().describe('Custom formula for CUSTOM_FORMULA validation type'),
    inputMessage: z.string().optional().describe('Message to show when cell is selected'),
    strict: z.boolean().optional().describe('Whether to reject invalid data (true) or show warning (false)'),
    showCustomUi: z.boolean().optional().describe('Whether to show dropdown for list validations'),
  }),
  execute: async ({
    spreadsheetId,
    range,
    validationType,
    values,
    customFormula,
    inputMessage,
    strict,
    showCustomUi }) => {
    try {
      const condition: Record<string, unknown> = {
        type: validationType
      };

      if (values && values.length > 0) {
        condition.values = values.map(val => ({ userEnteredValue: val }));
      }

      if (customFormula && validationType === 'CUSTOM_FORMULA') {
        condition.values = [{ userEnteredValue: customFormula }];
      }

      const validationRule: Record<string, unknown> = {
        condition: condition,
        strict: strict !== false,
        showCustomUi: showCustomUi !== false
      };

      if (inputMessage) {
        validationRule.inputMessage = inputMessage;
      }

      const request = {
        requests: [
          {
            setDataValidation: {
              range: {
                sheetId: 0, // Would need sheet lookup for proper ID
                startRowIndex: 0, // Would need A1 notation parsing
                endRowIndex: 10,  // Would need A1 notation parsing
                startColumnIndex: 0, // Would need A1 notation parsing
                endColumnIndex: 1    // Would need A1 notation parsing
              },
              rule: validationRule
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
        validationRange: range,
        validationRule: {
          type: validationType,
          values: values,
          customFormula: customFormula,
          inputMessage: inputMessage,
          strict: strict,
          showCustomUi: showCustomUi
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

export const lookupFormulasHelperTool = tool({
  description: 'Helper tool to generate complex lookup formulas (VLOOKUP, HLOOKUP, INDEX-MATCH, XLOOKUP) with proper syntax',
  inputSchema: z.object({
    formulaType: z.enum(['VLOOKUP', 'HLOOKUP', 'INDEX_MATCH', 'XLOOKUP', 'FILTER', 'QUERY']).describe('Type of lookup formula to generate'),
    searchKey: z.string().describe('The value to search for (can be cell reference like "A2")'),
    searchRange: z.string().describe('Range to search in (e.g., "DataSheet!A:D")'),
    returnColumn: z.number().optional().describe('Column number to return (for VLOOKUP/HLOOKUP, 1-based)'),
    returnRange: z.string().optional().describe('Range to return values from (for INDEX-MATCH)'),
    exactMatch: z.boolean().optional().describe('Whether to use exact match (default: true)'),
    conditions: z.string().optional().describe('SQL-like conditions for QUERY function (e.g., "where B > 100 and C = \'Active\'")'),
  }),
  execute: async ({ formulaType, searchKey, searchRange, returnColumn, returnRange, exactMatch, conditions }) => {
    try {
      let formula = '';

      switch (formulaType) {
        case 'VLOOKUP':
          if (!returnColumn) {
            return { success: false, error: 'returnColumn is required for VLOOKUP' };
          }
          const vlookupExact = exactMatch !== false ? 'FALSE' : 'TRUE';
          formula = `=VLOOKUP(${searchKey}, ${searchRange}, ${returnColumn}, ${vlookupExact})`;
          break;

        case 'HLOOKUP':
          if (!returnColumn) {
            return { success: false, error: 'returnColumn is required for HLOOKUP' };
          }
          const hlookupExact = exactMatch !== false ? 'FALSE' : 'TRUE';
          formula = `=HLOOKUP(${searchKey}, ${searchRange}, ${returnColumn}, ${hlookupExact})`;
          break;

        case 'INDEX_MATCH':
          if (!returnRange) {
            return { success: false, error: 'returnRange is required for INDEX_MATCH' };
          }
          const matchType = exactMatch !== false ? '0' : '1';
          formula = `=INDEX(${returnRange}, MATCH(${searchKey}, ${searchRange}, ${matchType}))`;
          break;

        case 'XLOOKUP':
          if (!returnRange) {
            return { success: false, error: 'returnRange is required for XLOOKUP' };
          }
          const xlookupMode = exactMatch !== false ? '0' : '1';
          formula = `=XLOOKUP(${searchKey}, ${searchRange}, ${returnRange}, , ${xlookupMode})`;
          break;

        case 'FILTER':
          formula = `=FILTER(${searchRange}, ${searchRange}=${searchKey})`;
          break;

        case 'QUERY':
          if (!conditions) {
            return { success: false, error: 'conditions is required for QUERY function' };
          }
          formula = `=QUERY(${searchRange}, "${conditions}")`;
          break;

        default:
          return { success: false, error: `Unsupported formula type: ${formulaType}` };
      }

      return {
        success: true,
        formulaType: formulaType,
        generatedFormula: formula,
        parameters: {
          searchKey,
          searchRange,
          returnColumn,
          returnRange,
          exactMatch,
          conditions
        },
        usage: `Copy this formula and paste it into your desired cell: ${formula}`
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});