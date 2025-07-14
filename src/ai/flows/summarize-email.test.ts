
import { summarizeEmail } from './summarize-email';
import { ai } from '@/ai/genkit';

// Mock the entire genkit module to isolate our flow from actual AI calls
jest.mock('@/ai/genkit', () => ({
  ai: {
    generate: jest.fn(),
    // Mock defineFlow to simply return the function passed to it, so we can test the logic within.
    defineFlow: jest.fn((config, flowFunc) => flowFunc),
    // Mock definePrompt to return a dummy object. The prompt itself is tested by what we pass to ai.generate.
    definePrompt: jest.fn((config) => ({
      name: config.name,
      config: config.config,
    })),
  },
}));

// Type assertion for the mocked function to give us type safety
const mockedAIGenerate = ai.generate as jest.Mock;

describe('summarizeEmail Flow', () => {
  beforeEach(() => {
    // Clear mock history before each test to ensure tests are isolated
    mockedAIGenerate.mockClear();
    (ai.defineFlow as jest.Mock).mockClear();
    (ai.definePrompt as jest.Mock).mockClear();
    
    // Reset any mock implementations that might have been set by global setup
    mockedAIGenerate.mockReset();
  });

  it('should call the AI with the correct content and return the summary', async () => {
    // Arrange: Set up the input and the expected AI response
    const emailContent = 'This is a long email body that needs summarizing.';
    const expectedSummary = 'This is the summary.';
    mockedAIGenerate.mockResolvedValue({
      output: { summary: expectedSummary },
    });

    // Act: Run the function we're testing
    const result = await summarizeEmail({ emailContent });

    // Assert: Verify the behavior
    // 1. Check that our flow called the AI generator
    expect(mockedAIGenerate).toHaveBeenCalledTimes(1);

    // 2. Check that the AI was called with the correct input data
    expect(mockedAIGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { emailContent },
      })
    );

    // 3. Check that the final result is the summary from the AI
    expect(result).toEqual({ summary: expectedSummary });
  });

  it('should throw an error if the AI returns an empty or null response', async () => {
    // Arrange: Simulate the AI failing by returning a nullish output
    const emailContent = 'This email will cause an AI failure.';
    mockedAIGenerate.mockResolvedValue({ output: null });

    // Act & Assert: Check that our flow correctly throws an error
    await expect(summarizeEmail({ emailContent })).rejects.toThrow(
      'The AI failed to generate a summary for the email.'
    );
  });

  it('should throw an error if the AI call itself fails (e.g., network error)', async () => {
    // Arrange: Simulate the AI call throwing an exception
    const emailContent = 'This email will cause a network error.';
    const aiError = new Error('AI service unavailable');
    mockedAIGenerate.mockRejectedValue(aiError);
    
    // Act & Assert: Check that our flow propagates the error
    await expect(summarizeEmail({ emailContent })).rejects.toThrow(aiError);
  });
});
