
// This file uses a robust mocking strategy to test a Genkit flow
// that relies on `ai.definePrompt`.

import { summarizeQueriedEmails } from './summarize-queried-emails-flow';
import type { SummarizeQueriedEmailsInput } from './summarize-queried-emails-flow';
import { ai } from '@/ai/genkit';

// 1. Mock the entire genkit module. This is hoisted by Jest.
jest.mock('@/ai/genkit', () => ({
  ai: {
    // We want the real logic of our flow, so we mock defineFlow
    // to just return the inner function.
    defineFlow: jest.fn((config, flowFunc) => flowFunc),
    // We provide a placeholder mock for definePrompt. We will control
    // what this mock returns in our tests.
    definePrompt: jest.fn(),
  },
}));

// 2. Create typed references to the mocked functions.
const mockedDefinePrompt = ai.definePrompt as jest.Mock;

// This will be our spy function, representing the actual prompt the AI would run.
const mockPromptFunction = jest.fn();


describe('summarizeQueriedEmails Flow', () => {

  beforeEach(() => {
    // 3. Before each test, reset all mocks to ensure a clean slate.
    mockedDefinePrompt.mockClear();
    mockPromptFunction.mockClear();

    // 4. Crucially, we tell our mocked `definePrompt` to return our
    // controllable spy function. This is how we can check if the prompt
    // was called later.
    mockedDefinePrompt.mockReturnValue(mockPromptFunction);
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
    
    // We configure our prompt spy to return a resolved promise with the expected output.
    mockPromptFunction.mockResolvedValue({
      output: { overallSummary: expectedSummary },
    });

    // Act
    const result = await summarizeQueriedEmails(input);

    // Assert
    // Check that definePrompt was called once to set up the flow.
    expect(mockedDefinePrompt).toHaveBeenCalledTimes(1);
    // Check that our prompt spy was called once with the correct input.
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
