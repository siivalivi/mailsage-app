# MailSage Functional Specification

## 1. Executive Summary

MailSage is an AI-powered Gmail assistant that enables users to interact with their Gmail inbox using natural language queries. The application leverages Google's AI platform (Gemini) to provide intelligent email summarization, categorization, and search capabilities.

### Key Features
- **Natural Language Email Queries**: Search Gmail using everyday language
- **AI-Powered Email Summarization**: Generate concise summaries of email content
- **Daily Email Briefings**: Categorized overview of recent emails
- **Google OAuth Integration**: Secure access to Gmail accounts
- **Real-time Email Processing**: Instant results with intelligent filtering

## 2. System Overview

### Architecture
- **Frontend**: Next.js 15 with React 18, TypeScript, and Tailwind CSS
- **Backend**: Next.js Server Actions with Genkit AI framework
- **Authentication**: Firebase Authentication with Google OAuth
- **AI Platform**: Google AI (Gemini) via Genkit
- **Email Service**: Gmail API integration
- **Deployment**: Firebase App Hosting with CI/CD pipeline

### Technology Stack
- **Framework**: Next.js 15.3.3
- **Language**: TypeScript 5
- **UI Library**: React 18.3.1 with Radix UI components
- **Styling**: Tailwind CSS with custom design system
- **AI Framework**: Genkit 1.8.0 with Google AI integration
- **Testing**: Jest with React Testing Library
- **Authentication**: Firebase Auth with Google OAuth
- **Email API**: Gmail API v1

## 3. Core Functionality

### 3.1 Authentication System

#### User Authentication Flow
1. **Landing Page**: Users are presented with a sign-in option using Google OAuth
2. **OAuth Consent**: Users grant Gmail read-only permissions (`gmail.readonly` scope)
3. **Token Management**: Access tokens are stored in session storage and managed by AuthContext
4. **Session Persistence**: Authentication state persists across browser sessions
5. **Token Refresh**: Automatic token refresh and error handling for expired tokens

#### Authentication Features
- **Google Sign-In**: One-click authentication with Google accounts
- **Gmail Permissions**: Automatic request for Gmail read access
- **Session Management**: Secure token storage and retrieval
- **Error Handling**: Graceful handling of authentication failures
- **Re-authentication**: Automatic prompts for token refresh

### 3.2 Email Query System

#### Natural Language Query Processing
The system uses an **agentic AI approach** with specialized tools for different query types:

1. **Query Classification**: AI agent analyzes user query and selects appropriate tool
2. **Tool Categories**:
   - **Billing Tool**: Handles invoices, receipts, payments, charges, orders
   - **Travel Tool**: Processes flights, hotels, bookings, itineraries
   - **Promotions Tool**: Manages sales, discounts, offers, coupons
   - **General Tool**: Handles all other query types

#### Query Processing Flow
1. **User Input**: Natural language query (e.g., "invoices from Uber last month")
2. **AI Analysis**: Agent determines query category and selects appropriate tool
3. **Gmail Query Generation**: Specialized prompt converts natural language to Gmail API query
4. **Email Fetching**: Gmail API returns matching email metadata
5. **AI Refinement**: Second AI pass filters relevant emails and generates summaries
6. **Results Display**: Filtered and summarized emails presented to user

#### Query Examples
- "Show me all invoices from last month"
- "Find travel confirmations for my trip to Paris"
- "What promotions did I receive this week?"
- "Emails from my boss about the project deadline"

### 3.3 Email Summarization

#### Individual Email Summarization
- **Content Analysis**: AI analyzes full email content
- **Key Points Extraction**: Identifies main topics and action items
- **Summary Generation**: Creates concise, informative summaries
- **Context Preservation**: Maintains important details and context

#### Batch Email Summarization
- **Overall Summary**: Generates comprehensive summary of queried emails
- **Categorization**: Groups emails by type and importance
- **Insight Extraction**: Identifies patterns and trends across emails

