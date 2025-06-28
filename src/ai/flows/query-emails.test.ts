
import { queryEmails } from './query-emails';
import { ai } from '@/ai/genkit';
import { fetchGmailMessages } from '@/services/gmailService';
import type { FetchedEmailData } from '@/services/gmailService';

// Mock dependencies to isolate the flow from external services
jest.mock('@/ai/genkit', () => ({
  ai: {
    generate: jest.fn(),
    // Mock defineFlow to return the flow's inner function, allowing us to test its logic directly.
    defineFlow: jest.fn((config, flowFunc) => flowFunc),
  },
}));

jest.mock('@/services/gmailService', () => ({
  fetchGmailMessages: jest.fn(),
}));

// Create typed mock functions for easier use and type safety
const mockedAIGenerate = ai.generate as jest.Mock;
const mockedFetchGmailMessages = fetchGmailMessages as jest.Mock;

describe('queryEmails Flow', () => {
  const mockInput = {
    query: 'test query',
    accessToken: 'test-token',
  };

  beforeEach(() => {
    // Clear all mock history and implementations before each test
    jest.clearAllMocks();
  });

  it('should successfully execute the full flow with valid inputs', async () => {
    // Arrange: Set up mock responses for each step of the flow
    const mockGmailQuery = 'from:example@test.com';
    const mockFetchedEmails: FetchedEmailData[] = [
      { id: '123', sender: 'test@example.com', subject: 'Test', snippet: 'Snippet 1', timestamp: Date.now() },
      { id: '456', sender: 'another@example.com', subject: 'Another Test', snippet: 'Snippet 2', timestamp: Date.now() },
    ];
    const mockRefinedEmails = [
      { isRelevant: true, id: '123', sender: 'test@example.com', subject: 'Test', snippet: 'Snippet 1', timestamp: Date.now(), summary: 'Relevant summary' },
      { isRelevant: false, id: '456', sender: 'another@example.com', subject: 'Another Test', snippet: 'Snippet 2', timestamp: Date.now(), summary: 'Not relevant' },
    ];

    // First AI call (transform query)
    mockedAIGenerate.mockResolvedValueOnce({
      output: { gmailQueryString: mockGmailQuery },
    });
    // Gmail service call
    mockedFetchGmailMessages.mockResolvedValue(mockFetchedEmails);
    // Second AI call (refine emails)
    mockedAIGenerate.mockResolvedValueOnce({
      output: { refinedEmails: mockRefinedEmails },
    });

    // Act: Run the flow
    const result = await queryEmails(mockInput);

    // Assert: Verify that each step was called correctly and the output is as expected
    expect(mockedAIGenerate).toHaveBeenCalledTimes(2);
    expect(mockedFetchGmailMessages).toHaveBeenCalledWith(mockInput.accessToken, mockGmailQuery, 20);
    expect(result.emailList.length).toBe(1);
    expect(result.emailList[0].id).toBe('123');
    expect(result.emailList[0].summary).toBe('Relevant summary');
  });

  it('should return an empty list if no emails are fetched from Gmail', async () => {
    // Arrange
    mockedAIGenerate.mockResolvedValueOnce({
      output: { gmailQueryString: 'any-query' },
    });
    mockedFetchGmailMessages.mockResolvedValue([]); // Simulate Gmail returning no messages

    // Act
    const result = await queryEmails(mockInput);

    // Assert
    expect(mockedFetchGmailMessages).toHaveBeenCalledTimes(1);
    // The second AI call should NOT be made if there are no emails to process
    expect(mockedAIGenerate).toHaveBeenCalledTimes(1); 
    expect(result.emailList).toEqual([]);
  });

  it('should return a user-friendly error object if the AI fails to transform the query', async () => {
    // Arrange
    mockedAIGenerate.mockResolvedValueOnce({ output: null }); // Simulate AI failure

    // Act
    const result = await queryEmails(mockInput);

    // Assert
    expect(result.emailList.length).toBe(1);
    expect(result.emailList[0].id).toBe('error-critical-flow-error');
    expect(result.emailList[0].subject).toContain('Error');
    // Ensure no subsequent calls were made
    expect(mockedFetchGmailMessages).not.toHaveBeenCalled();
  });

  it('should return a user-friendly error object if the AI fails to refine the emails', async () => {
     // Arrange
    mockedAIGenerate.mockResolvedValueOnce({ // First call is successful
      output: { gmailQueryString: 'any-query' },
    });
    mockedFetchGmailMessages.mockResolvedValue([
        { id: '123', sender: 'test@example.com', subject: 'Test', snippet: 'Snippet 1', timestamp: Date.now() }
    ]);
    mockedAIGenerate.mockResolvedValueOnce({ output: null }); // Second call fails

    // Act
    const result = await queryEmails(mockInput);

    // Assert
    expect(result.emailList.length).toBe(1);
    expect(result.emailList[0].id).toBe('error-critical-flow-error');
    expect(result.emailList[0].summary).toContain('critical error');
  });
});
