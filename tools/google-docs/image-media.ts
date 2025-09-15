import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import { formatError } from '../../types/common';
import { getAccessToken } from '../../utils/auth-context';

export const insertImageTool = tool({
  description: 'Insert an inline image into a Google Docs document from a URL',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    imageUrl: z.string().describe('The URL of the image to insert'),
    index: z.number().describe('The location to insert the image (0-based index)'),
    width: z.number().optional().describe('The width of the image in points'),
    height: z.number().optional().describe('The height of the image in points'),
    tabId: z.string().optional().describe('The tab ID if inserting in a specific tab'),
  }),
  execute: async ({ documentId, imageUrl, index, width, height, tabId }) => {
    try {
      const location = tabId ? { tabId, index } : { index };

      const insertInlineImageRequest: Record<string, unknown> = {
        location: location,
        uri: imageUrl
      };

      if (width && height) {
        insertInlineImageRequest.objectSize = {
          width: { magnitude: width, unit: 'PT' },
          height: { magnitude: height, unit: 'PT' }
        };
      }

      const request = {
        requests: [
          {
            insertInlineImage: insertInlineImageRequest
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

      const insertInlineImageReply = response.data.replies?.[0]?.insertInlineImage;

      return {
        success: true,
        documentId: response.data.documentId,
        insertedImage: {
          objectId: insertInlineImageReply?.objectId,
          imageUrl: imageUrl,
          insertIndex: index,
          width: width,
          height: height
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

export const replaceImageTool = tool({
  description: 'Replace an existing image in a Google Docs document with a new image',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    imageObjectId: z.string().describe('The object ID of the image to replace'),
    newImageUrl: z.string().describe('The URL of the new image'),
    imageReplaceMethod: z.enum(['CENTER_CROP']).optional().describe('How to replace the image (CENTER_CROP maintains aspect ratio)'),
    tabId: z.string().optional().describe('The tab ID if replacing in a specific tab'),
  }),
  execute: async ({ documentId, imageObjectId, newImageUrl, imageReplaceMethod, tabId }) => {
    try {
      const replaceImageRequest: Record<string, unknown> = {
        imageObjectId: imageObjectId,
        uri: newImageUrl
      };

      if (imageReplaceMethod) {
        replaceImageRequest.imageReplaceMethod = imageReplaceMethod;
      }

      if (tabId) {
        replaceImageRequest.tabId = tabId;
      }

      const request = {
        requests: [
          {
            replaceImage: replaceImageRequest
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
        replacedImage: {
          objectId: imageObjectId,
          newImageUrl: newImageUrl,
          replaceMethod: imageReplaceMethod || 'CENTER_CROP'
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

export const deleteImageTool = tool({
  description: 'Delete a positioned object (like an image) from a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    objectId: z.string().describe('The object ID of the positioned object to delete'),
    tabId: z.string().optional().describe('The tab ID if deleting from a specific tab'),
  }),
  execute: async ({ documentId, objectId, tabId }) => {
    try {
      const deletePositionedObjectRequest: Record<string, unknown> = {
        objectId: objectId
      };

      if (tabId) {
        deletePositionedObjectRequest.tabId = tabId;
      }

      const request = {
        requests: [
          {
            deletePositionedObject: deletePositionedObjectRequest
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
        deletedObjectId: objectId,
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

export const insertDrawingTool = tool({
  description: 'Insert a Google Drawing into a Google Docs document',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    drawingId: z.string().describe('The ID of the Google Drawing to insert'),
    index: z.number().describe('The location to insert the drawing (0-based index)'),
    width: z.number().optional().describe('The width of the drawing in points'),
    height: z.number().optional().describe('The height of the drawing in points'),
    tabId: z.string().optional().describe('The tab ID if inserting in a specific tab'),
  }),
  execute: async ({ documentId, drawingId, index, width, height, tabId }) => {
    try {
      // For Google Drawings, we construct the URL
      const drawingUrl = `https://docs.google.com/drawings/d/${drawingId}/export/png`;

      const location = tabId ? { tabId, index } : { index };

      const insertInlineImageRequest: Record<string, unknown> = {
        location: location,
        uri: drawingUrl
      };

      if (width && height) {
        insertInlineImageRequest.objectSize = {
          width: { magnitude: width, unit: 'PT' },
          height: { magnitude: height, unit: 'PT' }
        };
      }

      const request = {
        requests: [
          {
            insertInlineImage: insertInlineImageRequest
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

      const insertInlineImageReply = response.data.replies?.[0]?.insertInlineImage;

      return {
        success: true,
        documentId: response.data.documentId,
        insertedDrawing: {
          objectId: insertInlineImageReply?.objectId,
          drawingId: drawingId,
          drawingUrl: drawingUrl,
          insertIndex: index,
          width: width,
          height: height
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

export const insertSectionBreakTool = tool({
  description: 'Insert a section break in a Google Docs document to create new sections with different formatting',
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document'),
    index: z.number().describe('The location to insert the section break (0-based index)'),
    sectionType: z.enum(['CONTINUOUS', 'NEXT_PAGE', 'EVEN_PAGE', 'ODD_PAGE']).describe('The type of section break to insert'),
    tabId: z.string().optional().describe('The tab ID if inserting in a specific tab'),
  }),
  execute: async ({ documentId, index, sectionType, tabId }) => {
    try {
      const location = tabId ? { tabId, index } : { index };

      const request = {
        requests: [
          {
            insertSectionBreak: {
              location: location,
              sectionType: sectionType
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
        sectionBreak: {
          insertIndex: index,
          sectionType: sectionType
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