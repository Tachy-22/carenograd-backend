# Email Campaign System - Frontend Implementation Guide

## Overview

This guide provides comprehensive documentation for implementing the frontend components to interact with the email campaign system. The system includes subscriber management, email campaign creation, HTML email support, and admin management tools.

## Table of Contents

1. [API Endpoints](#api-endpoints)
2. [TypeScript Types](#typescript-types)
3. [React Components](#react-components)
4. [State Management](#state-management)
5. [API Integration](#api-integration)
6. [Email Template Editor](#email-template-editor)
7. [Campaign Management](#campaign-management)
8. [Subscriber Management](#subscriber-management)
9. [Analytics & Reporting](#analytics--reporting)
10. [Error Handling](#error-handling)
11. [Testing](#testing)

## API Endpoints

### Subscriber Management

```typescript
// Base URL: /api/admin/subscribers
GET    /api/admin/subscribers              // List subscribers with pagination
GET    /api/admin/subscribers/stats        // Get subscriber statistics
GET    /api/admin/subscribers/sync         // Sync users to subscribers
GET    /api/admin/subscribers/:id          // Get subscriber by ID
POST   /api/admin/subscribers              // Create new subscriber
POST   /api/admin/subscribers/bulk-import  // Bulk import subscribers
PUT    /api/admin/subscribers/:id          // Update subscriber
DELETE /api/admin/subscribers/:id          // Delete subscriber
```

### Campaign Management

```typescript
// Base URL: /api/admin/campaigns
GET    /api/admin/campaigns                // List campaigns with pagination
GET    /api/admin/campaigns/:id            // Get campaign by ID
GET    /api/admin/campaigns/:id/logs       // Get campaign email logs
POST   /api/admin/campaigns                // Create new campaign
POST   /api/admin/campaigns/:id/preview    // Preview campaign
POST   /api/admin/campaigns/:id/send       // Send campaign
PUT    /api/admin/campaigns/:id            // Update campaign
DELETE /api/admin/campaigns/:id            // Delete campaign
```

### Unsubscribe (Public)

```typescript
POST   /api/admin/unsubscribe              // Unsubscribe via token
```

## TypeScript Types

Create a types file for the email system:

```typescript
// types/email.ts

export enum SubscriberStatus {
  ACTIVE = 'active',
  UNSUBSCRIBED = 'unsubscribed',
  BOUNCED = 'bounced'
}

export enum SubscriberSource {
  USER_REGISTRATION = 'user_registration',
  MANUAL_ADD = 'manual_add',
  IMPORTED = 'imported'
}

export enum CampaignStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  SENDING = 'sending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum EmailLogStatus {
  QUEUED = 'queued',
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  BOUNCED = 'bounced',
  FAILED = 'failed',
  UNSUBSCRIBED = 'unsubscribed'
}

export interface Subscriber {
  id: string;
  email: string;
  name: string;
  user_id: string | null;
  status: SubscriberStatus;
  source: SubscriberSource;
  metadata: Record<string, unknown>;
  unsubscribe_token: string | null;
  subscribed_at: string;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  template_id: string | null;
  html_content: string | null;
  text_content: string | null;
  recipient_filter: Record<string, unknown>;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  unsubscribe_count: number;
  status: CampaignStatus;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailLog {
  id: string;
  campaign_id: string;
  subscriber_id: string;
  email: string;
  name: string;
  status: EmailLogStatus;
  gmail_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSubscriberDto {
  email: string;
  name: string;
  metadata?: Record<string, unknown>;
}

export interface CreateCampaignDto {
  name: string;
  subject: string;
  template_id?: string;
  html_content?: string;
  text_content?: string;
  recipient_filter?: {
    status?: SubscriberStatus[];
    source?: SubscriberSource[];
    metadata_filters?: Record<string, unknown>;
    include_users?: boolean;
    include_manual?: boolean;
  };
  scheduled_at?: string;
  template_variables?: Record<string, string>;
}

export interface SubscriberStats {
  total: number;
  active: number;
  unsubscribed: number;
  bounced: number;
  by_source: Record<SubscriberSource, number>;
}

export interface BulkImportResponse {
  imported_count: number;
  skipped_count: number;
  failed_count: number;
  errors: Array<{
    email: string;
    error: string;
  }>;
}

export interface CampaignPreview {
  subject: string;
  html_content: string;
  text_content: string;
  variables_used: string[];
}
```

## React Components

### 1. Subscriber List Component

```typescript
// components/email/SubscriberList.tsx

import React, { useState, useEffect } from 'react';
import { Subscriber, SubscriberStatus, SubscriberSource } from '@/types/email';
import { useEmailApi } from '@/hooks/useEmailApi';

interface SubscriberListProps {
  onSubscriberSelect?: (subscriber: Subscriber) => void;
}

export const SubscriberList: React.FC<SubscriberListProps> = ({ onSubscriberSelect }) => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    status: '' as SubscriberStatus | '',
    source: '' as SubscriberSource | '',
    search: ''
  });
  
  const { getSubscribers, deleteSubscriber } = useEmailApi();

  const fetchSubscribers = async () => {
    setLoading(true);
    try {
      const response = await getSubscribers({
        page,
        limit: 20,
        ...filters
      });
      setSubscribers(response.subscribers);
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to fetch subscribers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscribers();
  }, [page, filters]);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this subscriber?')) {
      try {
        await deleteSubscriber(id);
        fetchSubscribers();
      } catch (error) {
        console.error('Failed to delete subscriber:', error);
      }
    }
  };

  const getStatusBadge = (status: SubscriberStatus) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      unsubscribed: 'bg-gray-100 text-gray-800',
      bounced: 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${colors[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
        <input
          type="text"
          placeholder="Search by email or name..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="flex-1 px-3 py-2 border rounded-md"
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value as SubscriberStatus })}
          className="px-3 py-2 border rounded-md"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="unsubscribed">Unsubscribed</option>
          <option value="bounced">Bounced</option>
        </select>
        <select
          value={filters.source}
          onChange={(e) => setFilters({ ...filters, source: e.target.value as SubscriberSource })}
          className="px-3 py-2 border rounded-md"
        >
          <option value="">All Sources</option>
          <option value="user_registration">User Registration</option>
          <option value="manual_add">Manual Add</option>
          <option value="imported">Imported</option>
        </select>
      </div>

      {/* Subscriber Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Subscriber
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Subscribed
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {subscribers.map((subscriber) => (
              <tr 
                key={subscriber.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => onSubscriberSelect?.(subscriber)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {subscriber.name}
                    </div>
                    <div className="text-sm text-gray-500">{subscriber.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(subscriber.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {subscriber.source.replace('_', ' ')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(subscriber.subscribed_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(subscriber.id);
                    }}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">
          Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} subscribers
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page * 20 >= total}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
```

### 2. Campaign Creation Component

```typescript
// components/email/CampaignCreator.tsx

import React, { useState } from 'react';
import { CreateCampaignDto, SubscriberStatus, SubscriberSource } from '@/types/email';
import { useEmailApi } from '@/hooks/useEmailApi';
import { HTMLEditor } from './HTMLEditor';

export const CampaignCreator: React.FC = () => {
  const [campaign, setCampaign] = useState<CreateCampaignDto>({
    name: '',
    subject: '',
    html_content: '',
    text_content: '',
    recipient_filter: {},
    template_variables: {}
  });
  
  const [isPreview, setIsPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const { createCampaign, previewCampaign } = useEmailApi();

  const handleSubmit = async () => {
    try {
      const result = await createCampaign(campaign);
      console.log('Campaign created:', result);
      // Redirect or show success message
    } catch (error) {
      console.error('Failed to create campaign:', error);
    }
  };

  const handlePreview = async () => {
    try {
      const preview = await previewCampaign(campaign.id!, {
        sample_data: {
          name: 'John Doe',
          email: 'john@example.com',
          company_name: 'Your Company'
        }
      });
      setPreviewData(preview);
      setIsPreview(true);
    } catch (error) {
      console.error('Failed to preview campaign:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-6">Create Email Campaign</h2>
        
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Campaign Name
            </label>
            <input
              type="text"
              value={campaign.name}
              onChange={(e) => setCampaign({ ...campaign, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Enter campaign name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Subject
            </label>
            <input
              type="text"
              value={campaign.subject}
              onChange={(e) => setCampaign({ ...campaign, subject: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Enter email subject"
            />
          </div>
        </div>

        {/* HTML Content Editor */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            HTML Content
          </label>
          <HTMLEditor
            value={campaign.html_content || ''}
            onChange={(content) => setCampaign({ ...campaign, html_content: content })}
          />
        </div>

        {/* Text Content */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Plain Text Content (Optional)
          </label>
          <textarea
            value={campaign.text_content || ''}
            onChange={(e) => setCampaign({ ...campaign, text_content: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            rows={6}
            placeholder="Enter plain text version"
          />
        </div>

        {/* Recipient Filters */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-4">Recipient Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Include Status
              </label>
              <select
                multiple
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value);
                  setCampaign({
                    ...campaign,
                    recipient_filter: {
                      ...campaign.recipient_filter,
                      status: values as SubscriberStatus[]
                    }
                  });
                }}
              >
                <option value="active">Active</option>
                <option value="unsubscribed">Unsubscribed</option>
                <option value="bounced">Bounced</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Include Source
              </label>
              <select
                multiple
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value);
                  setCampaign({
                    ...campaign,
                    recipient_filter: {
                      ...campaign.recipient_filter,
                      source: values as SubscriberSource[]
                    }
                  });
                }}
              >
                <option value="user_registration">User Registration</option>
                <option value="manual_add">Manual Add</option>
                <option value="imported">Imported</option>
              </select>
            </div>
          </div>
        </div>

        {/* Template Variables */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-4">Template Variables</h3>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Variable name (e.g., company_name)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
              />
              <input
                type="text"
                placeholder="Variable value"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
              />
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md">
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={handlePreview}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            Preview
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create Campaign
          </button>
        </div>
      </div>
    </div>
  );
};
```

### 3. HTML Email Editor Component

```typescript
// components/email/HTMLEditor.tsx

import React, { useState } from 'react';
import { Controlled as CodeMirror } from 'react-codemirror2';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material.css';
import 'codemirror/mode/xml/xml';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/css/css';
import 'codemirror/mode/htmlmixed/htmlmixed';

interface HTMLEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export const HTMLEditor: React.FC<HTMLEditorProps> = ({ value, onChange }) => {
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

  const defaultTemplate = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{subject}}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
        }
        .header { 
            background: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            border-radius: 8px; 
            margin-bottom: 20px; 
        }
        .content { 
            padding: 20px 0; 
        }
        .footer { 
            background: #f8f9fa; 
            padding: 15px; 
            text-align: center; 
            font-size: 12px; 
            color: #666; 
            border-radius: 8px; 
            margin-top: 20px; 
        }
        .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background: #007bff; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px; 
        }
        .unsubscribe { 
            font-size: 12px; 
            color: #666; 
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{company_name}}</h1>
    </div>
    <div class="content">
        <h2>Hello {{name}}!</h2>
        <p>{{message_body}}</p>
        {{#if call_to_action_url}}
        <p style="text-align: center; margin: 30px 0;">
            <a href="{{call_to_action_url}}" class="button">{{call_to_action_text}}</a>
        </p>
        {{/if}}
    </div>
    <div class="footer">
        <p>Thank you for being part of our community!</p>
        <p class="unsubscribe">
            <a href="{{unsubscribe_url}}">Unsubscribe</a> from these emails
        </p>
    </div>
</body>
</html>`;

  const handleUseTemplate = () => {
    onChange(defaultTemplate);
  };

  return (
    <div className="border border-gray-300 rounded-md">
      {/* Tabs */}
      <div className="flex border-b border-gray-300">
        <button
          onClick={() => setActiveTab('editor')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'editor'
              ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          HTML Editor
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'preview'
              ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Preview
        </button>
        <div className="ml-auto p-2">
          <button
            onClick={handleUseTemplate}
            className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
          >
            Use Default Template
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-96">
        {activeTab === 'editor' ? (
          <CodeMirror
            value={value}
            options={{
              mode: 'htmlmixed',
              theme: 'material',
              lineNumbers: true,
              lineWrapping: true,
              indentUnit: 2,
              tabSize: 2
            }}
            onBeforeChange={(editor, data, value) => {
              onChange(value);
            }}
          />
        ) : (
          <div className="p-4">
            <iframe
              srcDoc={value || '<p>No content to preview</p>'}
              className="w-full h-96 border border-gray-200 rounded"
              title="Email Preview"
            />
          </div>
        )}
      </div>
    </div>
  );
};
```

## State Management

### React Query/TanStack Query Setup

```typescript
// hooks/useEmailApi.ts

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Subscriber, 
  EmailCampaign, 
  CreateSubscriberDto, 
  CreateCampaignDto,
  SubscriberStats,
  BulkImportResponse
} from '@/types/email';

const API_BASE = '/api/admin';

export const useEmailApi = () => {
  const queryClient = useQueryClient();

  // Subscriber queries
  const useSubscribers = (params: any) => {
    return useQuery({
      queryKey: ['subscribers', params],
      queryFn: async () => {
        const searchParams = new URLSearchParams(params);
        const response = await fetch(`${API_BASE}/subscribers?${searchParams}`);
        if (!response.ok) throw new Error('Failed to fetch subscribers');
        return response.json();
      }
    });
  };

  const useSubscriberStats = () => {
    return useQuery({
      queryKey: ['subscriber-stats'],
      queryFn: async (): Promise<SubscriberStats> => {
        const response = await fetch(`${API_BASE}/subscribers/stats`);
        if (!response.ok) throw new Error('Failed to fetch subscriber stats');
        return response.json();
      }
    });
  };

  // Campaign queries
  const useCampaigns = (params: any) => {
    return useQuery({
      queryKey: ['campaigns', params],
      queryFn: async () => {
        const searchParams = new URLSearchParams(params);
        const response = await fetch(`${API_BASE}/campaigns?${searchParams}`);
        if (!response.ok) throw new Error('Failed to fetch campaigns');
        return response.json();
      }
    });
  };

  const useCampaign = (id: string) => {
    return useQuery({
      queryKey: ['campaign', id],
      queryFn: async (): Promise<EmailCampaign> => {
        const response = await fetch(`${API_BASE}/campaigns/${id}`);
        if (!response.ok) throw new Error('Failed to fetch campaign');
        return response.json();
      },
      enabled: !!id
    });
  };

  // Mutations
  const createSubscriber = useMutation({
    mutationFn: async (data: CreateSubscriberDto): Promise<Subscriber> => {
      const response = await fetch(`${API_BASE}/subscribers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create subscriber');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
      queryClient.invalidateQueries({ queryKey: ['subscriber-stats'] });
    }
  });

  const bulkImportSubscribers = useMutation({
    mutationFn: async (data: { subscribers: CreateSubscriberDto[]; skip_duplicates?: boolean }): Promise<BulkImportResponse> => {
      const response = await fetch(`${API_BASE}/subscribers/bulk-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to import subscribers');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
      queryClient.invalidateQueries({ queryKey: ['subscriber-stats'] });
    }
  });

  const createCampaign = useMutation({
    mutationFn: async (data: CreateCampaignDto): Promise<EmailCampaign> => {
      const response = await fetch(`${API_BASE}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create campaign');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    }
  });

  const sendCampaign = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_BASE}/campaigns/${id}/send`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to send campaign');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    }
  });

  return {
    // Queries
    useSubscribers,
    useSubscriberStats,
    useCampaigns,
    useCampaign,
    
    // Mutations
    createSubscriber: createSubscriber.mutateAsync,
    bulkImportSubscribers: bulkImportSubscribers.mutateAsync,
    createCampaign: createCampaign.mutateAsync,
    sendCampaign: sendCampaign.mutateAsync,
    
    // Loading states
    isCreatingSubscriber: createSubscriber.isPending,
    isImportingSubscribers: bulkImportSubscribers.isPending,
    isCreatingCampaign: createCampaign.isPending,
    isSendingCampaign: sendCampaign.isPending
  };
};
```

## Campaign Management Dashboard

```typescript
// components/email/CampaignDashboard.tsx

import React, { useState } from 'react';
import { EmailCampaign, CampaignStatus } from '@/types/email';
import { useEmailApi } from '@/hooks/useEmailApi';

export const CampaignDashboard: React.FC = () => {
  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);
  const { useCampaigns, sendCampaign, isSendingCampaign } = useEmailApi();
  
  const { data: campaignsData, isLoading } = useCampaigns({
    page: 1,
    limit: 20
  });

  const getStatusBadge = (status: CampaignStatus) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      scheduled: 'bg-blue-100 text-blue-800',
      sending: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${colors[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const handleSendCampaign = async (id: string) => {
    if (confirm('Are you sure you want to send this campaign? This action cannot be undone.')) {
      try {
        await sendCampaign(id);
        alert('Campaign sending started successfully!');
      } catch (error) {
        alert('Failed to send campaign. Please try again.');
      }
    }
  };

  const calculateDeliveryRate = (campaign: EmailCampaign) => {
    if (campaign.sent_count === 0) return 0;
    return Math.round((campaign.delivered_count / campaign.sent_count) * 100);
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading campaigns...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Email Campaigns</h1>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Create Campaign
        </button>
      </div>

      {/* Campaign Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campaignsData?.campaigns.map((campaign: EmailCampaign) => (
          <div key={campaign.id} className="bg-white p-6 rounded-lg shadow border">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">{campaign.name}</h3>
              {getStatusBadge(campaign.status)}
            </div>
            
            <p className="text-gray-600 mb-4">{campaign.subject}</p>
            
            <div className="space-y-2 text-sm text-gray-500">
              <div className="flex justify-between">
                <span>Recipients:</span>
                <span>{campaign.total_recipients}</span>
              </div>
              <div className="flex justify-between">
                <span>Sent:</span>
                <span>{campaign.sent_count}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivered:</span>
                <span>{campaign.delivered_count}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Rate:</span>
                <span>{calculateDeliveryRate(campaign)}%</span>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t flex gap-2">
              {campaign.status === 'draft' && (
                <button
                  onClick={() => handleSendCampaign(campaign.id)}
                  disabled={isSendingCampaign}
                  className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {isSendingCampaign ? 'Sending...' : 'Send Now'}
                </button>
              )}
              <button
                onClick={() => setSelectedCampaign(campaign)}
                className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50"
              >
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

## Error Handling

```typescript
// components/email/ErrorBoundary.tsx

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class EmailErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Email system error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-md mx-auto bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-red-800">
                Something went wrong
              </h3>
              <p className="text-sm text-red-700 mt-1">
                There was an error loading the email system. Please refresh the page and try again.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## Usage Instructions

### 1. Setting Up the Email System

1. **Install Dependencies:**
   ```bash
   npm install @tanstack/react-query codemirror react-codemirror2
   ```

2. **Configure React Query:**
   ```typescript
   // In your main App.tsx or index.tsx
   import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
   
   const queryClient = new QueryClient();
   
   function App() {
     return (
       <QueryClientProvider client={queryClient}>
         <EmailErrorBoundary>
           {/* Your app components */}
         </EmailErrorBoundary>
       </QueryClientProvider>
     );
   }
   ```

### 2. Creating a Complete Email Management Page

```typescript
// pages/EmailManagement.tsx

import React, { useState } from 'react';
import { SubscriberList } from '@/components/email/SubscriberList';
import { CampaignDashboard } from '@/components/email/CampaignDashboard';
import { CampaignCreator } from '@/components/email/CampaignCreator';

export const EmailManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'subscribers' | 'create'>('campaigns');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Email Marketing</h1>
          <p className="text-gray-600">Manage your email campaigns and subscribers</p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'campaigns'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Campaigns
            </button>
            <button
              onClick={() => setActiveTab('subscribers')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'subscribers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Subscribers
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'create'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Create Campaign
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow">
          {activeTab === 'campaigns' && <CampaignDashboard />}
          {activeTab === 'subscribers' && <SubscriberList />}
          {activeTab === 'create' && <CampaignCreator />}
        </div>
      </div>
    </div>
  );
};
```

### 3. Template Variables

The system supports the following built-in template variables:

- `{{name}}` - Subscriber's name
- `{{email}}` - Subscriber's email
- `{{company_name}}` - Your company name
- `{{unsubscribe_url}}` - Unsubscribe link
- `{{message_body}}` - Main message content
- `{{call_to_action_url}}` - CTA button URL
- `{{call_to_action_text}}` - CTA button text

### 4. Conditional Blocks

Use conditional blocks for optional content:

```html
{{#if call_to_action_url}}
<p style="text-align: center; margin: 30px 0;">
    <a href="{{call_to_action_url}}" class="button">{{call_to_action_text}}</a>
</p>
{{/if}}
```

### 5. Security Considerations

- All email content is sanitized before sending
- Unsubscribe tokens are cryptographically secure
- Admin endpoints require proper authentication
- Rate limiting is implemented for email sending

### 6. Testing

Create comprehensive tests for your components:

```typescript
// __tests__/SubscriberList.test.tsx

import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SubscriberList } from '@/components/email/SubscriberList';

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

test('renders subscriber list', async () => {
  const queryClient = createTestQueryClient();
  
  render(
    <QueryClientProvider client={queryClient}>
      <SubscriberList />
    </QueryClientProvider>
  );

  await waitFor(() => {
    expect(screen.getByText('Loading subscribers...')).toBeInTheDocument();
  });
});
```

This comprehensive documentation provides everything needed to implement a complete frontend for the email campaign system, including subscriber management, campaign creation, HTML email editing, and analytics.