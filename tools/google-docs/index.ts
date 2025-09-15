// Google Docs Tools - Comprehensive suite for Google Docs operations
import { createDocumentTool, getDocumentTool } from './create-document';

// Document management
import { 
  listDocumentsTool, 
  deleteDocumentTool, 
  restoreDocumentTool, 
  permanentlyDeleteDocumentTool,
  copyDocumentTool,
  moveDocumentTool,
  renameDocumentTool
} from './document-management';

// Text operations
import { insertTextTool, replaceTextTool, deleteContentTool, insertPageBreakTool } from './text-operations';

// Text formatting
import { formatTextTool, addHyperlinkTool, removeFormattingTool } from './text-formatting';

// Paragraph formatting
import { formatParagraphTool, createBulletListTool, createNumberedListTool, removeBulletsNumberingTool } from './paragraph-formatting';

// Image and media
import { insertImageTool, replaceImageTool, deleteImageTool, insertDrawingTool, insertSectionBreakTool } from './image-media';

// Table management
import { 
  insertTableTool, 
  insertTableRowTool, 
  insertTableColumnTool, 
  deleteTableRowTool, 
  deleteTableColumnTool,
  formatTableCellTool,
  mergeTableCellsTool,
  unmergeTableCellsTool
} from './table-management';

// Headers and footers
import { 
  createHeaderTool, 
  createFooterTool, 
  deleteHeaderTool, 
  deleteFooterTool,
  updateDocumentStyleTool,
  updateSectionStyleTool
} from './headers-footers';

// Named ranges
import { createNamedRangeTool, deleteNamedRangeTool, replaceNamedRangeContentTool } from './named-ranges';

// Export individual tools
export {
  // Document management
  createDocumentTool,
  getDocumentTool,
  listDocumentsTool,
  deleteDocumentTool,
  restoreDocumentTool,
  permanentlyDeleteDocumentTool,
  copyDocumentTool,
  moveDocumentTool,
  renameDocumentTool,
  
  // Text operations
  insertTextTool,
  replaceTextTool,
  deleteContentTool,
  insertPageBreakTool,
  
  // Text formatting
  formatTextTool,
  addHyperlinkTool,
  removeFormattingTool,
  
  // Paragraph formatting
  formatParagraphTool,
  createBulletListTool,
  createNumberedListTool,
  removeBulletsNumberingTool,
  
  // Image and media
  insertImageTool,
  replaceImageTool,
  deleteImageTool,
  insertDrawingTool,
  insertSectionBreakTool,
  
  // Table management
  insertTableTool,
  insertTableRowTool,
  insertTableColumnTool,
  deleteTableRowTool,
  deleteTableColumnTool,
  formatTableCellTool,
  mergeTableCellsTool,
  unmergeTableCellsTool,
  
  // Headers and footers
  createHeaderTool,
  createFooterTool,
  deleteHeaderTool,
  deleteFooterTool,
  updateDocumentStyleTool,
  updateSectionStyleTool,
  
  // Named ranges
  createNamedRangeTool,
  deleteNamedRangeTool,
  replaceNamedRangeContentTool
};

// Consolidated export object for easy integration
export const googleDocsTools = {
  // Document management
  createDocument: createDocumentTool,
  getDocument: getDocumentTool,
  listDocuments: listDocumentsTool,
  deleteDocument: deleteDocumentTool,
  restoreDocument: restoreDocumentTool,
  permanentlyDeleteDocument: permanentlyDeleteDocumentTool,
  copyDocument: copyDocumentTool,
  moveDocument: moveDocumentTool,
  renameDocument: renameDocumentTool,
  
  // Text operations
  insertText: insertTextTool,
  replaceText: replaceTextTool,
  deleteContent: deleteContentTool,
  insertPageBreak: insertPageBreakTool,
  
  // Text formatting
  formatText: formatTextTool,
  addHyperlink: addHyperlinkTool,
  removeFormatting: removeFormattingTool,
  
  // Paragraph formatting
  formatParagraph: formatParagraphTool,
  createBulletList: createBulletListTool,
  createNumberedList: createNumberedListTool,
  removeBulletsNumbering: removeBulletsNumberingTool,
  
  // Image and media
  insertImage: insertImageTool,
  replaceImage: replaceImageTool,
  deleteImage: deleteImageTool,
  insertDrawing: insertDrawingTool,
  insertSectionBreak: insertSectionBreakTool,
  
  // Table management
  insertTable: insertTableTool,
  insertTableRow: insertTableRowTool,
  insertTableColumn: insertTableColumnTool,
  deleteTableRow: deleteTableRowTool,
  deleteTableColumn: deleteTableColumnTool,
  formatTableCell: formatTableCellTool,
  mergeTableCells: mergeTableCellsTool,
  unmergeTableCells: unmergeTableCellsTool,
  
  // Headers and footers
  createHeader: createHeaderTool,
  createFooter: createFooterTool,
  deleteHeader: deleteHeaderTool,
  deleteFooter: deleteFooterTool,
  updateDocumentStyle: updateDocumentStyleTool,
  updateSectionStyle: updateSectionStyleTool,
  
  // Named ranges
  createNamedRange: createNamedRangeTool,
  deleteNamedRange: deleteNamedRangeTool,
  replaceNamedRangeContent: replaceNamedRangeContentTool
};