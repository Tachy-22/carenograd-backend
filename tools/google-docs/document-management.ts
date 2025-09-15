import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import { formatError } from '../../types/common';
import { getAccessToken } from '../../utils/auth-context';

export const listDocumentsTool = tool({
  description: 'List Google Docs documents from Google Drive with filtering and pagination',
  inputSchema: z.object({
    pageSize: z.number().min(1).max(1000).optional().describe('Number of files to return (max 1000)'),
    pageToken: z.string().optional().describe('Token for pagination from previous response'),
    query: z.string().optional().describe('Search query (e.g., "name contains \'report\'" or "starred = true")'),
    orderBy: z.string().optional().describe('Sort order (e.g., "name", "createdTime", "modifiedTime", "starred")'),
    fields: z.string().optional().describe('Fields to include in response'),
    includeItemsFromAllDrives: z.boolean().optional().describe('Include files from all drives user has access to'),
  }),
  execute: async ({ pageSize, pageToken, query, orderBy, fields, includeItemsFromAllDrives }) => {
    try {
      const params = new URLSearchParams();

      // Filter for Google Docs files only
      const docsQuery = "mimeType='application/vnd.google-apps.document' and trashed=false";
      const finalQuery = query ? `${docsQuery} and (${query})` : docsQuery;
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

      const response = await axios.get(
        `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      const data = response.data;

      return {
        success: true,
        documents: data.files?.map((file: Record<string, unknown>) => ({
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
          permissions: file.permissions,
          documentUrl: `https://docs.google.com/document/d/${file.id}/edit`
        })) || [],
        nextPageToken: data.nextPageToken,
        totalDocuments: data.files?.length || 0
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const deleteDocumentTool = tool({
  description: 'Delete a Google Docs document (move to trash)',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document to delete'),
  }),
  execute: async ({ documentId }) => {
    try {
      const response = await axios.delete(
        `https://www.googleapis.com/drive/v3/files/${documentId}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      return {
        success: true,
        documentId: documentId,
        message: 'Document moved to trash successfully'
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const restoreDocumentTool = tool({
  description: 'Restore a Google Docs document from trash',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document to restore'),
  }),
  execute: async ({ documentId }) => {
    try {
      const response = await axios.patch(
        `https://www.googleapis.com/drive/v3/files/${documentId}`,
        {
          trashed: false
        },
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        documentId: documentId,
        restoredDocument: {
          id: response.data.id,
          name: response.data.name,
          trashed: response.data.trashed
        },
        message: 'Document restored from trash successfully'
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const permanentlyDeleteDocumentTool = tool({
  description: 'Permanently delete a Google Docs document (cannot be undone)',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document to permanently delete'),
  }),
  execute: async ({ documentId }) => {
    try {
      await axios.delete(
        `https://www.googleapis.com/drive/v3/files/${documentId}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          }
        }
      );

      return {
        success: true,
        documentId: documentId,
        message: 'Document permanently deleted'
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const copyDocumentTool = tool({
  description: 'Create a copy of a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document to copy'),
    newName: z.string().optional().describe('Name for the copied document (defaults to "Copy of [original name]")'),
    parentFolderId: z.string().optional().describe('ID of the folder where the copy should be placed'),
  }),
  execute: async ({ documentId, newName, parentFolderId }) => {
    try {
      const requestBody: Record<string, unknown> = {};

      if (newName) {
        requestBody.name = newName;
      }

      if (parentFolderId) {
        requestBody.parents = [parentFolderId];
      }

      const response = await axios.post(
        `https://www.googleapis.com/drive/v3/files/${documentId}/copy`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        originalDocumentId: documentId,
        copiedDocument: {
          id: response.data.id,
          name: response.data.name,
          createdTime: response.data.createdTime,
          documentUrl: `https://docs.google.com/document/d/${response.data.id}/edit`
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

export const moveDocumentTool = tool({
  description: 'Move a Google Docs document to a different folder',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document to move'),
    newParentFolderId: z.string().describe('ID of the destination folder'),
    removeFromParents: z.string().optional().describe('Comma-separated list of parent folder IDs to remove from'),
  }),
  execute: async ({ documentId, newParentFolderId, removeFromParents }) => {
    try {
      const params = new URLSearchParams();
      params.append('addParents', newParentFolderId);

      if (removeFromParents) {
        params.append('removeParents', removeFromParents);
      }

      const response = await axios.patch(
        `https://www.googleapis.com/drive/v3/files/${documentId}?${params.toString()}`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        documentId: documentId,
        newParentFolderId: newParentFolderId,
        movedDocument: {
          id: response.data.id,
          name: response.data.name,
          parents: response.data.parents
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

export const renameDocumentTool = tool({
  description: 'Rename a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document to rename'),
    newName: z.string().describe('The new name for the document'),
  }),
  execute: async ({ documentId, newName }) => {
    try {
      const response = await axios.patch(
        `https://www.googleapis.com/drive/v3/files/${documentId}`,
        {
          name: newName
        },
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        documentId: documentId,
        oldName: response.data.name,
        newName: newName,
        renamedDocument: {
          id: response.data.id,
          name: response.data.name,
          modifiedTime: response.data.modifiedTime
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