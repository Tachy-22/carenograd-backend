# Remograd - AI Graduate School Application Assistant

## Product Overview

**Remograd** is an intelligent AI-powered platform designed to help students navigate the complex graduate school application process. The platform provides personalized guidance, research assistance, document analysis, and application management through a conversational AI interface.

### Core Value Proposition
- **Personalized Application Strategy**: AI analyzes your academic background and suggests optimal graduate programs
- **Research Automation**: Automatically finds professors, programs, and deadlines
- **Document Intelligence**: Upload and analyze CVs, transcripts, research papers for personalized recommendations  
- **Communication Assistance**: Draft professional emails to professors and admissions committees
- **Application Tracking**: Organize applications, deadlines, and follow-ups in integrated spreadsheets
- **Multi-Platform Integration**: Seamlessly works with Google Sheets, Docs, Gmail, and academic databases

### Target Users
- Undergraduate students planning for graduate school
- Recent graduates seeking advanced degrees
- International students navigating complex application processes
- Career changers pursuing graduate education

---

## Frontend Application Specification

### Technology Stack
- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui + AI Elements from Vercel
- **Streaming**: AI Elements for real-time AI responses
- **Authentication**: Google OAuth integration
- **State Management**: React Context/Zustand for chat history and user state

---

## User Experience Flow

### 1. Landing Page (Unauthenticated)
```
┌─────────────────────────────────────────────────────┐
│                    Navigation Bar                    │
│  [Remograd Logo]              [Login] [Sign Up]    │
└─────────────────────────────────────────────────────┘
│                                                     │
│                  Welcome Message                    │
│    "Your AI Assistant for Graduate School Success"  │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │                                             │   │
│  │         Chat Input Area                     │   │
│  │  "Ask me about graduate programs..."       │   │
│  │                                    [Send]   │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│              Feature Highlights                     │
│   [Research Programs] [Analyze Documents] [Track]   │
└─────────────────────────────────────────────────────┘
```

**Behavior**: When user tries to send a message without authentication:
- Modal overlay appears: "Sign in to start your graduate school journey"
- Google OAuth login button
- Brief explanation of features requiring authentication

### 2. Post-Authentication Interface

#### Main Layout Structure
```
┌─────────────────────────────────────────────────────┐
│                Navigation Header                     │
│  [Remograd] [Documents] [Applications] [Profile] [⚙] │
└─────────────────────────────────────────────────────┘
│                                                     │
│  ┌─────────────┐ ┌─────────────────────────────────┐ │
│  │   Sidebar   │ │        Main Chat Area          │ │
│  │             │ │                                 │ │
│  │ [+ New Chat]│ │     Chat Messages               │ │
│  │             │ │                                 │ │
│  │ Chat History│ │  ┌─────────────────────────┐   │ │
│  │ • Chat 1    │ │  │ You: Help me find...    │   │ │
│  │ • Chat 2    │ │  └─────────────────────────┘   │ │
│  │ • Chat 3    │ │                                 │ │
│  │             │ │  ┌─────────────────────────┐   │ │
│  │             │ │  │ AI: I'll help you...    │   │ │
│  │             │ │  │ [Progress Updates]      │   │ │
│  │             │ │  └─────────────────────────┘   │ │
│  │             │ │                                 │ │
│  │             │ │  ┌─────────────────────────┐   │ │
│  │             │ │  │ Chat Input              │   │ │
│  │             │ │  │ "Type your message..." │   │ │
│  │  [Sign Out] │ │  │                  [Send] │   │ │
│  └─────────────┘ │  └─────────────────────────┘   │ │
└─────────────────────────────────────────────────────┘
```

---

## Detailed Component Specifications

### 1. Navigation Header (`components/Navigation.tsx`)
```typescript
// Sticky navigation with user profile and main navigation
- Logo: Clickable, returns to main chat
- Navigation Items: Documents, Applications, Profile
- User Avatar: Dropdown with settings and sign out
- Mobile responsive with hamburger menu
```

**Features**:
- **Documents**: Access uploaded CV, transcripts, research papers
- **Applications**: View application tracking spreadsheets
- **Profile**: User settings, connected accounts (Google, academic profiles)

### 2. Sidebar (`components/Sidebar.tsx`)
```typescript
// Collapsible sidebar for chat management
- New Chat Button: Prominent, starts fresh conversation
- Chat History: Scrollable list of previous conversations
- Auto-generated titles from first message
- Search functionality for chat history
- Sign Out: Bottom of sidebar
```

**Responsive Behavior**:
- Desktop: Always visible, can collapse to icons
- Mobile: Overlay that slides in from left
- Auto-collapse on mobile after selection

### 3. Chat Interface (`components/ChatInterface.tsx`)

#### Message Components
```typescript
// User Messages
- Right-aligned bubble
- User avatar
- Timestamp on hover
- Copy message functionality

// AI Messages  
- Left-aligned with AI avatar
- Rich content support (markdown, links, tables)
- Tool execution indicators
- Progress streaming with AI Elements
```

#### AI Elements Integration for Streaming
```typescript
// Real-time progress updates during AI processing
import { useAssistantStream } from '@ai-sdk/react'

Progress Indicators:
🔄 "Searching for graduate programs..."
🔧 "Creating spreadsheet with program data..."  
📊 "Analyzing your academic profile..."
✅ "Research complete! Found 15 matching programs."
```

