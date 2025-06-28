// This file uses a robust mocking strategy to test a Genkit flow
// that relies on `ai.definePrompt`. The key is to place the jest.mock
// call BEFORE importing the module under test.

// Step 1: This is the function that our mocked `definePrompt` will return.
// We can control its behavior in each test.
const mockPromptFunction = jest.fn();

// Step 2: Mock the genkit module BEFORE importing the file under test.
jest.mock('@/ai/genkit', () => ({
  ai: {
    // Mock defineFlow to just return the inner function for direct logic testing.
    defineFlow: jest.fn((config, flowFunc) => flowFunc),
    // Mock definePrompt to return our controllable spy function.
    definePrompt: jest.fn(() => mockPromptFunction),
  },
}));

// Step 3: Now, import the code we want to test. When Jest processes this file,
// it will use our mock from above instead of the real '@/ai/genkit'.
import { summarizeQueriedEmails } from './summarize-queried-emails-flow';
import type { SummarizeQueriedEmailsInput } from './summarize-queried-emails-flow';


describe('summarizeQueriedEmails Flow', () => {
  beforeEach(() => {
    // Before each test, clear the history of our spy function and reset any implementations.
    mockPromptFunction.mockClear();
  });

  it('should call the AI prompt with the correct data and return the overall summary', async () => {
    // Arrange
    const input: SummarizeQueriedEmailsInput = {
      queriedEmails: [
        { sender: 'a@a.com', subject: 'Subj A', summary: 'Summary A' },
        { sender: 'b@b.com', subject: 'Subj B', summary: 'Summary B' },
      ],
    };
    const expectedSummary = 'This is the overall summary of emails A and B.';
    
    // Configure our mock prompt to return a resolved promise with the expected output for this specific test.
    mockPromptFunction.mockResolvedValue({
      output: { overallSummary: expectedSummary },
    });

    // Act
    const result = await summarizeQueriedEmails(input);

    // Assert
    // Check that our prompt spy was called once with the correct input.
    expect(mockPromptFunction).toHaveBeenCalledTimes(1);
    expect(mockPromptFunction).toHaveBeenCalledWith(input);
    // Check that the final result is correct.
    expect(result.overallSummary).toBe(expectedSummary);
  });

  it('should return a default message if the input email list is empty', async () => {
    // Arrange
    const input: SummarizeQueriedEmailsInput = {
      queriedEmails: [],
    };

    // Act
    const result = await summarizeQueriedEmails(input);

    // Assert
    // The AI prompt should NOT be called for an empty list.
    expect(mockPromptFunction).not.toHaveBeenCalled();
    // A specific user-friendly message should be returned.
    expect(result.overallSummary).toBe('No email summaries were provided to synthesize.');
  });

  it('should throw an error if the AI returns an empty or null response', async () => {
    // Arrange
    const input: SummarizeQueriedEmailsInput = {
      queriedEmails: [{ sender: 'a@a.com', subject: 'Subj A', summary: 'Summary A' }],
    };
    mockPromptFunction.mockResolvedValue({ output: null }); // Simulate AI failure

    // Act & Assert
    await expect(summarizeQueriedEmails(input)).rejects.toThrow(
      'The AI failed to generate an overall summary.'
    );
  });

   it('should throw an error if the AI call itself fails (e.g., network error)', async () => {
    // Arrange
    const input: SummarizeQueriedEmailsInput = {
      queriedEmails: [{ sender: 'a@a.com', subject: 'Subj A', summary: 'Summary A' }],
    };
    const aiError = new Error('AI service unavailable');
    mockPromptFunction.mockRejectedValue(aiError);
    
    // Act & Assert
    await expect(summarizeQueriedEmails(input)).rejects.toThrow(aiError);
  });
});
