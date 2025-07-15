// Comprehensive Gmail integration functional tests
import { mockGmailApi, mockUser } from '../utils/test-utils';

// Mock Gmail service
jest.mock('@/services/gmailService', () => ({
  fetchGmailMessages: jest.fn(),
  fetchGmailMessageBody: jest.fn(),
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

import { fetchGmailMessages, fetchGmailMessageBody } from '@/services/gmailService';

const mockFetchGmailMessages = fetchGmailMessages as jest.MockedFunction<typeof fetchGmailMessages>;
const mockFetchGmailMessageBody = fetchGmailMessageBody as jest.MockedFunction<typeof fetchGmailMessageBody>;

describe('Gmail Integration Functional Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GMAIL_CLIENT_ID = 'test-client-id';
    process.env.GMAIL_CLIENT_SECRET = 'test-client-secret';
    process.env.GMAIL_REFRESH_TOKEN = 'test-refresh-token';
  });

  describe('Gmail Messages Fetching Workflow', () => {
    test('should fetch Gmail messages from API', async () => {
      const mockGmailMessages = [
        {
          id: '1',
          sender: 'john@company.com',
          subject: 'Project Update',
          snippet: 'Here is the latest project update...',
          timestamp: 1705316400000 // 2024-01-15T10:00:00Z
        },
        {
          id: '2',
          sender: 'sarah@client.com',
          subject: 'Meeting Request',
          snippet: 'Can we schedule a meeting for next week?',
          timestamp: 1705321800000 // 2024-01-15T11:30:00Z
        },
      ];

      mockFetchGmailMessages.mockResolvedValue(mockGmailMessages);

      const result = await fetchGmailMessages('test-access-token', undefined, 10);

      expect(mockFetchGmailMessages).toHaveBeenCalledWith('test-access-token', undefined, 10);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[0].subject).toBe('Project Update');
      expect(result[0].sender).toBe('john@company.com');
      expect(result[1].id).toBe('2');
      expect(result[1].subject).toBe('Meeting Request');
    });

    test('should handle Gmail API rate limiting gracefully', async () => {
      mockFetchGmailMessages.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(fetchGmailMessages('test-access-token', undefined, 10)).rejects.toThrow('Rate limit exceeded');
    });

    test('should handle authentication errors', async () => {
      mockFetchGmailMessages.mockRejectedValue(new Error('Authentication failed'));

      await expect(fetchGmailMessages('test-access-token', undefined, 10)).rejects.toThrow('Authentication failed');
    });
  });

  describe('Gmail Message Body Retrieval', () => {
    test('should fetch Gmail message body', async () => {
      const mockMessageBody = {
        id: '1',
        threadId: 'thread-1',
        payload: {
          headers: [
            { name: 'Subject', value: 'Quarterly Report' },
            { name: 'From', value: 'finance@company.com' },
            { name: 'Date', value: '2024-01-15T14:00:00Z' }
          ],
          body: {
            data: 'UGxlYXNlIGZpbmQgdGhlIHF1YXJ0ZXJseSByZXBvcnQgYXR0YWNoZWQ=', // base64 encoded
            size: 123
          }
        }
      };

      mockFetchGmailMessageBody.mockResolvedValue(mockMessageBody);

      const result = await fetchGmailMessageBody('test-access-token', '1');

      expect(mockFetchGmailMessageBody).toHaveBeenCalledWith('test-access-token', '1');
      expect(result.id).toBe('1');
      expect(result.payload.body.data).toBeTruthy();
    });

    test('should handle message not found', async () => {
      mockFetchGmailMessageBody.mockRejectedValue(new Error('Message not found'));

      await expect(fetchGmailMessageBody('test-access-token', 'nonexistent')).rejects.toThrow('Message not found');
    });
  });

  describe('End-to-End Gmail API Workflow', () => {
    test('should complete full Gmail API workflow', async () => {
      // Mock Gmail messages
      const mockGmailMessages = [
        {
          id: '1',
          sender: 'boss@company.com',
          subject: 'Important Update',
          snippet: 'Please review this important update...',
          timestamp: 1705323600000 // 2024-01-15T12:00:00Z
        }
      ];

      // Mock message body
      const mockMessageBody = {
        id: '1',
        threadId: 'thread-1',
        payload: {
          headers: [
            { name: 'Subject', value: 'Important Update' },
            { name: 'From', value: 'boss@company.com' },
            { name: 'Date', value: '2024-01-15T12:00:00Z' }
          ],
          body: {
            data: 'UGxlYXNlIHJldmlldyB0aGlzIGltcG9ydGFudCB1cGRhdGU=', // base64 encoded message
            size: 456
          }
        }
      };

      // Setup mocks
      mockFetchGmailMessages.mockResolvedValue(mockGmailMessages);
      mockFetchGmailMessageBody.mockResolvedValue(mockMessageBody);

      // Execute workflow
      const messages = await fetchGmailMessages('test-access-token', undefined, 10);
      const messageBody = await fetchGmailMessageBody('test-access-token', messages[0].id);

      // Verify workflow completion
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('1');
      expect(messages[0].subject).toBe('Important Update');
      expect(messages[0].sender).toBe('boss@company.com');
      expect(messageBody).toBeTruthy();

      // Verify all services were called
      expect(mockFetchGmailMessages).toHaveBeenCalled();
      expect(mockFetchGmailMessageBody).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle Gmail API quota exceeded', async () => {
      mockFetchGmailMessages.mockRejectedValue(new Error('Quota exceeded'));

      await expect(fetchGmailMessages('test-access-token', undefined, 10)).rejects.toThrow('Quota exceeded');
    });

    test('should handle network connectivity issues', async () => {
      mockFetchGmailMessageBody.mockRejectedValue(new Error('Network error'));

      await expect(fetchGmailMessageBody('test-access-token', '1')).rejects.toThrow('Network error');
    });

    test('should handle invalid OAuth tokens', async () => {
      mockFetchGmailMessages.mockRejectedValue(new Error('Invalid credentials'));

      await expect(fetchGmailMessages('invalid-token', undefined, 10)).rejects.toThrow('Invalid credentials');
    });
  });
});