#### Input Area (`components/ChatInput.tsx`)
```typescript
- Auto-expanding textarea
- Send button with loading state
- File upload capability (drag & drop)
- Suggestions/quick actions when empty
- Character count for long messages
```

### 4. Authentication Modal (`components/AuthModal.tsx`)
```typescript
// Elegant modal for authentication prompts
- Backdrop blur effect
- Google OAuth button styled with shadcn/ui
- Brief feature preview
- "Continue as Guest" option for basic features
- Animated entrance/exit
```

---

## Key User Interactions

### 1. First-Time User Journey
1. **Landing**: User sees clean interface with prominent chat input
2. **Prompt Attempt**: User types question, modal appears requesting auth
3. **Authentication**: Google OAuth flow in popup/redirect
4. **Onboarding**: Brief tutorial highlighting key features
5. **First Chat**: Guided conversation about user's academic goals

### 2. Returning User Experience
1. **Auto-Login**: JWT token validation on page load
2. **Sidebar Restoration**: Previous chat history loaded
3. **Continue Conversation**: Resume last active chat or start new
4. **Quick Actions**: Common tasks accessible via shortcuts

### 3. Document Upload Flow
```
User: "Can you analyze my CV?"
AI: "I'd be happy to analyze your CV! Please upload your document."

[File Upload Zone Appears]
- Drag & drop or click to browse
- PDF preview before upload
- Upload progress indicator
- AI processing status with streaming updates

AI: "🔄 Processing your CV..."
AI: "📊 Analyzing your academic background..."  
AI: "✅ Analysis complete! I found your background in..."
```

### 4. Research and Application Tracking
```
User: "Find PhD programs in machine learning"
AI: "🔄 Searching academic databases..."
AI: "🔧 Creating tracking spreadsheet..."
AI: "📊 Found 23 programs. Creating detailed comparison..."
AI: "✅ Research complete! I've created a spreadsheet with..."

[Interactive Elements]:
- Embedded spreadsheet preview
- Direct links to program websites
- Email draft buttons for professor outreach
```

---

## Advanced UI Features

### 1. AI Elements Streaming Components
```typescript
// Progress indicators with smooth animations
- Typing indicators with dots animation
- Tool execution badges with icons
- Progress bars for long-running tasks
- Success/error states with appropriate colors
- Expandable details for complex operations
```

### 2. Rich Message Rendering
```typescript
// Support for complex AI responses
- Tables for program comparisons
- Links to university websites
- Embedded Google Sheets previews
- Email drafts with edit functionality
- File attachment displays
- Academic paper citations
```

### 3. Smart Suggestions
```typescript
// Context-aware quick actions
- "Upload your CV" for new users
- "Research programs in [field]" based on profile
- "Draft email to Professor [name]" 
- "Update application status"
- Recent conversation topics
```

### 4. Mobile Optimization
```typescript
// Touch-optimized interface
- Swipe gestures for sidebar
- Bottom sheet for quick actions
- Optimized virtual keyboard handling
- Voice input support
- Offline message queuing
```

---

## Design System

### Color Palette
```css
/* Primary Brand Colors */
--primary: #2563eb /* Blue - trust, intelligence */
--primary-foreground: #ffffff

/* AI/Tech Accent */  
--accent: #10b981 /* Green - growth, success */
--accent-foreground: #ffffff

/* Neutral Grays */
--background: #ffffff
--foreground: #0f172a
--muted: #f8fafc
--muted-foreground: #64748b
--border: #e2e8f0
```

### Typography
```css
/* Headings: Inter */
font-family: 'Inter', sans-serif;

/* Body/Chat: System fonts for readability */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', ...;

/* Code/Technical: JetBrains Mono */
font-family: 'JetBrains Mono', monospace;
```

### Component Styling
- **Buttons**: shadcn/ui Button with custom variants
- **Input Fields**: Rounded, subtle shadows, focus states
- **Chat Bubbles**: Subtle gradients, proper spacing
- **Loading States**: Skeleton loaders matching content
- **Animations**: Smooth transitions, spring physics for interactions

---

## Technical Implementation Notes

### State Management
```typescript
// Chat state with Zustand
interface ChatStore {
  conversations: Conversation[]
  activeConversation: string | null
  isLoading: boolean
  createConversation: () => void
  sendMessage: (message: string) => void
  loadHistory: () => void
}
```

### API Integration
```typescript
// Streaming chat with AI Elements
const { messages, input, handleSubmit, isLoading } = useChat({
  api: '/api/agent/chat/stream',
  onResponse: (response) => {
    // Handle streaming progress updates
  },
  onFinish: (message) => {
    // Update conversation history
  }
})
```

### Performance Considerations
- Virtual scrolling for long chat histories
- Message pagination for older conversations
- Image optimization for user avatars
- Code splitting for auth components
- Prefetching for common user flows

---

## Success Metrics

### User Engagement
- Daily active users and session duration
- Messages per conversation
- Feature adoption rates (document upload, spreadsheet creation)
- Conversation completion rates

### Application Success
- Users who complete graduate applications
- Successful program admissions tracked
- Professor email response rates
- Application deadline adherence

This specification provides a comprehensive foundation for building a ChatGPT-style interface optimized for graduate school application assistance, leveraging modern web technologies and AI streaming capabilities.