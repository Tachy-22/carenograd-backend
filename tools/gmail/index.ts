// Gmail Tools - Complete Email Management Suite
// Export all Gmail tool categories

// Core email management
export * from './email-management';
export * from './email-sending';

// Content management
export * from './attachment-management';
export * from './label-management';
export * from './thread-management';
export * from './draft-management';

// Advanced features
export * from './advanced-features';

// Tool registry for easy agent integration
import * as emailManagement from './email-management';
import * as emailSending from './email-sending';
import * as attachmentManagement from './attachment-management';
import * as labelManagement from './label-management';
import * as threadManagement from './thread-management';
import * as draftManagement from './draft-management';
import * as advancedFeatures from './advanced-features';

export const gmailTools = {
  // Email Management (8 tools)
  listEmails: emailManagement.listEmailsTool,
  getEmail: emailManagement.getEmailTool,
  deleteEmail: emailManagement.deleteEmailTool,
  trashEmail: emailManagement.trashEmailTool,
  untrashEmail: emailManagement.untrashEmailTool,
  modifyEmailLabels: emailManagement.modifyEmailLabelsTool,
  batchDeleteEmails: emailManagement.batchDeleteEmailsTool,
  batchModifyEmails: emailManagement.batchModifyEmailsTool,

  // Email Sending (3 tools)
  sendEmail: emailSending.sendEmailTool,
  replyToEmail: emailSending.replyToEmailTool,
  forwardEmail: emailSending.forwardEmailTool,

  // Attachment Management (5 tools)
  getAttachment: attachmentManagement.getAttachmentTool,
  listAttachments: attachmentManagement.listAttachmentsTool,
  downloadAllAttachments: attachmentManagement.downloadAllAttachmentsTool,
  saveAttachment: attachmentManagement.saveAttachmentTool,
  searchEmailsWithAttachments: attachmentManagement.searchEmailsWithAttachmentsTool,

  // Label Management (8 tools)
  listLabels: labelManagement.listLabelsTool,
  createLabel: labelManagement.createLabelTool,
  getLabel: labelManagement.getLabelTool,
  updateLabel: labelManagement.updateLabelTool,
  deleteLabel: labelManagement.deleteLabelTool,
  getSystemLabels: labelManagement.getSystemLabelsTool,
  getUserLabels: labelManagement.getUserLabelsTool,
  searchLabels: labelManagement.searchLabelsTool,

  // Thread Management (6 tools)
  listThreads: threadManagement.listThreadsTool,
  getThread: threadManagement.getThreadTool,
  deleteThread: threadManagement.deleteThreadTool,
  trashThread: threadManagement.trashThreadTool,
  untrashThread: threadManagement.untrashThreadTool,
  modifyThreadLabels: threadManagement.modifyThreadLabelsTool,
  searchThreads: threadManagement.searchThreadsTool,

  // Draft Management (6 tools)
  listDrafts: draftManagement.listDraftsTool,
  getDraft: draftManagement.getDraftTool,
  createDraft: draftManagement.createDraftTool,
  updateDraft: draftManagement.updateDraftTool,
  deleteDraft: draftManagement.deleteDraftTool,
  sendDraft: draftManagement.sendDraftTool,
  createReplyDraft: draftManagement.createReplyDraftTool,

  // Advanced Features (10 tools)
  listFilters: advancedFeatures.listFiltersTool,
  createFilter: advancedFeatures.createFilterTool,
  deleteFilter: advancedFeatures.deleteFilterTool,
  getAutoForwarding: advancedFeatures.getAutoForwardingTool,
  updateAutoForwarding: advancedFeatures.updateAutoForwardingTool,
  getSignature: advancedFeatures.getSignatureTool,
  updateSignature: advancedFeatures.updateSignatureTool,
  getVacationSettings: advancedFeatures.getVacationSettingsTool,
  updateVacationSettings: advancedFeatures.updateVacationSettingsTool,
  getImapSettings: advancedFeatures.getImapSettingsTool,
  updateImapSettings: advancedFeatures.updateImapSettingsTool
};

// Tool count: 46 total Gmail tools
export const gmailToolCount = Object.keys(gmailTools).length;