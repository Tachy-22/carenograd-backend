import { listUserDocumentsTool, getUserDocumentDetailsTool, deleteUserDocumentTool } from './manage-documents-multi-user';

export {  listUserDocumentsTool, getUserDocumentDetailsTool, deleteUserDocumentTool };

// Legacy tools for backward compatibility
// export const documentManagementTools = {
//   listDocumentsTool,
//   getDocumentDetailsTool,
//   deleteDocumentTool,
//   updateDocumentMetadataTool
// };

// Multi-user tools for API use
export const documentManagementTools = {
  listUserDocumentsTool,
  getUserDocumentDetailsTool,
  deleteUserDocumentTool
};