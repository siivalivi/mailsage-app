import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { AuthContext } from '../../src/contexts/AuthContext'

// Mock data for testing
export const mockUser = {
  uid: 'test-uid',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
}

export const mockEmails = [
  {
    id: '1',
    threadId: 'thread-1',
    subject: 'Project Update Meeting',
    sender: 'manager@company.com',
    content: 'Hi team, we need to schedule a meeting to discuss the project updates. Please let me know your availability for next week.',
    date: '2024-01-01T10:00:00Z',
    isRead: false,
    hasAttachments: false,
    attachments: [],
    labels: ['INBOX', 'IMPORTANT'],
  },
  {
    id: '2',
    threadId: 'thread-2',
    subject: 'Budget Report Due',
    sender: 'finance@company.com',
    content: 'The quarterly budget report is due by end of this week. Please submit your department expenses.',
    date: '2024-01-01T11:00:00Z',
    isRead: false,
    hasAttachments: true,
    attachments: [
      {
        filename: 'budget-template.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 15360,
      },
    ],
    labels: ['INBOX', 'CATEGORY_UPDATES'],
  },
  {
    id: '3',
    threadId: 'thread-3',
    subject: 'Client Meeting Confirmation',
    sender: 'client@external.com',
    content: 'Thank you for scheduling the meeting. I confirm our appointment for Thursday at 2 PM.',
    date: '2024-01-01T12:00:00Z',
    isRead: true,
    hasAttachments: false,
    attachments: [],
    labels: ['INBOX', 'CATEGORY_PERSONAL'],
  },
]

export const mockAuthContext = {
  currentUser: null,
  loading: false,
  signInWithGoogle: jest.fn(),
  signOutUser: jest.fn(),
  getGoogleAccessToken: jest.fn(() => null),
}

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authContext?: Partial<typeof mockAuthContext>
}

export function renderWithProviders(
  ui: ReactElement,
  {
    authContext = mockAuthContext,
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AuthContext.Provider value={{ ...mockAuthContext, ...authContext }}>
        {children}
      </AuthContext.Provider>
    )
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

// Mock environment setup
export function setupTestEnvironment() {
  // Mock environment variables
  process.env.NODE_ENV = 'test'
  process.env.FIREBASE_API_KEY = 'test-firebase-key'
  process.env.FIREBASE_AUTH_DOMAIN = 'test-project.firebaseapp.com'
  process.env.FIREBASE_PROJECT_ID = 'test-project'
  process.env.FIREBASE_STORAGE_BUCKET = 'test-project.appspot.com'
  process.env.FIREBASE_MESSAGING_SENDER_ID = '123456789'
  process.env.FIREBASE_APP_ID = 'test-app-id'
  process.env.GMAIL_CLIENT_ID = 'test-gmail-client-id'
  process.env.GMAIL_CLIENT_SECRET = 'test-gmail-client-secret'
  process.env.GMAIL_REFRESH_TOKEN = 'test-gmail-refresh-token'
  process.env.GOOGLE_AI_API_KEY = 'test-ai-key'
  process.env.TEST_USER_EMAIL = 'test@example.com'
  process.env.TEST_USER_PASSWORD = 'test-password'

  // Mock localStorage
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  }
  Object.defineProperty(window, 'localStorage', { value: localStorageMock })

  // Mock sessionStorage
  const sessionStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  }
  Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock })

  // Mock window.location
  const locationMock = {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: '',
    reload: jest.fn(),
    assign: jest.fn(),
    replace: jest.fn(),
  }
  Object.defineProperty(window, 'location', { value: locationMock })

  // Mock console methods to reduce noise in tests
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}

// Mock Firebase services
export function mockFirebase() {
  return {
    auth: {
      signInWithPopup: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChanged: jest.fn(),
      currentUser: mockUser,
    },
    firestore: {
      collection: jest.fn(),
      doc: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      where: jest.fn(),
      orderBy: jest.fn(),
      limit: jest.fn(),
    },
  }
}

// Mock Gmail API
export function mockGmailApi() {
  return {
    users: {
      messages: {
        list: jest.fn().mockResolvedValue({
          data: {
            messages: mockEmails.map(email => ({ id: email.id })),
          },
        }),
        get: jest.fn().mockImplementation((params) => {
          const email = mockEmails.find(e => e.id === params.id)
          return Promise.resolve({ data: email })
        }),
      },
    },
  }
}

// Mock AI/Genkit services
export function mockAIServices() {
  return {
    summarizeEmail: jest.fn().mockResolvedValue({
      summary: 'Test email summary',
      keyPoints: ['Key point 1', 'Key point 2'],
      priority: 'medium',
    }),
    extractActionItems: jest.fn().mockResolvedValue({
      actionItems: [
        {
          task: 'Test task',
          assignee: 'test user',
          dueDate: '2024-01-07',
          priority: 'medium',
        },
      ],
    }),
    generateDailyBriefing: jest.fn().mockResolvedValue({
      date: '2024-01-01',
      totalEmails: 3,
      unreadCount: 2,
      priorityEmails: 1,
      summary: 'Test daily briefing',
      categories: {
        meetings: 1,
        reports: 1,
        general: 1,
      },
      actionItems: ['Test action item'],
    }),
    draftReply: jest.fn().mockResolvedValue({
      subject: 'Re: Test Subject',
      content: 'Test reply content',
      tone: 'professional',
      confidence: 0.85,
    }),
    queryEmails: jest.fn().mockResolvedValue({
      query: 'test query',
      results: [mockEmails[0]],
      filters: {
        keywords: ['test'],
        dateRange: null,
        sender: null,
      },
      totalResults: 1,
    }),
  }
}

// Test data generators
export function generateMockEmail(overrides: Partial<typeof mockEmails[0]> = {}) {
  return {
    id: Math.random().toString(36).substr(2, 9),
    threadId: Math.random().toString(36).substr(2, 9),
    subject: 'Test Email Subject',
    sender: 'test@example.com',
    content: 'Test email content',
    date: new Date().toISOString(),
    isRead: false,
    hasAttachments: false,
    attachments: [],
    labels: ['INBOX'],
    ...overrides,
  }
}

export function generateMockEmails(count: number = 5) {
  return Array.from({ length: count }, (_, index) => 
    generateMockEmail({
      id: `test-email-${index}`,
      subject: `Test Email ${index + 1}`,
      sender: `sender${index + 1}@example.com`,
    })
  )
}

// Async test utilities
export function waitForNextTick() {
  return new Promise(resolve => process.nextTick(resolve))
}

export function waitForTimeout(ms: number = 0) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Mock network requests
export function mockNetworkSuccess(data: any) {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  })
}

export function mockNetworkError(status: number = 500, message: string = 'Network Error') {
  return jest.fn().mockRejectedValue(new Error(message))
}

// Test assertions helpers
export function expectToBeInDocument(element: HTMLElement | null) {
  expect(element).toBeInTheDocument()
}

export function expectToHaveText(element: HTMLElement | null, text: string) {
  expect(element).toHaveTextContent(text)
}

export function expectToHaveClass(element: HTMLElement | null, className: string) {
  expect(element).toHaveClass(className)
}

// Clean up function
export function cleanupTestEnvironment() {
  jest.clearAllMocks()
  jest.resetModules()
}