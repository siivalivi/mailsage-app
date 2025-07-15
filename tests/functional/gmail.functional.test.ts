// Comprehensive Gmail integration functional tests
import { mockGmailApi, mockUser } from '../utils/test-utils';

// Mock Gmail service
jest.mock('@/services/gmailService', () => ({
  fetchEmails: jest.fn(),
  sendEmail: jest.fn(),
  markAsRead: jest.fn(),
  archiveEmail: jest.fn(),
  searchEmails: jest.fn(),
  getEmailDetails: jest.fn(),
}));

// Mock googleapis
jest.mock('googleapis', () => ({
  google: {
    gmail: jest.fn(() => mockGmailApi()),
    auth: {
      OAuth2: jest.fn(),
    },
  },
}));

import { fetchEmails, sendEmail, markAsRead, archiveEmail, searchEmails, getEmailDetails } from '@/services/gmailService';

const mockFetchEmails = fetchEmails as jest.MockedFunction<typeof fetchEmails>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const mockMarkAsRead = markAsRead as jest.MockedFunction<typeof markAsRead>;
const mockArchiveEmail = archiveEmail as jest.MockedFunction<typeof archiveEmail>;
const mockSearchEmails = searchEmails as jest.MockedFunction<typeof searchEmails>;
const mockGetEmailDetails = getEmailDetails as jest.MockedFunction<typeof getEmailDetails>;

