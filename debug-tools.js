// Debug script to check available tools
const { googleSheetsTools } = require('./tools/google-sheets');
const { gmailTools } = require('./tools/gmail');

console.log('Google Sheets Tools:');
console.log(Object.keys(googleSheetsTools));

console.log('\nGmail Tools:');
console.log(Object.keys(gmailTools));

console.log('\nSample spreadsheet tool:');
console.log(googleSheetsTools.listSpreadsheets ? 'listSpreadsheets exists' : 'listSpreadsheets missing');
console.log(googleSheetsTools.readCells ? 'readCells exists' : 'readCells missing');