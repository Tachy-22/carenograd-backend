import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import { getAccessToken } from '../../utils/auth-context';

const ColorSchema = z.object({
  red: z.number().min(0).max(1).optional(),
  green: z.number().min(0).max(1).optional(),
  blue: z.number().min(0).max(1).optional()
});

const TableCellStyleSchema = z.object({
  rowSpan: z.number().optional(),
  columnSpan: z.number().optional(),
  backgroundColor: ColorSchema.optional(),
  borderTop: z.object({
    color: ColorSchema.optional(),
    width: z.object({
      magnitude: z.number(),
      unit: z.enum(['PT'])
    }).optional(),
    dashStyle: z.enum(['SOLID', 'DOT', 'DASH']).optional()
  }).optional(),
  borderBottom: z.object({
    color: ColorSchema.optional(),
    width: z.object({
      magnitude: z.number(),
      unit: z.enum(['PT'])
    }).optional(),
    dashStyle: z.enum(['SOLID', 'DOT', 'DASH']).optional()
  }).optional(),
  borderLeft: z.object({
    color: ColorSchema.optional(),
    width: z.object({
      magnitude: z.number(),
      unit: z.enum(['PT'])
    }).optional(),
    dashStyle: z.enum(['SOLID', 'DOT', 'DASH']).optional()
  }).optional(),
  borderRight: z.object({
    color: ColorSchema.optional(),
    width: z.object({
      magnitude: z.number(),
      unit: z.enum(['PT'])
    }).optional(),
    dashStyle: z.enum(['SOLID', 'DOT', 'DASH']).optional()
  }).optional(),
  paddingTop: z.object({
    magnitude: z.number(),
    unit: z.enum(['PT'])
  }).optional(),
  paddingBottom: z.object({
    magnitude: z.number(),
    unit: z.enum(['PT'])
  }).optional(),
  paddingLeft: z.object({
    magnitude: z.number(),
    unit: z.enum(['PT'])
  }).optional(),
  paddingRight: z.object({
    magnitude: z.number(),
    unit: z.enum(['PT'])
  }).optional(),
  contentAlignment: z.enum(['CONTENT_ALIGNMENT_UNSPECIFIED', 'CONTENT_ALIGNMENT_UNSUPPORTED', 'TOP', 'MIDDLE', 'BOTTOM']).optional()
});

