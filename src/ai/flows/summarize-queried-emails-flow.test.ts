// This file uses a robust mocking strategy to test a Genkit flow
// that relies on `ai.definePrompt`. The key is to place the jest.mock
// call BEFORE importing the module under test.

// Step 1: Create a mock function we can control.
const mockPromptFunction = jest.fn();

// Step 2: Mock the entire genkit module. Inside the factory,
// make `definePrompt` return our controllable mock function.
// This factory is executed by Jest BEFORE any imports in the file are processed.
jest.mock('@/ai/genkit', () => ({
  ai: {
    // Mock defineFlow to just return the inner function, so we test its logic.
    defineFlow: jest.fn((config, flowFunc) => flowFunc),
    // Mock definePrompt to return our spy function.
    definePrompt: jest.fn(() => mockPromptFunction),
  },
}));

// Step 3: Now that the mock is in place, import the code we want to test.
// When this file is parsed, it will use our mocked `ai` object.
import { summarizeQueriedEmails } from './summarize-queried-emails-flow';
import type { SummarizeQueriedEmailsInput } from './summarize-queried-emails-flow';


describe('summarizeQueriedEmails Flow', () => {
  beforeEach(() => {
    // Before each test, clear the history of our spy function.
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
    
    // Configure our prompt spy to return a resolved promise with the expected output.
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
