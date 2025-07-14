import { draftReply, DraftReplyInput } from './draft-reply';
import { ai } from '@/ai/genkit';

// Mock the AI module
jest.mock('@/ai/genkit', () => ({
  ai: {
    generate: jest.fn(),
    defineFlow: jest.fn((config, flowFunc) => flowFunc),
    definePrompt: jest.fn((config) => {
      const mockPromptFunction = jest.fn().mockImplementation((input) => {
        // Return the same structure that ai.generate would return
        return (jest.requireMock('@/ai/genkit').ai.generate as jest.Mock)({
          prompt: config,
          input: input
        });
      });
      return mockPromptFunction;
    }),
  },
}));

const mockedAIGenerate = ai.generate as jest.Mock;

describe('draftReply Flow', () => {
  beforeEach(() => {
    mockedAIGenerate.mockClear();
  });

  it('should call the AI with correct email content and tone, and return the reply', async () => {
    // Arrange
    const input: DraftReplyInput = {
      emailContent: 'Can we meet tomorrow at 10 AM?',
      replyTone: 'polite',
    };
    const expectedReply = 'Thank you for the suggestion. Yes, 10 AM works for me.';
    mockedAIGenerate.mockResolvedValue({
      output: { reply: expectedReply },
    });

    // Act
    const result = await draftReply(input);

    // Assert
    expect(mockedAIGenerate).toHaveBeenCalledTimes(1);
    expect(mockedAIGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        input: input,
      })
    );
    expect(result.reply).toBe(expectedReply);
  });

  it('should throw an error if the AI returns a null or empty response', async () => {
    // Arrange
    const input: DraftReplyInput = {
      emailContent: 'Some content',
      replyTone: 'formal',
    };
    mockedAIGenerate.mockResolvedValue({ output: null });

    // Act & Assert
    await expect(draftReply(input)).rejects.toThrow(
      'The AI failed to generate a draft reply.'
    );
  });

  it('should propagate errors from the AI call', async () => {
    // Arrange
    const input: DraftReplyInput = {
      emailContent: 'Some content',
      replyTone: 'casual',
    };
    const aiError = new Error('AI service is down');
    mockedAIGenerate.mockRejectedValue(aiError);

    // Act & Assert
    await expect(draftReply(input)).rejects.toThrow(aiError);
  });
});
