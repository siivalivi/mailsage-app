import { extractActionItems, ExtractActionItemsInput } from './extract-action-items';
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

describe('extractActionItems Flow', () => {
  beforeEach(() => {
    mockedAIGenerate.mockClear();
  });

  it('should call the AI and return a list of action items', async () => {
    // Arrange
    const input: ExtractActionItemsInput = {
      emailContent: 'Please send the report by Friday. Also, did you review the presentation?',
    };
    const expectedActionItems = [
      'Send the report by Friday',
      'Review the presentation',
    ];
    mockedAIGenerate.mockResolvedValue({
      output: { actionItems: expectedActionItems },
    });

    // Act
    const result = await extractActionItems(input);

    // Assert
    expect(mockedAIGenerate).toHaveBeenCalledTimes(1);
    expect(mockedAIGenerate).toHaveBeenCalledWith(expect.objectContaining({ input }));
    expect(result.actionItems).toEqual(expectedActionItems);
  });

  it('should return an empty list if no action items are found', async () => {
    // Arrange
    const input: ExtractActionItemsInput = {
      emailContent: 'This is just an FYI. No action needed.',
    };
    mockedAIGenerate.mockResolvedValue({
      output: { actionItems: [] },
    });

    // Act
    const result = await extractActionItems(input);

    // Assert
    expect(result.actionItems).toEqual([]);
  });

  it('should throw an error if the AI returns a null or empty response', async () => {
    // Arrange
    const input: ExtractActionItemsInput = { emailContent: 'Some content' };
    mockedAIGenerate.mockResolvedValue({ output: null });

    // Act & Assert
    await expect(extractActionItems(input)).rejects.toThrow(
      'The AI failed to extract action items.'
    );
  });
});
