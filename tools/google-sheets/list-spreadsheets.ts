import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import { formatError } from '../../types/common';
import { getAccessToken } from '../../utils/auth-context';

export const listSpreadsheetsTool = tool({
  description: 'List Google Sheets spreadsheets from Google Drive with filtering and pagination',
  inputSchema: z.object({
    pageSize: z.number().min(1).max(1000).optional().describe('Number of files to return (max 1000)'),
    pageToken: z.string().optional().describe('Token for pagination from previous response'),
    query: z.string().optional().describe('Search query (e.g., "name contains \'budget\'" or "starred = true")'),
    orderBy: z.string().optional().describe('Sort order (e.g., "name", "createdTime", "modifiedTime", "starred")'),
    fields: z.string().optional().describe('Fields to include in response'),
    includeItemsFromAllDrives: z.boolean().optional().describe('Include files from all drives user has access to')
  }),
  execute: async ({ pageSize, pageToken, query, orderBy, fields, includeItemsFromAllDrives }) => {
    try {
      const params = new URLSearchParams();

      // Filter for Google Sheets files only
      const sheetsQuery = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
      const finalQuery = query ? `${sheetsQuery} and (${query})` : sheetsQuery;
      params.append('q', finalQuery);

      if (pageSize) {
        params.append('pageSize', pageSize.toString());
      }

      if (pageToken) {
        params.append('pageToken', pageToken);
      }

      if (orderBy) {
        params.append('orderBy', orderBy);
      }

      if (includeItemsFromAllDrives) {
        params.append('includeItemsFromAllDrives', 'true');
        params.append('supportsAllDrives', 'true');
      }

      // Default fields if none specified
      const defaultFields = 'nextPageToken,files(id,name,createdTime,modifiedTime,lastModifyingUser,owners,shared,starred,size,webViewLink,iconLink,thumbnailLink,description,parents,permissions)';
      params.append('fields', fields || defaultFields);

      const accessToken = await getAccessToken();
      const response = await axios.get(
        `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );

      const data = response.data;

      return {
        success: true,
        files: data.files?.map((file: Record<string, unknown>) => ({
          id: file.id,
          name: file.name,
          createdTime: file.createdTime,
          modifiedTime: file.modifiedTime,
          lastModifyingUser: file.lastModifyingUser,
          owners: file.owners,
          shared: file.shared,
          starred: file.starred,
          size: file.size,
          webViewLink: file.webViewLink,
          iconLink: file.iconLink,
          thumbnailLink: file.thumbnailLink,
          description: file.description,
          parents: file.parents,
          permissions: file.permissions
        })) || [],
        nextPageToken: data.nextPageToken,
        totalFiles: data.files?.length || 0
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});