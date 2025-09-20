import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import { formatError } from '../../types/common';
import { getAccessToken } from '../../utils/auth-context';

export const readSpreadsheetByNameTool = tool({
  description: 'Read a Google Sheets spreadsheet by its name (no ID required). Finds the spreadsheet and reads its contents in one step.',
  inputSchema: z.object({
    spreadsheetName: z.string().describe('The name of the spreadsheet (e.g., "Potential Postgraduate Programs - Entekume Jeffrey")'),
    range: z.string().optional().default('A1:Z1000').describe('Range to read in A1 notation (defaults to A1:Z1000)'),
    sheetName: z.string().optional().describe('Specific sheet tab name if known (e.g., "Sheet1", "Programs")'),
    exactMatch: z.boolean().optional().default(false).describe('Whether spreadsheet name must match exactly or allow partial match'),
    readAllSheets: z.boolean().optional().default(true).describe('Whether to read all sheets in the spreadsheet (default true)')
  }),
  execute: async ({ spreadsheetName, range, sheetName, exactMatch, readAllSheets }) => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return { 
        success: false, 
        error: 'Google access token not found. Please reconnect your Google account.' 
      };
    }

    try {
      // Step 1: Find the spreadsheet by name using Drive API
      const searchParams = new URLSearchParams();
      const sheetsQuery = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
      const nameQuery = exactMatch 
        ? `name='${spreadsheetName}'`
        : `name contains '${spreadsheetName}'`;
      
      searchParams.append('q', `${sheetsQuery} and (${nameQuery})`);
      searchParams.append('pageSize', '10');
      searchParams.append('orderBy', 'modifiedTime desc');
      searchParams.append('fields', 'files(id,name,modifiedTime,webViewLink)');

      const searchResponse = await axios.get(
        `https://www.googleapis.com/drive/v3/files?${searchParams.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );

      const files = searchResponse.data.files || [];
      
      if (files.length === 0) {
        return {
          success: false,
          error: `No spreadsheet found with name "${spreadsheetName}". Try using a partial name or check the exact spelling.`,
          searchedName: spreadsheetName,
          suggestions: [
            'Check if the spreadsheet name is spelled correctly',
            'Try searching with just part of the name',
            'Ensure you have access to the spreadsheet'
          ]
        };
      }

      // Use the first (most recently modified) match
      const spreadsheet = files[0];
      const spreadsheetId = spreadsheet.id;

      // Step 2: Get spreadsheet metadata to find all sheets
      const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
      const metadataResponse = await axios.get(metadataUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      });

      const sheets = metadataResponse.data.sheets || [];
      const sheetNames = sheets.map((sheet: any) => sheet.properties.title);

      // Step 3: Read data based on user preference
      if (!readAllSheets || sheetName) {
        // Read single sheet only
        const targetSheetName = sheetName || sheetNames[0];
        const fullRange = targetSheetName ? `${targetSheetName}!${range}` : range;
        
        const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(fullRange)}?valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
        
        const readResponse = await axios.get(readUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        });

        const data = readResponse.data;
        const values = data.values || [];

        return {
          success: true,
          spreadsheetInfo: {
            id: spreadsheetId,
            name: spreadsheet.name,
            webViewLink: spreadsheet.webViewLink,
            lastModified: spreadsheet.modifiedTime,
            totalSheets: sheetNames.length,
            availableSheets: sheetNames
          },
          singleSheet: true,
          sheetName: targetSheetName,
          range: data.range,
          values: values,
          rowCount: values.length,
          columnCount: values[0]?.length || 0,
          hasData: values.length > 0,
          summary: `Read ${values.length} rows from sheet "${targetSheetName}" in "${spreadsheet.name}"`
        };
      } else {
        // Read ALL sheets
        const allSheetsData: Array<{
          sheetName: string;
          range: string;
          values: any[][];
          rowCount: number;
          columnCount: number;
          hasData: boolean;
          preview?: {
            headers: any[];
            firstRows: any[][];
          };
        }> = [];

        // Read each sheet
        for (const sheetName of sheetNames) {
          try {
            const fullRange = `${sheetName}!${range}`;
            const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(fullRange)}?valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
            
            const readResponse = await axios.get(readUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              }
            });

            const data = readResponse.data;
            const values = data.values || [];

            allSheetsData.push({
              sheetName,
              range: data.range || fullRange,
              values,
              rowCount: values.length,
              columnCount: values[0]?.length || 0,
              hasData: values.length > 0,
              preview: values.length > 0 ? {
                headers: values[0] || [],
                firstRows: values.slice(0, Math.min(3, values.length))
              } : undefined
            });
          } catch (sheetError) {
            // If a specific sheet fails, include error info but continue
            allSheetsData.push({
              sheetName,
              range: `${sheetName}!${range}`,
              values: [],
              rowCount: 0,
              columnCount: 0,
              hasData: false,
              preview: undefined
            });
          }
        }

        const totalRows = allSheetsData.reduce((sum, sheet) => sum + sheet.rowCount, 0);
        const sheetsWithData = allSheetsData.filter(sheet => sheet.hasData);

        return {
          success: true,
          spreadsheetInfo: {
            id: spreadsheetId,
            name: spreadsheet.name,
            webViewLink: spreadsheet.webViewLink,
            lastModified: spreadsheet.modifiedTime,
            totalSheets: sheetNames.length,
            availableSheets: sheetNames
          },
          singleSheet: false,
          allSheets: allSheetsData,
          totalRows,
          sheetsWithData: sheetsWithData.length,
          summary: `Read ${totalRows} total rows across ${sheetNames.length} sheets in "${spreadsheet.name}". ${sheetsWithData.length} sheets contain data.`,
          // Provide a quick overview of each sheet
          overview: allSheetsData.map(sheet => ({
            sheetName: sheet.sheetName,
            rowCount: sheet.rowCount,
            hasData: sheet.hasData,
            firstRowPreview: sheet.preview?.headers || []
          }))
        };
      }

    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          return {
            success: false,
            error: `Access denied to spreadsheet "${spreadsheetName}". You may not have permission to read this file.`,
            statusCode: 403
          };
        }
        if (error.response?.status === 404) {
          return {
            success: false,
            error: `Spreadsheet "${spreadsheetName}" not found or range "${sheetName ? sheetName + '!' + range : range}" does not exist.`,
            statusCode: 404
          };
        }
      }
      
      return {
        success: false,
        spreadsheetName,
        ...formatError(error)
      };
    }
  }
});

export const findAndReadMultipleSheetsTool = tool({
  description: 'Find and read multiple spreadsheets by name patterns. Useful for reading several related spreadsheets at once.',
  inputSchema: z.object({
    searchTerms: z.array(z.string()).describe('Array of spreadsheet names or search terms'),
    range: z.string().optional().default('A1:Z100').describe('Range to read from each spreadsheet'),
    maxResults: z.number().optional().default(5).describe('Maximum number of spreadsheets to read per search term')
  }),
  execute: async ({ searchTerms, range, maxResults }) => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return { 
        success: false, 
        error: 'Google access token not found. Please reconnect your Google account.' 
      };
    }

    const results: Array<{
      searchTerm: string;
      spreadsheet?: {
        id: string;
        name: string;
        webViewLink: string;
        lastModified?: string;
      };
      data?: {
        range: string;
        values: any[][];
        rowCount: number;
        columnCount: number;
      };
      error?: string;
    }> = [];

    for (const searchTerm of searchTerms) {
      try {
        // Find matching spreadsheets
        const searchParams = new URLSearchParams();
        const sheetsQuery = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
        const nameQuery = `name contains '${searchTerm}'`;
        
        searchParams.append('q', `${sheetsQuery} and (${nameQuery})`);
        searchParams.append('pageSize', maxResults.toString());
        searchParams.append('orderBy', 'modifiedTime desc');
        searchParams.append('fields', 'files(id,name,modifiedTime,webViewLink)');

        const searchResponse = await axios.get(
          `https://www.googleapis.com/drive/v3/files?${searchParams.toString()}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            }
          }
        );

        const files = searchResponse.data.files || [];
        
        for (const file of files) {
          try {
            // Read each spreadsheet
            const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${file.id}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;
            
            const readResponse = await axios.get(readUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              }
            });

            const data = readResponse.data;
            const values = data.values || [];

            results.push({
              searchTerm,
              spreadsheet: {
                id: file.id,
                name: file.name,
                webViewLink: file.webViewLink,
                lastModified: file.modifiedTime
              },
              data: {
                range: data.range,
                values: values,
                rowCount: values.length,
                columnCount: values[0]?.length || 0
              }
            });
          } catch (readError) {
            results.push({
              searchTerm,
              spreadsheet: {
                id: file.id,
                name: file.name,
                webViewLink: file.webViewLink
              },
              error: `Could not read spreadsheet: ${readError instanceof Error ? readError.message : 'Unknown error'}`
            });
          }
        }
      } catch (searchError) {
        results.push({
          searchTerm,
          error: `Could not search for "${searchTerm}": ${searchError instanceof Error ? searchError.message : 'Unknown error'}`
        });
      }
    }

    return {
      success: true,
      searchTerms,
      results,
      totalFound: results.filter(r => !r.error).length,
      summary: `Found and read ${results.filter(r => !r.error).length} spreadsheets across ${searchTerms.length} search terms`
    };
  }
});