### 3.4 Daily Briefing System

#### Briefing Categories
- **Receipts & Invoices**: Financial documents and payment confirmations
- **Promotions & Marketing**: Sales offers and marketing communications
- **Travel Confirmations**: Booking confirmations and itineraries
- **Social Notifications**: Social media and communication updates
- **Important Conversations**: High-priority business communications
- **Other**: Miscellaneous emails

#### Time Range Options
- **Today**: Emails received today
- **Yesterday**: Emails from yesterday
- **This Week**: Emails from the current week (Monday to Sunday)
- **Last 7 Days**: Emails from the past 7 days

#### Briefing Format
- **Markdown Output**: Structured, readable format
- **Category Headers**: Clear section organization
- **Email Highlights**: Sender and subject for key emails
- **Summary Statements**: Brief descriptions of each category

### 3.5 Email Management

#### Email Display Features
- **Email List**: Chronological display of queried emails
- **Email Details**: Full email content with metadata
- **Read Status**: Visual indicators for email read state
- **Snippet Preview**: Brief email content preview
- **Timestamp Display**: Formatted date and time information

#### Email Interaction
- **Email Selection**: Click to view full email content
- **Summary Generation**: On-demand AI summarization
- **Action Item Extraction**: Identify tasks and follow-ups
- **Reply Drafting**: AI-assisted reply composition

## 4. User Interface

### 4.1 Landing Page
- **Brand Identity**: MailSage logo and tagline
- **Feature Highlights**: Key capabilities overview
- **Sign-In Button**: Google OAuth integration
- **Loading States**: Smooth transitions during authentication

### 4.2 Dashboard
- **Welcome Message**: Personalized greeting with user's name
- **Query Form**: Natural language search input
- **Daily Briefing**: Categorized email overview
- **Email Results**: Display of queried emails
- **Overall Summary**: AI-generated summary of results

### 4.3 Email Interface
- **Email List**: Scrollable list of email previews
- **Email Detail View**: Full email content display
- **Summary Panel**: AI-generated email summary
- **Action Items**: Extracted tasks and follow-ups
- **Reply Options**: AI-assisted reply drafting

### 4.4 Responsive Design
- **Mobile Optimization**: Touch-friendly interface
- **Desktop Enhancement**: Full-featured desktop experience
- **Accessibility**: WCAG compliant design
- **Cross-Browser**: Compatible with modern browsers

## 5. AI Integration

### 5.1 Genkit Framework
- **Flow Management**: Structured AI workflow orchestration
- **Prompt Engineering**: Specialized prompts for different tasks
- **Tool Integration**: Modular AI tool system
- **Error Handling**: Robust error management and recovery

### 5.2 AI Capabilities
- **Natural Language Processing**: Understanding user intent
- **Email Classification**: Categorizing emails by type
- **Content Summarization**: Extracting key information
- **Query Translation**: Converting natural language to Gmail queries
- **Relevance Filtering**: Identifying important emails

### 5.3 AI Tools
- **Billing Query Tool**: Specialized for financial emails
- **Travel Query Tool**: Optimized for travel-related emails
- **Promotions Query Tool**: Focused on marketing emails
- **General Query Tool**: Handles miscellaneous queries

## 6. Data Management

### 6.1 Email Data Structure
```typescript
interface Email {
  id: string;           // Gmail message ID
  sender: string;       // Email sender
  subject: string;      // Email subject
  body: string;         // Email content
  summary?: string;     // AI-generated summary
  timestamp: number;    // Unix timestamp
  isRead?: boolean;     // Read status
  snippet?: string;     // Gmail snippet
}
```

### 6.2 Queried Email Structure
```typescript
interface QueriedEmail {
  id: string;           // Gmail message ID
  sender: string;       // Email sender
  subject: string;      // Email subject
  snippet: string;      // Gmail snippet
  timestamp: number;    // Unix timestamp
  summary: string;      // AI-generated summary
}
```

