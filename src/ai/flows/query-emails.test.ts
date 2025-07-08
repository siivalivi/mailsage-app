import { queryEmails } from './query-emails';
import { ai } from '@/ai/genkit';
import { fetchGmailMessages } from '@/services/gmailService';
import type { FetchedEmailData } from '@/services/gmailService';

// Mock dependencies to isolate the flow from external services
jest.mock('@/ai/genkit', () => ({
  ai: {
    generate: jest.fn(),
    // Mock defineFlow to return the flow's inner function.
    defineFlow: jest.fn((config, flowFunc) => flowFunc),
    // Mock definePrompt to return a dummy invokable function.
    definePrompt: jest.fn().mockImplementation(() => jest.fn()),
    // Mock defineTool to return a dummy invokable function.
    defineTool: jest.fn().mockImplementation(() => jest.fn()),
  },
}));

jest.mock('@/services/gmailService', () => ({
  fetchGmailMessages: jest.fn(),
}));

const mockedAIGenerate = ai.generate as jest.Mock;
const mockedFetchGmailMessages = fetchGmailMessages as jest.Mock;

describe('queryEmails Flow (Agentic)', () => {
  const mockInput = {
    query: 'invoice from last month',
    accessToken: 'test-token',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully execute the full agentic flow', async () => {
    // Arrange: Set up mock responses for each step of the flow
    const mockGmailQuery = '(invoice OR receipt) after:2024/04/01 before:2024/05/01';
    const mockFetchedEmails: FetchedEmailData[] = [
      { id: '123', sender: 'test@example.com', subject: 'Test Invoice', snippet: 'Snippet 1', timestamp: Date.now() },
    ];
    const mockRefinedEmails = [
      { isRelevant: true, id: '123', sender: 'test@example.com', subject: 'Test Invoice', snippet: 'Snippet 1', timestamp: Date.now(), summary: 'Relevant summary about the invoice' },
    ];

    // Step 1: Mock the main agent's `ai.generate` call. This call uses tools to produce the query string.
    mockedAIGenerate.mockResolvedValueOnce({
      output: { gmailQueryString: mockGmailQuery },
    });

    // Step 2: Gmail service call
    mockedFetchGmailMessages.mockResolvedValue(mockFetchedEmails);

    // Step 3: AI call for refining emails
    mockedAIGenerate.mockResolvedValueOnce({
      output: { refinedEmails: mockRefinedEmails },
    });

    // Act: Run the flow
    const result = await queryEmails(mockInput);

    // Assert
    // 1. The agent `generate` call was made first.
    expect(mockedAIGenerate).toHaveBeenCalledTimes(2); // Agent call + Refinement call
    expect(mockedAIGenerate).toHaveBeenNthCalledWith(1, expect.objectContaining({
        prompt: expect.stringContaining('You are an expert email search agent.'),
        tools: expect.any(Array), // Verify that tools were passed to the agent
    }));

    // 2. Gmail fetch was called with the result of the agentic step
    expect(mockedFetchGmailMessages).toHaveBeenCalledWith(mockInput.accessToken, mockGmailQuery, 20);

    // 3. Final refinement was called last.
    expect(mockedAIGenerate).toHaveBeenNthCalledWith(2, expect.objectContaining({
        prompt: expect.stringContaining('You are an intelligent email processing agent'),
    }));
    
    expect(result.emailList.length).toBe(1);
    expect(result.emailList[0].id).toBe('123');
    expect(result.emailList[0].summary).toBe('Relevant summary about the invoice');
  });

  it('should return an empty list if no emails are fetched from Gmail', async () => {
    // Arrange
    mockedAIGenerate.mockResolvedValueOnce({ output: { gmailQueryString: 'any-query' } });
    mockedFetchGmailMessages.mockResolvedValue([]); // Gmail returns no messages

    // Act
    const result = await queryEmails(mockInput);

    // Assert
    expect(mockedFetchGmailMessages).toHaveBeenCalledTimes(1);
    // The refinement AI call should NOT be made if there are no emails to process
    expect(mockedAIGenerate).toHaveBeenCalledTimes(1); // Only the agent call
    expect(result.emailList).toEqual([]);
  });

  it('should throw an error if the agent fails to generate a query', async () => {
    // Arrange
    mockedAIGenerate.mockResolvedValueOnce({ output: null }); // Simulate agent failure

    // Act & Assert
    await expect(queryEmails(mockInput)).rejects.toThrow(
      'Agent failed to generate a query string using tools.'
    );
    expect(mockedAIGenerate).toHaveBeenCalledTimes(1);
    expect(mockedFetchGmailMessages).not.toHaveBeenCalled();
  });
});
