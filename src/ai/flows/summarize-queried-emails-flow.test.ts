
import { summarizeQueriedEmails } from './summarize-queried-emails-flow';
import type { SummarizeQueriedEmailsInput } from './summarize-queried-emails-flow';
import { ai } from '@/ai/genkit';

// Mock the AI module to avoid actual API calls.
jest.mock('@/ai/genkit', () => ({
  ai: {
    generate: jest.fn(),
    // Mock defineFlow and definePrompt to just return their inner function or config object.
    // This isolates our test to the flow's logic, not the Genkit framework itself.
    defineFlow: jest.fn((config, flowFunc) => flowFunc),
    definePrompt: jest.fn((config) => config), // Return the config object for inspection if needed.
  },
}));

// Create a typed mock for the `generate` function for type safety.
const mockedAIGenerate = ai.generate as jest.Mock;

describe('summarizeQueriedEmails Flow', () => {
  beforeEach(() => {
    // Clear mock history before each test.
    mockedAIGenerate.mockClear();
  });

  it('should call the AI with the correct data and return the overall summary', async () => {
    // Arrange
    const input: SummarizeQueriedEmailsInput = {
      queriedEmails: [
        { sender: 'a@a.com', subject: 'Subj A', summary: 'Summary A' },
        { sender: 'b@b.com', subject: 'Subj B', summary: 'Summary B' },
      ],
    };
    const expectedSummary = 'This is the overall summary of emails A and B.';
    
    // Configure the mock AI response for this test.
    mockedAIGenerate.mockResolvedValue({
      output: { overallSummary: expectedSummary },
    });

    // Act
    const result = await summarizeQueriedEmails(input);

    // Assert
    expect(mockedAIGenerate).toHaveBeenCalledTimes(1);
    // Check that the input passed to the AI generator was the same as our flow input.
    expect(mockedAIGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        input: input,
      })
    );
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
    // The AI should NOT be called for an empty list.
    expect(mockedAIGenerate).not.toHaveBeenCalled();
    expect(result.overallSummary).toBe('No email summaries were provided to synthesize.');
  });

  it('should throw an error if the AI returns an empty or null response', async () => {
    // Arrange
    const input: SummarizeQueriedEmailsInput = {
      queriedEmails: [{ sender: 'a@a.com', subject: 'Subj A', summary: 'Summary A' }],
    };
    mockedAIGenerate.mockResolvedValue({ output: null }); // Simulate AI failure.

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
    mockedAIGenerate.mockRejectedValue(aiError);
    
    // Act & Assert
    await expect(summarizeQueriedEmails(input)).rejects.toThrow(aiError);
  });
});