### 6.3 Data Flow
1. **User Query**: Natural language input
2. **AI Processing**: Query analysis and Gmail query generation
3. **Gmail API**: Email metadata retrieval
4. **AI Refinement**: Relevance filtering and summarization
5. **Client Display**: Formatted results presentation

## 7. Security and Privacy

### 7.1 Authentication Security
- **OAuth 2.0**: Secure Google authentication
- **Token Management**: Secure token storage and refresh
- **Scope Limitation**: Read-only Gmail access
- **Session Security**: Secure session management

### 7.2 Data Privacy
- **No Data Storage**: Emails not stored on server
- **Temporary Processing**: Data processed in memory only
- **Token Security**: Access tokens managed securely
- **API Security**: Secure Gmail API communication

### 7.3 Error Handling
- **Authentication Errors**: Graceful handling of auth failures
- **API Errors**: Robust Gmail API error management
- **AI Errors**: Fallback handling for AI processing failures
- **Network Errors**: Retry logic and user feedback

## 8. Performance and Scalability

### 8.1 Performance Optimizations
- **Server-Side Processing**: AI processing on server
- **Caching**: Strategic caching of frequently accessed data
- **Lazy Loading**: On-demand email content loading
- **Pagination**: Efficient handling of large email sets

### 8.2 Scalability Features
- **Stateless Design**: No server-side state management
- **API Rate Limiting**: Respectful Gmail API usage
- **Error Recovery**: Robust error handling and recovery
- **Load Balancing**: Firebase hosting scalability

## 9. Testing Strategy

### 9.1 Test Coverage
- **Unit Tests**: Individual component and function testing
- **Integration Tests**: End-to-end workflow testing
- **Functional Tests**: User interaction testing
- **AI Flow Tests**: AI processing validation

### 9.2 Test Categories
- **Component Tests**: React component behavior
- **AI Flow Tests**: Genkit flow validation
- **Authentication Tests**: OAuth flow testing
- **Email Processing Tests**: Gmail API integration

## 10. Deployment and DevOps

### 10.1 CI/CD Pipeline
- **GitHub Actions**: Automated testing and deployment
- **Firebase Hosting**: Production deployment
- **Environment Management**: Test and production environments
- **Automated Testing**: Comprehensive test suite execution

### 10.2 Deployment Features
- **Auto-Deploy**: Automatic deployment on push
- **Environment Variables**: Secure configuration management
- **Health Checks**: Application health monitoring
- **Error Tracking**: Production error monitoring

## 11. Future Enhancements

### 11.1 Planned Features
- **Email Threading**: Conversation thread management
- **Advanced Filtering**: Custom email filtering rules
- **Email Analytics**: Usage statistics and insights
- **Mobile App**: Native mobile application

### 11.2 Technical Improvements
- **Real-time Updates**: Live email synchronization
- **Offline Support**: Offline email access
- **Advanced AI**: Enhanced AI capabilities
- **Performance Optimization**: Further performance improvements

## 12. Conclusion

MailSage provides a powerful, AI-driven interface for Gmail management, enabling users to interact with their email using natural language. The application combines modern web technologies with advanced AI capabilities to deliver a seamless email management experience.

The system's architecture ensures scalability, security, and maintainability while providing users with intelligent email processing capabilities. The comprehensive testing strategy and CI/CD pipeline ensure reliable deployment and operation.

Key strengths include:
- **Intelligent Query Processing**: Agentic AI approach with specialized tools
- **Secure Authentication**: Robust OAuth integration
- **Comprehensive Testing**: Multi-layer testing strategy
- **Modern Architecture**: Next.js with Genkit AI framework
- **User-Friendly Interface**: Intuitive, responsive design

The application successfully bridges the gap between traditional email interfaces and modern AI capabilities, providing users with a powerful tool for email management and productivity enhancement. 