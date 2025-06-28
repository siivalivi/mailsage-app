
import { summarizeQueriedEmails } from './summarize-queried-emails-flow';
import type { SummarizeQueriedEmailsInput } from './summarize-queried-emails-flow';
import { ai } from '@/ai/genkit';
import { z } from 'zod';

// The prompt function that will be mocked.
const mockPrompt = jest.fn();

// Mock the genkit module to control AI calls
jest.mock('@/ai/genkit', () => ({
  ai: {
    // Mock defineFlow to return the flow's inner function for direct testing
    defineFlow: jest.fn((config, flowFunc) => flowFunc),
    // Mock definePrompt to return our spy function
    definePrompt: jest.fn(() => mockPrompt),
  },
}));

describe('summarizeQueriedEmails Flow', () => {

  beforeEach(() => {
    // Clear mock history before each test
    jest.clearAllMocks();
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
    mockPrompt.mockResolvedValue({
      output: { overallSummary: expectedSummary },
    });

    // Act
    const result = await summarizeQueriedEmails(input);

    // Assert
    // Check that the prompt was called once
    expect(mockPrompt).toHaveBeenCalledTimes(1);
    // Check that the prompt was called with the correct input data
    expect(mockPrompt).toHaveBeenCalledWith(input);
    // Check that the final result is correct
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
    // The AI prompt should NOT be called for an empty list
    expect(mockPrompt).not.toHaveBeenCalled();
    // A specific user-friendly message should be returned
    expect(result.overallSummary).toBe('No email summaries were provided to synthesize.');
  });

  it('should throw an error if the AI returns an empty or null response', async () => {
    // Arrange
    const input: SummarizeQueriedEmailsInput = {
      queriedEmails: [{ sender: 'a@a.com', subject: 'Subj A', summary: 'Summary A' }],
    };
    mockPrompt.mockResolvedValue({ output: null }); // Simulate AI failure

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
    mockPrompt.mockRejectedValue(aiError);
    
    // Act & Assert
    await expect(summarizeQueriedEmails(input)).rejects.toThrow(aiError);
  });
});
