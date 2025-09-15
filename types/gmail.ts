// Gmail API Type Definitions

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailMessagePart {
  partId?: string;
  mimeType: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: {
    attachmentId?: string;
    size?: number;
    data?: string;
  };
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  sizeEstimate?: number;
  raw?: string;
  payload?: GmailMessagePart;
}

export interface GmailThread {
  id: string;
  historyId?: string;
  messages?: GmailMessage[];
}

export interface GmailLabel {
  id: string;
  name: string;
  type: 'system' | 'user';
  messageListVisibility?: 'show' | 'hide';
  labelListVisibility?: 'labelShow' | 'labelHide' | 'labelShowIfUnread';
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
  color?: {
    backgroundColor?: string;
    textColor?: string;
  };
}

export interface GmailDraft {
  id: string;
  message?: GmailMessage;
}

export interface GmailFilter {
  id: string;
  criteria: {
    from?: string;
    to?: string;
    subject?: string;
    query?: string;
    negatedQuery?: string;
    hasAttachment?: boolean;
    excludeChats?: boolean;
    size?: number;
    sizeComparison?: 'larger' | 'smaller';
  };
  action: {
    addLabelIds?: string[];
    removeLabelIds?: string[];
    forward?: string;
    markAsRead?: boolean;
    markAsImportant?: boolean;
    neverMarkAsImportant?: boolean;
    deleteMessage?: boolean;
    markAsSpam?: boolean;
    neverMarkAsSpam?: boolean;
  };
}

export interface GmailAutoForwarding {
  enabled: boolean;
  emailAddress?: string;
  disposition?: 'leaveInInbox' | 'markAsRead' | 'archive' | 'trash';
}

export interface GmailSendAsAddress {
  sendAsEmail: string;
  displayName?: string;
  signature?: string;
  isDefault?: boolean;
  isPrimary?: boolean;
}

export interface GmailVacationSettings {
  enableAutoReply: boolean;
  responseSubject?: string;
  responseBodyPlainText?: string;
  responseBodyHtml?: string;
  restrictToContacts?: boolean;
  restrictToDomain?: boolean;
  startTime?: string;
  endTime?: string;
}

export interface GmailImapSettings {
  enabled: boolean;
  autoExpunge?: boolean;
  expungeBehavior?: 'archive' | 'trash' | 'deleteForever';
  maxFolderSize?: number;
}

export interface AttachmentInfo {
  filename: string;
  mimeType: string;
  attachmentId: string;
  size: number;
  partId?: string;
}

export interface DownloadedAttachment {
  filename: string;
  mimeType: string;
  attachmentId: string;
  size: number;
  data: string;
}

export interface FailedDownload {
  filename: string;
  attachmentId: string;
  error: string;
}

// Common API response interfaces
export interface ApiError {
  message: string;
  statusCode?: number;
  details?: unknown;
}

export interface HeadersMap {
  [key: string]: string;
}

export interface EmailRequestBody {
  message?: {
    raw?: string;
    threadId?: string;
  };
  threadId?: string;
}

export interface ModifyLabelsRequest {
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

export interface BatchModifyRequest extends ModifyLabelsRequest {
  ids: string[];
}