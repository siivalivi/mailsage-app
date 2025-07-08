
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
    // Mock definePrompt to return a mock invokable function.
    definePrompt: jest.fn().mockImplementation(() => {
        return jest.fn();
    }),
  },
}));

jest.mock('@/services/gmailService', () => ({
  fetchGmailMessages: jest.fn(),
}));

// Create typed mock functions for easier use and type safety
const mockedAIGenerate = ai.generate as jest.Mock;
const mockedFetchGmailMessages = fetchGmailMessages as jest.Mock;
// Because definePrompt is now mocked to return a function, we can mock its implementation for tests
const mockedDefinePrompt = ai.definePrompt as jest.Mock;


describe('queryEmails Flow', () => {
  const mockInput = {
    query: 'invoice from last month',
    accessToken: 'test-token',
  };

  beforeEach(() => {
    // Clear all mock history and implementations before each test
    jest.clearAllMocks();
  });

  it('should successfully execute the full flow with query categorization', async () => {
    // Arrange: Set up mock responses for each step of the flow
    const mockGmailQuery = '(invoice OR receipt) after:2024/04/01 before:2024/05/01';
    const mockFetchedEmails: FetchedEmailData[] = [
      { id: '123', sender: 'test@example.com', subject: 'Test Invoice', snippet: 'Snippet 1', timestamp: Date.now() },
    ];
    const mockRefinedEmails = [
      { isRelevant: true, id: '123', sender: 'test@example.com', subject: 'Test Invoice', snippet: 'Snippet 1', timestamp: Date.now(), summary: 'Relevant summary about the invoice' },
    ];

    // Mock the specialized prompt itself
    const mockBillingTransformPrompt = jest.fn().mockResolvedValue({
      output: { gmailQueryString: mockGmailQuery },
    });
    // Have definePrompt return our mocked prompt when called with specific names
    mockedDefinePrompt.mockImplementation(({ name }) => {
        if (name === 'billingTransformPrompt') {
            return mockBillingTransformPrompt;
        }
        // Return a generic mock function for other prompts
        return jest.fn().mockResolvedValue({ output: { gmailQueryString: 'general query' }});
    });

    // Step 1: AI call for categorization
    mockedAIGenerate.mockResolvedValueOnce({
      output: { category: 'billing' },
    });
    
    // Step 2: The specialized prompt is called (we already mocked this above)

    // Step 3: Gmail service call
    mockedFetchGmailMessages.mockResolvedValue(mockFetchedEmails);

    // Step 4: AI call for refining emails
    mockedAIGenerate.mockResolvedValueOnce({
      output: { refinedEmails: mockRefinedEmails },
    });

    // Act: Run the flow
    const result = await queryEmails(mockInput);

    // Assert: Verify that each step was called correctly and the output is as expected
    // 1. Categorization was called
    expect(mockedAIGenerate).toHaveBeenCalledWith(expect.objectContaining({
        prompt: expect.stringContaining('You are an expert query routing agent'),
    }));
    // 2. The correct specialized prompt was called
    expect(mockBillingTransformPrompt).toHaveBeenCalledWith({query: mockInput.query});
    // 3. Gmail fetch was called with the result of the specialized prompt
    expect(mockedFetchGmailMessages).toHaveBeenCalledWith(mockInput.accessToken, mockGmailQuery, 20);
    // 4. Final refinement was called
    expect(mockedAIGenerate).toHaveBeenCalledWith(expect.objectContaining({
        prompt: expect.stringContaining('You are an intelligent email processing agent'),
    }));
    
    expect(result.emailList.length).toBe(1);
    expect(result.emailList[0].id).toBe('123');
    expect(result.emailList[0].summary).toBe('Relevant summary about the invoice');
  });

  it('should return an empty list if no emails are fetched from Gmail', async () => {
    // Arrange
    // Mock the categorization and transformation steps
    mockedAIGenerate.mockResolvedValueOnce({ output: { category: 'general' } });
    const mockGeneralTransformPrompt = jest.fn().mockResolvedValue({ output: { gmailQueryString: 'any-query' } });
    mockedDefinePrompt.mockReturnValue(mockGeneralTransformPrompt);

    mockedFetchGmailMessages.mockResolvedValue([]); // Simulate Gmail returning no messages

    // Act
    const result = await queryEmails(mockInput);

    // Assert
    expect(mockedFetchGmailMessages).toHaveBeenCalledTimes(1);
    // The refinement AI call should NOT be made if there are no emails to process
    expect(mockedAIGenerate).toHaveBeenCalledTimes(1); // Only the categorization call
    expect(result.emailList).toEqual([]);
  });

  it('should return a user-friendly error object if the AI fails to categorize the query', async () => {
    // Arrange
    mockedAIGenerate.mockResolvedValueOnce({ output: null }); // Simulate AI failure

    // Act
    // The flow should default to 'general' and continue, so we expect it to fail at the next step
    // if a transform prompt isn't correctly returned.
    // Let's adjust the test to check for the final thrown error.
    await expect(queryEmails(mockInput)).rejects.toThrow('AI failed to transform the query');

    // Assert
    // Only the categorization call should have been made
    expect(mockedAIGenerate).toHaveBeenCalledTimes(1);
    expect(mockedFetchGmailMessages).not.toHaveBeenCalled();
  });
});
