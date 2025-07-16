


import { generateDailyBriefing } from './generate-daily-briefing';
import type { GenerateDailyBriefingInput } from './generate-daily-briefing';
import { fetchGmailMessages } from '@/services/gmailService';
import { ai } from '@/ai/genkit';
import { format, subDays, startOfWeek } from 'date-fns';

// Mock dependencies
jest.mock('@/services/gmailService');
const mockedFetchGmailMessages = fetchGmailMessages as jest.Mock;

jest.mock('@/ai/genkit', () => {
  const mockGenerate = jest.fn();
  const mockDefinePrompt = jest.fn().mockImplementation((config) => 
    jest.fn().mockImplementation(async (input) => mockGenerate({ prompt: config, input }))
  );
  return {
    ai: {
      generate: mockGenerate,
      defineFlow: jest.fn((config, flowFunc) => flowFunc),
      definePrompt: mockDefinePrompt,
    },
  };
});
const mockedAIGenerate = ai.generate as jest.Mock;

describe('generateDailyBriefing Flow', () => {
  const mockAccessToken = 'test-token';
  const mockEmails = [{ id: '1', sender: 'test@example.com', subject: 'Test', snippet: 'Snippet', timestamp: Date.now() }];
  const mockBriefingText = '### Important Conversations\n- This is a test briefing.';

  beforeEach(() => {
    jest.clearAllMocks();
    // Set a fixed date for consistent query generation in tests
    // Let's set it to April 15, 2024 (a Monday)
    jest.useFakeTimers().setSystemTime(new Date('2024-04-15T10:00:00Z'));

    // Mock the AI response by default
    mockedAIGenerate.mockResolvedValue({
      output: { briefing: mockBriefingText },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should call fetchGmailMessages with the correct query for "today"', async () => {
    mockedFetchGmailMessages.mockResolvedValue(mockEmails);
    const input: GenerateDailyBriefingInput = { timeRange: 'today', accessToken: mockAccessToken };
    
    await generateDailyBriefing(input);
    
    const expectedQuery = 'after:2024/04/15 before:2024/04/16';
    expect(mockedFetchGmailMessages).toHaveBeenCalledWith(mockAccessToken, expectedQuery, 50);
    expect(mockedAIGenerate).toHaveBeenCalledTimes(1);
  });

  it('should call fetchGmailMessages with the correct query for "yesterday"', async () => {
    mockedFetchGmailMessages.mockResolvedValue(mockEmails);
    const input: GenerateDailyBriefingInput = { timeRange: 'yesterday', accessToken: mockAccessToken };

    await generateDailyBriefing(input);

    const expectedQuery = 'after:2024/04/14 before:2024/04/15';
    expect(mockedFetchGmailMessages).toHaveBeenCalledWith(mockAccessToken, expectedQuery, 50);
  });
  
  it('should call fetchGmailMessages with the correct query for "this-week"', async () => {
    mockedFetchGmailMessages.mockResolvedValue(mockEmails);
    const input: GenerateDailyBriefingInput = { timeRange: 'this-week', accessToken: mockAccessToken };

    await generateDailyBriefing(input);

    // Since our mock date is a Monday, start of week is the same day.
    const expectedQuery = 'after:2024/04/15 before:2024/04/16';
    expect(mockedFetchGmailMessages).toHaveBeenCalledWith(mockAccessToken, expectedQuery, 50);
  });

  it('should call fetchGmailMessages with the correct query for "last-7-days"', async () => {
    mockedFetchGmailMessages.mockResolvedValue(mockEmails);
    const input: GenerateDailyBriefingInput = { timeRange: 'last-7-days', accessToken: mockAccessToken };

    await generateDailyBriefing(input);

    const expectedQuery = 'after:2024/04/08 before:2024/04/16';
    expect(mockedFetchGmailMessages).toHaveBeenCalledWith(mockAccessToken, expectedQuery, 50);
  });

  it('should return a "no emails found" message without calling the AI if no emails are fetched', async () => {
    mockedFetchGmailMessages.mockResolvedValue([]);
    const input: GenerateDailyBriefingInput = { timeRange: 'today', accessToken: mockAccessToken };

    const result = await generateDailyBriefing(input);

    expect(mockedFetchGmailMessages).toHaveBeenCalledTimes(1);
    expect(mockedAIGenerate).not.toHaveBeenCalled();
    expect(result.briefing).toContain('No emails found');
  });

  it('should throw an error if the AI fails to generate a briefing', async () => {
    mockedFetchGmailMessages.mockResolvedValue(mockEmails);
    mockedAIGenerate.mockResolvedValue({ output: null }); // AI failure
    const input: GenerateDailyBriefingInput = { timeRange: 'today', accessToken: mockAccessToken };

    await expect(generateDailyBriefing(input)).rejects.toThrow('The AI failed to generate a summary for the briefing.');
  });
});
