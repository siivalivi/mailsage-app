import { generateDailyBriefing } from '../../src/ai/flows/generate-daily-briefing'
import { summarizeEmail } from '../../src/ai/flows/summarize-email'
import { extractActionItems } from '../../src/ai/flows/extract-action-items'
import { draftReply } from '../../src/ai/flows/draft-reply'
import { queryEmails } from '../../src/ai/flows/query-emails'

// Mock Genkit
jest.mock('genkit', () => ({
  genkit: jest.fn(),
  configureGenkit: jest.fn(),
}))

// Mock Google AI
jest.mock('@genkit-ai/googleai', () => ({
  googleAI: jest.fn(),
}))

describe('AI Flows Functional Tests', () => {
  const mockEmails = [
    {
      id: '1',
      subject: 'Project Update Meeting',
      sender: 'manager@company.com',
      content: 'Hi team, we need to schedule a meeting to discuss the project updates. Please let me know your availability for next week.',
      date: '2024-01-01T10:00:00Z',
      isRead: false,
    },
    {
      id: '2',
      subject: 'Budget Report Due',
      sender: 'finance@company.com',
      content: 'The quarterly budget report is due by end of this week. Please submit your department expenses.',
      date: '2024-01-01T11:00:00Z',
      isRead: false,
    },
    {
      id: '3',
      subject: 'Client Meeting Confirmation',
      sender: 'client@external.com',
      content: 'Thank you for scheduling the meeting. I confirm our appointment for Thursday at 2 PM.',
      date: '2024-01-01T12:00:00Z',
      isRead: true,
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Set up environment variables for testing
    process.env.GOOGLE_AI_API_KEY = 'test-api-key'
  })

  describe('Email Summarization', () => {
    test('should generate concise email summary', async () => {
      const mockSummary = 'Manager requesting team meeting to discuss project updates, asking for availability next week.'
      
      // Mock the AI response
      const mockAIResponse = {
        text: () => mockSummary,
      }

      // Mock genkit flow
      const mockFlow = jest.fn().mockResolvedValue(mockAIResponse)
      const { genkit } = require('genkit')
      genkit.mockReturnValue(mockFlow)

      const result = await summarizeEmail({
        subject: mockEmails[0].subject,
        content: mockEmails[0].content,
        sender: mockEmails[0].sender,
      })

      expect(result.summary).toBe(mockSummary)
      expect(result.keyPoints).toBeInstanceOf(Array)
      expect(result.priority).toMatch(/high|medium|low/)
    })

    test('should handle empty email content', async () => {
      const mockFlow = jest.fn().mockResolvedValue({
        text: () => 'Unable to summarize empty email content.',
      })
      const { genkit } = require('genkit')
      genkit.mockReturnValue(mockFlow)

      const result = await summarizeEmail({
        subject: 'Empty Email',
        content: '',
        sender: 'test@example.com',
      })

      expect(result.summary).toContain('Unable to summarize')
    })

    test('should identify email priority correctly', async () => {
      const urgentEmail = {
        subject: 'URGENT: Server Down',
        content: 'Our main server is down. Need immediate attention.',
        sender: 'admin@company.com',
      }

      const mockFlow = jest.fn().mockResolvedValue({
        text: () => 'Server outage requiring immediate attention.',
      })
      const { genkit } = require('genkit')
      genkit.mockReturnValue(mockFlow)

      const result = await summarizeEmail(urgentEmail)

      expect(result.priority).toBe('high')
    })
  })

  describe('Action Items Extraction', () => {
    test('should extract action items from email content', async () => {
      const mockActionItems = [
        {
          task: 'Schedule project update meeting',
          assignee: 'team',
          dueDate: 'next week',
          priority: 'medium',
        },
        {
          task: 'Provide availability',
          assignee: 'all team members',
          dueDate: 'ASAP',
          priority: 'high',
        },
      ]

      const mockFlow = jest.fn().mockResolvedValue({
        text: () => JSON.stringify(mockActionItems),
      })
      const { genkit } = require('genkit')
      genkit.mockReturnValue(mockFlow)

      const result = await extractActionItems({
        subject: mockEmails[0].subject,
        content: mockEmails[0].content,
        sender: mockEmails[0].sender,
      })

      expect(result.actionItems).toHaveLength(2)
      expect(result.actionItems[0].task).toBe('Schedule project update meeting')
      expect(result.actionItems[1].priority).toBe('high')
    })

    test('should handle emails with no action items', async () => {
      const infoEmail = {
        subject: 'FYI: Office Closure',
        content: 'Just wanted to inform you that the office will be closed on Monday for maintenance.',
        sender: 'facilities@company.com',
      }

      const mockFlow = jest.fn().mockResolvedValue({
        text: () => JSON.stringify([]),
      })
      const { genkit } = require('genkit')
      genkit.mockReturnValue(mockFlow)

      const result = await extractActionItems(infoEmail)

      expect(result.actionItems).toHaveLength(0)
    })
  })

  describe('Daily Briefing Generation', () => {
    test('should generate comprehensive daily briefing', async () => {
      const mockBriefing = {
        date: '2024-01-01',
        totalEmails: 3,
        unreadCount: 2,
        priorityEmails: 1,
        summary: 'You have 3 emails today, 2 unread. Key items include project meeting scheduling and budget report deadline.',
        categories: {
          meetings: 2,
          reports: 1,
          general: 0,
        },
        actionItems: [
          'Schedule project update meeting',
          'Submit budget report by end of week',
        ],
      }

      const mockFlow = jest.fn().mockResolvedValue({
        text: () => JSON.stringify(mockBriefing),
      })
      const { genkit } = require('genkit')
      genkit.mockReturnValue(mockFlow)

      const result = await generateDailyBriefing(mockEmails)

      expect(result.totalEmails).toBe(3)
      expect(result.unreadCount).toBe(2)
      expect(result.actionItems).toHaveLength(2)
      expect(result.categories).toHaveProperty('meetings')
    })

    test('should handle empty inbox', async () => {
      const mockFlow = jest.fn().mockResolvedValue({
        text: () => JSON.stringify({
          date: '2024-01-01',
          totalEmails: 0,
          unreadCount: 0,
          priorityEmails: 0,
          summary: 'No emails to process today.',
          categories: {},
          actionItems: [],
        }),
      })
      const { genkit } = require('genkit')
      genkit.mockReturnValue(mockFlow)

      const result = await generateDailyBriefing([])

      expect(result.totalEmails).toBe(0)
      expect(result.summary).toContain('No emails')
    })
  })

  describe('Reply Drafting', () => {
    test('should generate appropriate reply', async () => {
      const originalEmail = {
        subject: 'Project Update Meeting',
        content: 'Hi team, we need to schedule a meeting to discuss the project updates. Please let me know your availability for next week.',
        sender: 'manager@company.com',
      }

      const mockReply = {
        subject: 'Re: Project Update Meeting',
        content: 'Hi,\n\nThank you for reaching out. I am available for the meeting on Tuesday or Wednesday next week, preferably in the afternoon.\n\nBest regards',
        tone: 'professional',
        confidence: 0.85,
      }

      const mockFlow = jest.fn().mockResolvedValue({
        text: () => JSON.stringify(mockReply),
      })
      const { genkit } = require('genkit')
      genkit.mockReturnValue(mockFlow)

      const result = await draftReply({
        originalEmail,
        replyType: 'response',
        tone: 'professional',
        context: 'team meeting scheduling',
      })

      expect(result.subject).toBe('Re: Project Update Meeting')
      expect(result.content).toContain('available')
      expect(result.tone).toBe('professional')
      expect(result.confidence).toBeGreaterThan(0.8)
    })

    test('should handle different reply types', async () => {
      const originalEmail = mockEmails[2]

      const mockReply = {
        subject: 'Re: Client Meeting Confirmation',
        content: 'Thank you for confirming. I look forward to our meeting on Thursday at 2 PM.',
        tone: 'professional',
        confidence: 0.9,
      }

      const mockFlow = jest.fn().mockResolvedValue({
        text: () => JSON.stringify(mockReply),
      })
      const { genkit } = require('genkit')
      genkit.mockReturnValue(mockFlow)

      const result = await draftReply({
        originalEmail,
        replyType: 'acknowledgment',
        tone: 'professional',
        context: 'meeting confirmation',
      })

      expect(result.subject).toContain('Re:')
      expect(result.content).toContain('Thank you')
    })
  })

  describe('Email Querying', () => {
    test('should query emails by natural language', async () => {
      const query = 'Show me all emails about meetings from last week'
      
      const mockQueryResult = {
        query: query,
        results: [mockEmails[0], mockEmails[2]],
        filters: {
          keywords: ['meeting', 'meetings'],
          dateRange: 'last week',
          sender: null,
        },
        totalResults: 2,
      }

      const mockFlow = jest.fn().mockResolvedValue({
        text: () => JSON.stringify(mockQueryResult),
      })
      const { genkit } = require('genkit')
      genkit.mockReturnValue(mockFlow)

      const result = await queryEmails({
        query,
        emails: mockEmails,
        maxResults: 10,
      })

      expect(result.results).toHaveLength(2)
      expect(result.totalResults).toBe(2)
      expect(result.filters.keywords).toContain('meeting')
    })

    test('should handle complex queries', async () => {
      const query = 'Find urgent emails from external clients this month'
      
      const mockQueryResult = {
        query: query,
        results: [mockEmails[2]],
        filters: {
          keywords: ['urgent'],
          dateRange: 'this month',
          sender: 'external',
          priority: 'high',
        },
        totalResults: 1,
      }

      const mockFlow = jest.fn().mockResolvedValue({
        text: () => JSON.stringify(mockQueryResult),
      })
      const { genkit } = require('genkit')
      genkit.mockReturnValue(mockFlow)

      const result = await queryEmails({
        query,
        emails: mockEmails,
        maxResults: 10,
      })

      expect(result.results).toHaveLength(1)
      expect(result.filters.sender).toBe('external')
      expect(result.filters.priority).toBe('high')
    })

    test('should handle queries with no results', async () => {
      const query = 'Find emails about vacation'
      
      const mockQueryResult = {
        query: query,
        results: [],
        filters: {
          keywords: ['vacation'],
          dateRange: null,
          sender: null,
        },
        totalResults: 0,
      }

      const mockFlow = jest.fn().mockResolvedValue({
        text: () => JSON.stringify(mockQueryResult),
      })
      const { genkit } = require('genkit')
      genkit.mockReturnValue(mockFlow)

      const result = await queryEmails({
        query,
        emails: mockEmails,
        maxResults: 10,
      })

      expect(result.results).toHaveLength(0)
      expect(result.totalResults).toBe(0)
    })
  })

  describe('Error Handling', () => {
    test('should handle AI API errors gracefully', async () => {
      const mockFlow = jest.fn().mockRejectedValue(new Error('AI API Error'))
      const { genkit } = require('genkit')
      genkit.mockReturnValue(mockFlow)

      await expect(summarizeEmail({
        subject: 'Test',
        content: 'Test content',
        sender: 'test@example.com',
      })).rejects.toThrow('AI API Error')
    })

    test('should handle rate limiting', async () => {
      const mockFlow = jest.fn().mockRejectedValue(new Error('Rate limit exceeded'))
      const { genkit } = require('genkit')
      genkit.mockReturnValue(mockFlow)

      await expect(generateDailyBriefing(mockEmails)).rejects.toThrow('Rate limit exceeded')
    })

    test('should handle malformed AI responses', async () => {
      const mockFlow = jest.fn().mockResolvedValue({
        text: () => 'Invalid JSON response',
      })
      const { genkit } = require('genkit')
      genkit.mockReturnValue(mockFlow)

      await expect(extractActionItems({
        subject: 'Test',
        content: 'Test content',
        sender: 'test@example.com',
      })).rejects.toThrow()
    })
  })
})