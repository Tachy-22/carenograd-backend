
import { debugKnowledgeBaseTool } from './debug-knowledge-base';
import { uploadDocumentMultiUserTool } from './upload-document-multi-user';
import { queryDocumentMultiUserTool } from './query-document-multi-user';

export { 
  debugKnowledgeBaseTool,
  uploadDocumentMultiUserTool,
  queryDocumentMultiUserTool
};

// Export legacy tools for backward compatibility
// export const ragTools = {
//   uploadDocumentTool,
//   queryDocumentTool,
//   debugKnowledgeBaseTool
// };

// Export multi-user tools for API use
// Note: uploadDocumentMultiUserTool removed - now handled by separate upload endpoint
export const ragTools = {
  queryDocumentMultiUserTool,
  debugKnowledgeBaseTool
};