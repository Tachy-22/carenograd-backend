// Google Sheets Tools - Comprehensive suite for Google Sheets operations
import { createSpreadsheetTool } from './create-spreadsheet';
import { getSpreadsheetTool } from './get-spreadsheet';
import { listSpreadsheetsTool } from './list-spreadsheets';

// Cell operations
import { readCellsTool, readMultipleRangesTool } from './read-cells';
import { readSpreadsheetByNameTool, findAndReadMultipleSheetsTool } from './read-by-name';
import { writeCellsTool, batchWriteCellsTool, appendCellsTool } from './write-cells';

// Formatting and styling
import { formatCellsTool, conditionalFormattingTool, clearFormattingTool } from './format-cells';

// Sheet management
import { 
  addSheetTool, 
  deleteSheetTool, 
  duplicateSheetTool, 
  updateSheetPropertiesTool,
  insertRowsColumnsTool,
  deleteRowsColumnsTool 
} from './sheet-management';

// Charts and pivot tables
import { createChartTool, updateChartTool, deleteChartTool, createPivotTableTool } from './charts-pivot';

// Formulas and functions
import { 
  addFormulaTool, 
  namedRangesTool, 
  arrayFormulasTool, 
  dataValidationTool, 
  lookupFormulasHelperTool 
} from './formulas-functions';

// Export individual tools
export {
  createSpreadsheetTool,
  getSpreadsheetTool,
  listSpreadsheetsTool,
  readCellsTool,
  readMultipleRangesTool,
  readSpreadsheetByNameTool,
  findAndReadMultipleSheetsTool,
  writeCellsTool,
  batchWriteCellsTool,
  appendCellsTool,
  formatCellsTool,
  conditionalFormattingTool,
  clearFormattingTool,
  addSheetTool,
  deleteSheetTool,
  duplicateSheetTool,
  updateSheetPropertiesTool,
  insertRowsColumnsTool,
  deleteRowsColumnsTool,
  createChartTool,
  updateChartTool,
  deleteChartTool,
  createPivotTableTool,
  addFormulaTool,
  namedRangesTool,
  arrayFormulasTool,
  dataValidationTool,
  lookupFormulasHelperTool
};

// Consolidated export object for easy integration
export const googleSheetsTools = {
  // Spreadsheet management
  createSpreadsheet: createSpreadsheetTool,
  getSpreadsheet: getSpreadsheetTool,
  listSpreadsheets: listSpreadsheetsTool,
  
  // Cell operations
  readCells: readCellsTool,
  readMultipleRanges: readMultipleRangesTool,
  readSpreadsheetByName: readSpreadsheetByNameTool,
  findAndReadMultipleSheets: findAndReadMultipleSheetsTool,
  writeCells: writeCellsTool,
  batchWriteCells: batchWriteCellsTool,
  appendCells: appendCellsTool,
  
  // Formatting
  formatCells: formatCellsTool,
  conditionalFormatting: conditionalFormattingTool,
  clearFormatting: clearFormattingTool,
  
  // Sheet management
  addSheet: addSheetTool,
  deleteSheet: deleteSheetTool,
  duplicateSheet: duplicateSheetTool,
  updateSheetProperties: updateSheetPropertiesTool,
  insertRowsColumns: insertRowsColumnsTool,
  deleteRowsColumns: deleteRowsColumnsTool,
  
  // Charts and pivot tables
  createChart: createChartTool,
  updateChart: updateChartTool,
  deleteChart: deleteChartTool,
  createPivotTable: createPivotTableTool,
  
  // Formulas and functions
  addFormula: addFormulaTool,
  namedRanges: namedRangesTool,
  arrayFormulas: arrayFormulasTool,
  dataValidation: dataValidationTool,
  lookupFormulasHelper: lookupFormulasHelperTool
};