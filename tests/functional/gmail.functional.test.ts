import { gmailService } from '../../src/services/gmailService'

// Mock Gmail API
jest.mock('googleapis', () => ({
  google: {
    gmail: jest.fn(() => ({
      users: {
        messages: {
          list: jest.fn(),
          get: jest.fn(),
        },
      },
    })),
    auth: {
      OAuth2: jest.fn(),
    },
  },
}))

describe('Gmail Service Functional Tests', () => {
  const mockAccessToken = 'mock-access-token'
  const mockRefreshToken = 'mock-refresh-token'
  
  const mockEmails = [
    {
      id: '1',
      threadId: 'thread-1',
      payload: {
        headers: [
          { name: 'From', value: 'sender@example.com' },
          { name: 'Subject', value: 'Test Email 1' },
          { name: 'Date', value: '2024-01-01T10:00:00Z' },
        ],
        body: {
          data: 'VGVzdCBlbWFpbCBjb250ZW50', // Base64 encoded "Test email content"
        },
      },
    },
    {
      id: '2',
      threadId: 'thread-2',
      payload: {
        headers: [
          { name: 'From', value: 'another@example.com' },
          { name: 'Subject', value: 'Test Email 2' },
          { name: 'Date', value: '2024-01-01T11:00:00Z' },
        ],
        body: {
          data: 'QW5vdGhlciB0ZXN0IGVtYWls', // Base64 encoded "Another test email"
        },
      },
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Set up environment variables for testing
    process.env.GMAIL_CLIENT_ID = 'test-client-id'
    process.env.GMAIL_CLIENT_SECRET = 'test-client-secret'
    process.env.GMAIL_REFRESH_TOKEN = 'test-refresh-token'
  })

  describe('Email Fetching', () => {
    test('should fetch emails successfully', async () => {
      const mockGmailApi = {
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

      // Mock the Gmail API instance
      const { google } = require('googleapis')
      google.gmail.mockReturnValue(mockGmailApi)

      const emails = await gmailService.fetchEmails({
        accessToken: mockAccessToken,
        maxResults: 10,
        query: 'is:unread',
      })

      expect(emails).toHaveLength(2)
      expect(emails[0].subject).toBe('Test Email 1')
      expect(emails[1].subject).toBe('Test Email 2')
    })

    test('should handle empty inbox', async () => {
      const mockGmailApi = {
        users: {
          messages: {
            list: jest.fn().mockResolvedValue({
              data: {
                messages: [],
              },
            }),
          },
        },
      }

      const { google } = require('googleapis')
      google.gmail.mockReturnValue(mockGmailApi)

      const emails = await gmailService.fetchEmails({
        accessToken: mockAccessToken,
        maxResults: 10,
        query: 'is:unread',
      })

      expect(emails).toHaveLength(0)
    })

    test('should handle API errors gracefully', async () => {
      const mockGmailApi = {
        users: {
          messages: {
            list: jest.fn().mockRejectedValue(new Error('API Error')),
          },
        },
      }

      const { google } = require('googleapis')
      google.gmail.mockReturnValue(mockGmailApi)

      await expect(gmailService.fetchEmails({
        accessToken: mockAccessToken,
        maxResults: 10,
        query: 'is:unread',
      })).rejects.toThrow('API Error')
    })
  })

  describe('Email Filtering and Querying', () => {
    test('should filter emails by sender', async () => {
      const mockGmailApi = {
        users: {
          messages: {
            list: jest.fn().mockResolvedValue({
              data: {
                messages: [{ id: '1' }],
              },
            }),
            get: jest.fn().mockResolvedValue({
              data: mockEmails[0],
            }),
          },
        },
      }

      const { google } = require('googleapis')
      google.gmail.mockReturnValue(mockGmailApi)

      const emails = await gmailService.fetchEmails({
        accessToken: mockAccessToken,
        maxResults: 10,
        query: 'from:sender@example.com',
      })

      expect(mockGmailApi.users.messages.list).toHaveBeenCalledWith({
        userId: 'me',
        maxResults: 10,
        q: 'from:sender@example.com',
      })
    })

    test('should filter emails by date range', async () => {
      const mockGmailApi = {
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

      const { google } = require('googleapis')
      google.gmail.mockReturnValue(mockGmailApi)

      const emails = await gmailService.fetchEmails({
        accessToken: mockAccessToken,
        maxResults: 10,
        query: 'after:2024/01/01 before:2024/01/02',
      })

      expect(mockGmailApi.users.messages.list).toHaveBeenCalledWith({
        userId: 'me',
        maxResults: 10,
        q: 'after:2024/01/01 before:2024/01/02',
      })
    })

    test('should filter emails by subject', async () => {
      const mockGmailApi = {
        users: {
          messages: {
            list: jest.fn().mockResolvedValue({
              data: {
                messages: [{ id: '1' }],
              },
            }),
            get: jest.fn().mockResolvedValue({
              data: mockEmails[0],
            }),
          },
        },
      }

      const { google } = require('googleapis')
      google.gmail.mockReturnValue(mockGmailApi)

      const emails = await gmailService.fetchEmails({
        accessToken: mockAccessToken,
        maxResults: 10,
        query: 'subject:"Test Email"',
      })

      expect(mockGmailApi.users.messages.list).toHaveBeenCalledWith({
        userId: 'me',
        maxResults: 10,
        q: 'subject:"Test Email"',
      })
    })
  })

  describe('Email Content Processing', () => {
    test('should decode email content correctly', async () => {
      const mockGmailApi = {
        users: {
          messages: {
            list: jest.fn().mockResolvedValue({
              data: {
                messages: [{ id: '1' }],
              },
            }),
            get: jest.fn().mockResolvedValue({
              data: mockEmails[0],
            }),
          },
        },
      }

      const { google } = require('googleapis')
      google.gmail.mockReturnValue(mockGmailApi)

      const emails = await gmailService.fetchEmails({
        accessToken: mockAccessToken,
        maxResults: 1,
        query: 'is:unread',
      })

      expect(emails[0].content).toBe('Test email content')
    })

    test('should handle emails with attachments', async () => {
      const emailWithAttachment = {
        ...mockEmails[0],
        payload: {
          ...mockEmails[0].payload,
          parts: [
            {
              mimeType: 'text/plain',
              body: {
                data: 'VGVzdCBlbWFpbCBjb250ZW50',
              },
            },
            {
              mimeType: 'application/pdf',
              filename: 'document.pdf',
              body: {
                attachmentId: 'attachment-123',
              },
            },
          ],
        },
      }

      const mockGmailApi = {
        users: {
          messages: {
            list: jest.fn().mockResolvedValue({
              data: {
                messages: [{ id: '1' }],
              },
            }),
            get: jest.fn().mockResolvedValue({
              data: emailWithAttachment,
            }),
          },
        },
      }

      const { google } = require('googleapis')
      google.gmail.mockReturnValue(mockGmailApi)

      const emails = await gmailService.fetchEmails({
        accessToken: mockAccessToken,
        maxResults: 1,
        query: 'has:attachment',
      })

      expect(emails[0].hasAttachments).toBe(true)
      expect(emails[0].attachments).toHaveLength(1)
      expect(emails[0].attachments[0].filename).toBe('document.pdf')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle rate limiting', async () => {
      const mockGmailApi = {
        users: {
          messages: {
            list: jest.fn().mockRejectedValue({
              code: 429,
              message: 'Rate limit exceeded',
            }),
          },
        },
      }

      const { google } = require('googleapis')
      google.gmail.mockReturnValue(mockGmailApi)

      await expect(gmailService.fetchEmails({
        accessToken: mockAccessToken,
        maxResults: 10,
        query: 'is:unread',
      })).rejects.toMatchObject({
        code: 429,
        message: 'Rate limit exceeded',
      })
    })

    test('should handle invalid access token', async () => {
      const mockGmailApi = {
        users: {
          messages: {
            list: jest.fn().mockRejectedValue({
              code: 401,
              message: 'Invalid credentials',
            }),
          },
        },
      }

      const { google } = require('googleapis')
      google.gmail.mockReturnValue(mockGmailApi)

      await expect(gmailService.fetchEmails({
        accessToken: 'invalid-token',
        maxResults: 10,
        query: 'is:unread',
      })).rejects.toMatchObject({
        code: 401,
        message: 'Invalid credentials',
      })
    })

    test('should handle malformed email data', async () => {
      const malformedEmail = {
        id: '1',
        threadId: 'thread-1',
        payload: {
          headers: [], // Missing required headers
          body: {
            data: 'invalid-base64!@#$%',
          },
        },
      }

      const mockGmailApi = {
        users: {
          messages: {
            list: jest.fn().mockResolvedValue({
              data: {
                messages: [{ id: '1' }],
              },
            }),
            get: jest.fn().mockResolvedValue({
              data: malformedEmail,
            }),
          },
        },
      }

      const { google } = require('googleapis')
      google.gmail.mockReturnValue(mockGmailApi)

      const emails = await gmailService.fetchEmails({
        accessToken: mockAccessToken,
        maxResults: 1,
        query: 'is:unread',
      })

      expect(emails[0].subject).toBe('(No Subject)')
      expect(emails[0].sender).toBe('(Unknown Sender)')
    })
  })
})