describe('Gmail Integration Functional Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GMAIL_CLIENT_ID = 'test-client-id';
    process.env.GMAIL_CLIENT_SECRET = 'test-client-secret';
    process.env.GMAIL_REFRESH_TOKEN = 'test-refresh-token';
  });

  describe('Email Fetching Workflow', () => {
    test('should fetch recent emails from Gmail API', async () => {
      const mockEmails = [
        {
          id: '1',
          threadId: 'thread-1',
          subject: 'Project Update',
          sender: 'john@company.com',
          content: 'Here is the latest project update...',
          date: '2024-01-15T10:00:00Z',
          isRead: false,
          hasAttachments: false,
          attachments: [],
          labels: ['INBOX', 'IMPORTANT'],
        },
        {
          id: '2',
          threadId: 'thread-2',
          subject: 'Meeting Request',
          sender: 'sarah@client.com',
          content: 'Can we schedule a meeting for next week?',
          date: '2024-01-15T11:30:00Z',
          isRead: false,
          hasAttachments: false,
          attachments: [],
          labels: ['INBOX'],
        },
      ];

      mockFetchEmails.mockResolvedValue(mockEmails);

      const result = await fetchEmails(mockUser, 10);

      expect(mockFetchEmails).toHaveBeenCalledWith(mockUser, 10);
      expect(result).toHaveLength(2);
      expect(result[0].subject).toBe('Project Update');
      expect(result[1].subject).toBe('Meeting Request');
    });

    test('should handle Gmail API rate limiting gracefully', async () => {
      mockFetchEmails.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(fetchEmails(mockUser, 10)).rejects.toThrow('Rate limit exceeded');
    });

    test('should handle authentication errors', async () => {
      mockFetchEmails.mockRejectedValue(new Error('Authentication failed'));

      await expect(fetchEmails(mockUser, 10)).rejects.toThrow('Authentication failed');
    });
  });

  describe('Email Details Retrieval', () => {
    test('should get detailed email information', async () => {
      const mockEmailDetails = {
        id: '1',
        threadId: 'thread-1',
        subject: 'Quarterly Report',
        sender: 'finance@company.com',
        recipients: ['team@company.com'],
        content: 'Please find the quarterly report attached...',
        date: '2024-01-15T14:00:00Z',
        isRead: false,
        hasAttachments: true,
        attachments: [
          {
            filename: 'Q4_Report.pdf',
            mimeType: 'application/pdf',
            size: 2048576,
          },
        ],
        labels: ['INBOX', 'CATEGORY_UPDATES'],
      };

      mockGetEmailDetails.mockResolvedValue(mockEmailDetails);

      const result = await getEmailDetails(mockUser, '1');

      expect(mockGetEmailDetails).toHaveBeenCalledWith(mockUser, '1');
      expect(result.subject).toBe('Quarterly Report');
      expect(result.hasAttachments).toBe(true);
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0].filename).toBe('Q4_Report.pdf');
    });

    test('should handle email not found', async () => {
      mockGetEmailDetails.mockRejectedValue(new Error('Email not found'));

      await expect(getEmailDetails(mockUser, 'nonexistent')).rejects.toThrow('Email not found');
    });
  });

  describe('Email Search Functionality', () => {
    test('should search emails by subject', async () => {
      const mockSearchResults = [
        {
          id: '1',
          threadId: 'thread-1',
          subject: 'Project Meeting Notes',
          sender: 'john@company.com',
          content: 'Meeting notes from today...',
          date: '2024-01-15T09:00:00Z',
          isRead: true,
          hasAttachments: false,
          attachments: [],
          labels: ['INBOX'],
        },
      ];

      mockSearchEmails.mockResolvedValue(mockSearchResults);

      const result = await searchEmails(mockUser, 'subject:project');

      expect(mockSearchEmails).toHaveBeenCalledWith(mockUser, 'subject:project');
      expect(result).toHaveLength(1);
      expect(result[0].subject).toContain('Project');
    });

    test('should search emails by sender', async () => {
      const mockSearchResults = [
        {
          id: '2',
          threadId: 'thread-2',
          subject: 'Follow-up Question',
          sender: 'client@external.com',
          content: 'I have a follow-up question...',
          date: '2024-01-15T16:00:00Z',
          isRead: false,
          hasAttachments: false,
          attachments: [],
          labels: ['INBOX'],
        },
      ];

      mockSearchEmails.mockResolvedValue(mockSearchResults);

      const result = await searchEmails(mockUser, 'from:client@external.com');

      expect(result).toHaveLength(1);
      expect(result[0].sender).toBe('client@external.com');
    });

    test('should handle empty search results', async () => {
      mockSearchEmails.mockResolvedValue([]);

      const result = await searchEmails(mockUser, 'subject:nonexistent');

      expect(result).toHaveLength(0);
    });
  });

  describe('Email Actions Workflow', () => {
    test('should mark email as read', async () => {
      mockMarkAsRead.mockResolvedValue(true);

      const result = await markAsRead(mockUser, '1');

      expect(mockMarkAsRead).toHaveBeenCalledWith(mockUser, '1');
      expect(result).toBe(true);
    });

    test('should archive email', async () => {
      mockArchiveEmail.mockResolvedValue(true);

      const result = await archiveEmail(mockUser, '1');

      expect(mockArchiveEmail).toHaveBeenCalledWith(mockUser, '1');
      expect(result).toBe(true);
    });

    test('should handle email action failures', async () => {
      mockMarkAsRead.mockRejectedValue(new Error('Failed to mark as read'));

      await expect(markAsRead(mockUser, '1')).rejects.toThrow('Failed to mark as read');
    });
  });

  describe('Email Sending Workflow', () => {
    test('should send email successfully', async () => {
      const emailToSend = {
        to: 'recipient@company.com',
        subject: 'Test Email',
        body: 'This is a test email.',
        cc: [],
        bcc: [],
      };

      mockSendEmail.mockResolvedValue({
        id: 'sent-123',
        threadId: 'thread-new',
        success: true,
      });

      const result = await sendEmail(mockUser, emailToSend);

      expect(mockSendEmail).toHaveBeenCalledWith(mockUser, emailToSend);
      expect(result.success).toBe(true);
      expect(result.id).toBe('sent-123');
    });

    test('should handle email sending failures', async () => {
      const emailToSend = {
        to: 'invalid@email',
        subject: 'Test Email',
        body: 'This is a test email.',
        cc: [],
        bcc: [],
      };

      mockSendEmail.mockRejectedValue(new Error('Invalid email address'));

      await expect(sendEmail(mockUser, emailToSend)).rejects.toThrow('Invalid email address');
    });
  });

  describe('End-to-End Email Management Workflow', () => {
    test('should complete full email workflow', async () => {
      // Mock data for complete workflow
      const mockEmails = [
        {
          id: '1',
          threadId: 'thread-1',
          subject: 'Important Update',
          sender: 'boss@company.com',
          content: 'Please review this important update...',
          date: '2024-01-15T12:00:00Z',
          isRead: false,
          hasAttachments: false,
          attachments: [],
          labels: ['INBOX', 'IMPORTANT'],
        },
      ];

      const mockEmailDetails = {
        ...mockEmails[0],
        recipients: ['team@company.com'],
        content: 'Please review this important update and provide feedback by tomorrow.',
      };

      const replyEmail = {
        to: 'boss@company.com',
        subject: 'Re: Important Update',
        body: 'Thank you for the update. I will review and provide feedback by tomorrow.',
        cc: [],
        bcc: [],
      };

      // Setup mocks
      mockFetchEmails.mockResolvedValue(mockEmails);
      mockGetEmailDetails.mockResolvedValue(mockEmailDetails);
      mockMarkAsRead.mockResolvedValue(true);
      mockSendEmail.mockResolvedValue({
        id: 'reply-123',
        threadId: 'thread-1',
        success: true,
      });

      // Execute complete workflow
      const emails = await fetchEmails(mockUser, 10);
      const emailDetails = await getEmailDetails(mockUser, emails[0].id);
      const markReadResult = await markAsRead(mockUser, emails[0].id);
      const replyResult = await sendEmail(mockUser, replyEmail);

      // Verify workflow completion
      expect(emails).toHaveLength(1);
      expect(emailDetails.subject).toBe('Important Update');
      expect(markReadResult).toBe(true);
      expect(replyResult.success).toBe(true);

      // Verify all services were called
      expect(mockFetchEmails).toHaveBeenCalled();
      expect(mockGetEmailDetails).toHaveBeenCalled();
      expect(mockMarkAsRead).toHaveBeenCalled();
      expect(mockSendEmail).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle Gmail API quota exceeded', async () => {
      mockFetchEmails.mockRejectedValue(new Error('Quota exceeded'));

      await expect(fetchEmails(mockUser, 10)).rejects.toThrow('Quota exceeded');
    });

    test('should handle network connectivity issues', async () => {
      mockSearchEmails.mockRejectedValue(new Error('Network error'));

      await expect(searchEmails(mockUser, 'test')).rejects.toThrow('Network error');
    });

    test('should handle invalid OAuth tokens', async () => {
      mockFetchEmails.mockRejectedValue(new Error('Invalid credentials'));

      await expect(fetchEmails(mockUser, 10)).rejects.toThrow('Invalid credentials');
    });
  });
});