export const insertTableTool = tool({
  description: 'Insert a table into a Google Docs document with specified dimensions',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    index: z.number().describe('The location to insert the table (0-based index)'),
    rows: z.number().min(1).describe('The number of rows in the table'),
    columns: z.number().min(1).describe('The number of columns in the table'),
    tabId: z.string().optional().describe('The tab ID if inserting in a specific tab'),
  }),
  execute: async ({ documentId, index, rows, columns, tabId }) => {
    try {
      const location = tabId ? { tabId, index } : { index };

      const request = {
        requests: [
          {
            insertTable: {
              location: location,
              rows: rows,
              columns: columns
            }
          }
        ]
      };

      const response = await axios.post(
        `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
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
        documentId: response.data.documentId,
        insertedTable: {
          insertIndex: index,
          rows: rows,
          columns: columns
        },
        tabId: tabId,
        replies: response.data.replies || []
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

export const insertTableRowTool = tool({
  description: 'Insert a row into an existing table in a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    tableStartIndex: z.number().describe('The start index of the table'),
    rowIndex: z.number().describe('The index where to insert the row (0-based)'),
    insertBelow: z.boolean().optional().describe('Whether to insert the row below the specified index (default: false - insert above)'),
    tabId: z.string().optional().describe('The tab ID if inserting in a specific tab'),
  }),
  execute: async ({ documentId, tableStartIndex, rowIndex, insertBelow, tabId }) => {
    try {
      const tableLocation = tabId
        ? { tabId, index: tableStartIndex }
        : { index: tableStartIndex };

      const insertTableRowRequest: Record<string, unknown> = {
        tableCellLocation: {
          tableStartLocation: tableLocation,
          rowIndex: rowIndex,
          columnIndex: 0
        },
        insertBelow: insertBelow || false
      };

      if (tabId) {
        (insertTableRowRequest.tableCellLocation as Record<string, unknown>).tabId = tabId;
      }

      const request = {
        requests: [
          {
            insertTableRow: insertTableRowRequest
          }
        ]
      };

      const response = await axios.post(
        `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
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
        documentId: response.data.documentId,
        insertedRow: {
          tableStartIndex: tableStartIndex,
          rowIndex: rowIndex,
          insertBelow: insertBelow || false
        },
        tabId: tabId,
        replies: response.data.replies || []
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

export const insertTableColumnTool = tool({
  description: 'Insert a column into an existing table in a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    tableStartIndex: z.number().describe('The start index of the table'),
    columnIndex: z.number().describe('The index where to insert the column (0-based)'),
    insertRight: z.boolean().optional().describe('Whether to insert the column to the right of the specified index (default: false - insert left)'),
    tabId: z.string().optional().describe('The tab ID if inserting in a specific tab'),
  }),
  execute: async ({ documentId, tableStartIndex, columnIndex, insertRight, tabId }) => {
    try {
      const tableLocation = tabId
        ? { tabId, index: tableStartIndex }
        : { index: tableStartIndex };

      const insertTableColumnRequest: Record<string, unknown> = {
        tableCellLocation: {
          tableStartLocation: tableLocation,
          rowIndex: 0,
          columnIndex: columnIndex
        },
        insertRight: insertRight || false
      };

      if (tabId) {
        (insertTableColumnRequest.tableCellLocation as Record<string, unknown>).tabId = tabId;
      }

      const request = {
        requests: [
          {
            insertTableColumn: insertTableColumnRequest
          }
        ]
      };

      const response = await axios.post(
        `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
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
        documentId: response.data.documentId,
        insertedColumn: {
          tableStartIndex: tableStartIndex,
          columnIndex: columnIndex,
          insertRight: insertRight || false
        },
        tabId: tabId,
        replies: response.data.replies || []
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

export const deleteTableRowTool = tool({
  description: 'Delete a row from an existing table in a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    tableStartIndex: z.number().describe('The start index of the table'),
    rowIndex: z.number().describe('The index of the row to delete (0-based)'),
    tabId: z.string().optional().describe('The tab ID if deleting from a specific tab'),
  }),
  execute: async ({ documentId, tableStartIndex, rowIndex, tabId }) => {
    try {
      const tableLocation = tabId
        ? { tabId, index: tableStartIndex }
        : { index: tableStartIndex };

      const deleteTableRowRequest: Record<string, unknown> = {
        tableCellLocation: {
          tableStartLocation: tableLocation,
          rowIndex: rowIndex,
          columnIndex: 0
        }
      };

      if (tabId) {
        (deleteTableRowRequest.tableCellLocation as Record<string, unknown>).tabId = tabId;
      }

      const request = {
        requests: [
          {
            deleteTableRow: deleteTableRowRequest
          }
        ]
      };

      const response = await axios.post(
        `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
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
        documentId: response.data.documentId,
        deletedRow: {
          tableStartIndex: tableStartIndex,
          rowIndex: rowIndex
        },
        tabId: tabId,
        replies: response.data.replies || []
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

export const deleteTableColumnTool = tool({
  description: 'Delete a column from an existing table in a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    tableStartIndex: z.number().describe('The start index of the table'),
    columnIndex: z.number().describe('The index of the column to delete (0-based)'),
    tabId: z.string().optional().describe('The tab ID if deleting from a specific tab'),
  }),
  execute: async ({ documentId, tableStartIndex, columnIndex, tabId }) => {
    try {
      const tableLocation = tabId
        ? { tabId, index: tableStartIndex }
        : { index: tableStartIndex };

      const deleteTableColumnRequest: Record<string, unknown> = {
        tableCellLocation: {
          tableStartLocation: tableLocation,
          rowIndex: 0,
          columnIndex: columnIndex
        }
      };

      if (tabId) {
        (deleteTableColumnRequest.tableCellLocation as Record<string, unknown>).tabId = tabId;
      }

      const request = {
        requests: [
          {
            deleteTableColumn: deleteTableColumnRequest
          }
        ]
      };

      const response = await axios.post(
        `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
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
        documentId: response.data.documentId,
        deletedColumn: {
          tableStartIndex: tableStartIndex,
          columnIndex: columnIndex
        },
        tabId: tabId,
        replies: response.data.replies || []
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

export const formatTableCellTool = tool({
  description: 'Apply formatting to specific table cells in a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    tableStartIndex: z.number().describe('The start index of the table'),
    rowIndex: z.number().describe('The row index of the cell to format (0-based)'),
    columnIndex: z.number().describe('The column index of the cell to format (0-based)'),
    tableCellStyle: TableCellStyleSchema.describe('The cell formatting to apply'),
    fields: z.string().optional().describe('Comma-separated list of fields to update'),
    tabId: z.string().optional().describe('The tab ID if formatting cells in a specific tab'),
  }),
  execute: async ({ documentId, tableStartIndex, rowIndex, columnIndex, tableCellStyle, fields, tabId }) => {
    try {
      const tableLocation = tabId
        ? { tabId, index: tableStartIndex }
        : { index: tableStartIndex };

      const updateTableCellStyleRequest: Record<string, unknown> = {
        tableCellLocation: {
          tableStartLocation: tableLocation,
          rowIndex: rowIndex,
          columnIndex: columnIndex
        },
        tableCellStyle: tableCellStyle,
        fields: fields || Object.keys(tableCellStyle).join(',')
      };

      if (tabId) {
        (updateTableCellStyleRequest.tableCellLocation as Record<string, unknown>).tabId = tabId;
      }

      const request = {
        requests: [
          {
            updateTableCellStyle: updateTableCellStyleRequest
          }
        ]
      };

      const response = await axios.post(
        `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
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
        documentId: response.data.documentId,
        formattedCell: {
          tableStartIndex: tableStartIndex,
          rowIndex: rowIndex,
          columnIndex: columnIndex,
          appliedStyle: tableCellStyle
        },
        tabId: tabId,
        replies: response.data.replies || []
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

export const mergeTableCellsTool = tool({
  description: 'Merge adjacent table cells in a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    tableStartIndex: z.number().describe('The start index of the table'),
    startRowIndex: z.number().describe('The starting row index for the merge (0-based, inclusive)'),
    endRowIndex: z.number().describe('The ending row index for the merge (0-based, exclusive)'),
    startColumnIndex: z.number().describe('The starting column index for the merge (0-based, inclusive)'),
    endColumnIndex: z.number().describe('The ending column index for the merge (0-based, exclusive)'),
    tabId: z.string().optional().describe('The tab ID if merging cells in a specific tab'),
  }),
  execute: async ({ documentId, tableStartIndex, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex, tabId }) => {
    try {
      const tableLocation = tabId
        ? { tabId, index: tableStartIndex }
        : { index: tableStartIndex };

      const mergeTableCellsRequest: Record<string, unknown> = {
        tableRange: {
          tableStartLocation: tableLocation,
          rowSpan: endRowIndex - startRowIndex,
          columnSpan: endColumnIndex - startColumnIndex,
          tableCellLocation: {
            tableStartLocation: tableLocation,
            rowIndex: startRowIndex,
            columnIndex: startColumnIndex
          }
        }
      };

      if (tabId) {
        ((mergeTableCellsRequest.tableRange as Record<string, unknown>).tableCellLocation as Record<string, unknown>).tabId = tabId;
      }

      const request = {
        requests: [
          {
            mergeTableCells: mergeTableCellsRequest
          }
        ]
      };

      const response = await axios.post(
        `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
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
        documentId: response.data.documentId,
        mergedCells: {
          tableStartIndex: tableStartIndex,
          startRowIndex: startRowIndex,
          endRowIndex: endRowIndex,
          startColumnIndex: startColumnIndex,
          endColumnIndex: endColumnIndex,
          rowSpan: endRowIndex - startRowIndex,
          columnSpan: endColumnIndex - startColumnIndex
        },
        tabId: tabId,
        replies: response.data.replies || []
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

export const unmergeTableCellsTool = tool({
  description: 'Unmerge merged table cells in a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    tableStartIndex: z.number().describe('The start index of the table'),
    rowIndex: z.number().describe('The row index of the merged cell (0-based)'),
    columnIndex: z.number().describe('The column index of the merged cell (0-based)'),
    tabId: z.string().optional().describe('The tab ID if unmerging cells in a specific tab'),
  }),
  execute: async ({ documentId, tableStartIndex, rowIndex, columnIndex, tabId }) => {
    try {
      const tableLocation = tabId
        ? { tabId, index: tableStartIndex }
        : { index: tableStartIndex };

      const unmergeTableCellsRequest: Record<string, unknown> = {
        tableRange: {
          tableStartLocation: tableLocation,
          rowSpan: 1,
          columnSpan: 1,
          tableCellLocation: {
            tableStartLocation: tableLocation,
            rowIndex: rowIndex,
            columnIndex: columnIndex
          }
        }
      };

      if (tabId) {
        ((unmergeTableCellsRequest.tableRange as Record<string, unknown>).tableCellLocation as Record<string, unknown>).tabId = tabId;
      }

      const request = {
        requests: [
          {
            unmergeTableCells: unmergeTableCellsRequest
          }
        ]
      };

      const response = await axios.post(
        `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
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
        documentId: response.data.documentId,
        unmergedCell: {
          tableStartIndex: tableStartIndex,
          rowIndex: rowIndex,
          columnIndex: columnIndex
        },
        tabId: tabId,
        replies: response.data.replies || []
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