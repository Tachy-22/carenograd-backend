import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import { formatError } from '../../types/common';
import { getAccessToken } from '../../utils/auth-context';

export const createHeaderTool = tool({
  description: 'Create a header in a Google Docs document for a specific section',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    sectionBreakIndex: z.number().describe('The index of the section break where the header should be created'),
    headerType: z.enum(['DEFAULT', 'FIRST_PAGE_ONLY', 'EVEN_PAGE_ONLY']).describe('The type of header to create'),
    tabId: z.string().optional().describe('The tab ID if creating header in a specific tab'),
  }),
  execute: async ({ documentId, sectionBreakIndex, headerType, tabId }) => {
    try {
      const createHeaderRequest: Record<string, unknown> = {
        sectionBreakLocation: tabId
          ? { tabId, index: sectionBreakIndex }
          : { index: sectionBreakIndex },
        type: headerType
      };

      const request = {
        requests: [
          {
            createHeader: createHeaderRequest
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

      const createHeaderReply = response.data.replies?.[0]?.createHeader;

      return {
        success: true,
        documentId: response.data.documentId,
        createdHeader: {
          headerId: createHeaderReply?.headerId,
          sectionBreakIndex: sectionBreakIndex,
          headerType: headerType
        },
        tabId: tabId,
        replies: response.data.replies || []
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const createFooterTool = tool({
  description: 'Create a footer in a Google Docs document for a specific section',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    sectionBreakIndex: z.number().describe('The index of the section break where the footer should be created'),
    footerType: z.enum(['DEFAULT', 'FIRST_PAGE_ONLY', 'EVEN_PAGE_ONLY']).describe('The type of footer to create'),
    tabId: z.string().optional().describe('The tab ID if creating footer in a specific tab'),
  }),
  execute: async ({ documentId, sectionBreakIndex, footerType, tabId }) => {
    try {
      const createFooterRequest: Record<string, unknown> = {
        sectionBreakLocation: tabId
          ? { tabId, index: sectionBreakIndex }
          : { index: sectionBreakIndex },
        type: footerType
      };

      const request = {
        requests: [
          {
            createFooter: createFooterRequest
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

      const createFooterReply = response.data.replies?.[0]?.createFooter;

      return {
        success: true,
        documentId: response.data.documentId,
        createdFooter: {
          footerId: createFooterReply?.footerId,
          sectionBreakIndex: sectionBreakIndex,
          footerType: footerType
        },
        tabId: tabId,
        replies: response.data.replies || []
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const deleteHeaderTool = tool({
  description: 'Delete a header from a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    headerId: z.string().describe('The ID of the header to delete'),
    tabId: z.string().optional().describe('The tab ID if deleting header from a specific tab'),
  }),
  execute: async ({ documentId, headerId, tabId }) => {
    try {
      const deleteHeaderRequest: Record<string, unknown> = {
        headerId: headerId
      };

      if (tabId) {
        deleteHeaderRequest.tabId = tabId;
      }

      const request = {
        requests: [
          {
            deleteHeader: deleteHeaderRequest
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
        deletedHeaderId: headerId,
        tabId: tabId,
        replies: response.data.replies || []
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const deleteFooterTool = tool({
  description: 'Delete a footer from a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    footerId: z.string().describe('The ID of the footer to delete'),
    tabId: z.string().optional().describe('The tab ID if deleting footer from a specific tab'),
  }),
  execute: async ({ documentId, footerId, tabId }) => {
    try {
      const deleteFooterRequest: Record<string, unknown> = {
        footerId: footerId
      };

      if (tabId) {
        deleteFooterRequest.tabId = tabId;
      }

      const request = {
        requests: [
          {
            deleteFooter: deleteFooterRequest
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
        deletedFooterId: footerId,
        tabId: tabId,
        replies: response.data.replies || []
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const updateDocumentStyleTool = tool({
  description: 'Update the overall document style including margins, page size, and background',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    backgroundColor: z.object({
      red: z.number().min(0).max(1).optional(),
      green: z.number().min(0).max(1).optional(),
      blue: z.number().min(0).max(1).optional()
    }).optional().describe('Background color of the document'),
    pageSize: z.object({
      width: z.object({
        magnitude: z.number(),
        unit: z.enum(['PT'])
      }).optional(),
      height: z.object({
        magnitude: z.number(),
        unit: z.enum(['PT'])
      }).optional()
    }).optional().describe('Page size settings'),
    marginTop: z.object({
      magnitude: z.number(),
      unit: z.enum(['PT'])
    }).optional().describe('Top margin'),
    marginBottom: z.object({
      magnitude: z.number(),
      unit: z.enum(['PT'])
    }).optional().describe('Bottom margin'),
    marginLeft: z.object({
      magnitude: z.number(),
      unit: z.enum(['PT'])
    }).optional().describe('Left margin'),
    marginRight: z.object({
      magnitude: z.number(),
      unit: z.enum(['PT'])
    }).optional().describe('Right margin'),
    pageNumberStart: z.number().optional().describe('Starting page number'),
    useFirstPageHeaderFooter: z.boolean().optional().describe('Whether to use different header/footer for first page'),
    useEvenPageHeaderFooter: z.boolean().optional().describe('Whether to use different header/footer for even pages'),
    flipPageOrientation: z.boolean().optional().describe('Whether to flip page orientation'),
    fields: z.string().optional().describe('Comma-separated list of fields to update'),
  }),
  execute: async ({ documentId, backgroundColor, pageSize, marginTop, marginBottom, marginLeft, marginRight, pageNumberStart, useFirstPageHeaderFooter, useEvenPageHeaderFooter, flipPageOrientation, fields }) => {
    try {
      const documentStyle: Record<string, unknown> = {};

      if (backgroundColor) documentStyle.backgroundColor = backgroundColor;
      if (pageSize) documentStyle.pageSize = pageSize;
      if (marginTop) documentStyle.marginTop = marginTop;
      if (marginBottom) documentStyle.marginBottom = marginBottom;
      if (marginLeft) documentStyle.marginLeft = marginLeft;
      if (marginRight) documentStyle.marginRight = marginRight;
      if (pageNumberStart !== undefined) documentStyle.pageNumberStart = pageNumberStart;
      if (useFirstPageHeaderFooter !== undefined) documentStyle.useFirstPageHeaderFooter = useFirstPageHeaderFooter;
      if (useEvenPageHeaderFooter !== undefined) documentStyle.useEvenPageHeaderFooter = useEvenPageHeaderFooter;
      if (flipPageOrientation !== undefined) documentStyle.flipPageOrientation = flipPageOrientation;

      const updateFields = fields || Object.keys(documentStyle).join(',');

      const request = {
        requests: [
          {
            updateDocumentStyle: {
              documentStyle: documentStyle,
              fields: updateFields
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
        updatedDocumentStyle: documentStyle,
        updatedFields: updateFields,
        replies: response.data.replies || []
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});

export const updateSectionStyleTool = tool({
  description: 'Update the style of a specific section in a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    startIndex: z.number().describe('The start index of the section to update (0-based, inclusive)'),
    endIndex: z.number().describe('The end index of the section to update (0-based, exclusive)'),
    columnSeparatorStyle: z.enum(['NONE', 'BETWEEN_EACH_COLUMN']).optional().describe('Style of column separators'),
    contentDirection: z.enum(['CONTENT_DIRECTION_UNSPECIFIED', 'LEFT_TO_RIGHT', 'RIGHT_TO_LEFT']).optional().describe('Content direction for the section'),
    sectionType: z.enum(['SECTION_TYPE_UNSPECIFIED', 'CONTINUOUS', 'NEXT_PAGE', 'EVEN_PAGE', 'ODD_PAGE']).optional().describe('Type of section break'),
    marginTop: z.object({
      magnitude: z.number(),
      unit: z.enum(['PT'])
    }).optional().describe('Top margin for this section'),
    marginBottom: z.object({
      magnitude: z.number(),
      unit: z.enum(['PT'])
    }).optional().describe('Bottom margin for this section'),
    marginLeft: z.object({
      magnitude: z.number(),
      unit: z.enum(['PT'])
    }).optional().describe('Left margin for this section'),
    marginRight: z.object({
      magnitude: z.number(),
      unit: z.enum(['PT'])
    }).optional().describe('Right margin for this section'),
    pageNumberStart: z.number().optional().describe('Starting page number for this section'),
    fields: z.string().optional().describe('Comma-separated list of fields to update'),
    tabId: z.string().optional().describe('The tab ID if updating section in a specific tab'),
  }),
  execute: async ({ documentId, startIndex, endIndex, columnSeparatorStyle, contentDirection, sectionType, marginTop, marginBottom, marginLeft, marginRight, pageNumberStart, fields, tabId }) => {
    try {
      const range = tabId
        ? { tabId, startIndex, endIndex }
        : { startIndex, endIndex };

      const sectionStyle: Record<string, unknown> = {};

      if (columnSeparatorStyle) sectionStyle.columnSeparatorStyle = columnSeparatorStyle;
      if (contentDirection) sectionStyle.contentDirection = contentDirection;
      if (sectionType) sectionStyle.sectionType = sectionType;
      if (marginTop) sectionStyle.marginTop = marginTop;
      if (marginBottom) sectionStyle.marginBottom = marginBottom;
      if (marginLeft) sectionStyle.marginLeft = marginLeft;
      if (marginRight) sectionStyle.marginRight = marginRight;
      if (pageNumberStart !== undefined) sectionStyle.pageNumberStart = pageNumberStart;

      const updateFields = fields || Object.keys(sectionStyle).join(',');

      const request = {
        requests: [
          {
            updateSectionStyle: {
              range: range,
              sectionStyle: sectionStyle,
              fields: updateFields
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
        updatedSection: {
          startIndex,
          endIndex,
          sectionStyle: sectionStyle
        },
        updatedFields: updateFields,
        tabId: tabId,
        replies: response.data.replies || []
      };
    } catch (error: unknown) {
      return {
        success: false,
        ...formatError(error)
      };
    }
  }
});