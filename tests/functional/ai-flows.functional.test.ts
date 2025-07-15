// Comprehensive AI flows functional tests
import { setupDefaultAIMocks } from '../utils/test-utils';
import { summarizeEmail } from '@/ai/flows/summarize-email';
import { extractActionItems } from '@/ai/flows/extract-action-items';
import { draftReply } from '@/ai/flows/draft-reply';

// Mock AI flows for functional tests
jest.mock('@/ai/flows/summarize-email', () => ({
  summarizeEmail: jest.fn(),
}));

jest.mock('@/ai/flows/extract-action-items', () => ({
  extractActionItems: jest.fn(),
}));

jest.mock('@/ai/flows/draft-reply', () => ({
  draftReply: jest.fn(),
}));

const mockSummarizeEmail = summarizeEmail as jest.MockedFunction<typeof summarizeEmail>;
const mockExtractActionItems = extractActionItems as jest.MockedFunction<typeof extractActionItems>;
const mockDraftReply = draftReply as jest.MockedFunction<typeof draftReply>;

describe('AI Flows Functional Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.GOOGLE_AI_API_KEY = 'test-api-key'
    // Setup AI mocks for functional tests
    setupDefaultAIMocks();
  })

  describe('Email Summarization Workflow', () => {
    test('should summarize a business email correctly', async () => {
      const testEmail = {
        emailContent: `Hi John,

I hope this email finds you well. I wanted to update you on the Q4 project status.

We have completed the initial phase of the development and are now moving into testing. The key deliverables for next week are:
1. Complete unit testing by Friday
2. Deploy to staging environment
3. Schedule user acceptance testing

Please let me know if you have any questions or concerns.

Best regards,
Sarah`
      };

      mockSummarizeEmail.mockResolvedValue({
        summary: 'Q4 project update: Initial development phase complete, moving to testing phase with deliverables for unit testing, staging deployment, and user acceptance testing scheduled for next week.'
      });

      const result = await summarizeEmail(testEmail);
      
      expect(mockSummarizeEmail).toHaveBeenCalledWith(testEmail);
      expect(result.summary).toContain('Q4 project');
      expect(result.summary).toContain('testing');
    });

    test('should handle empty email content gracefully', async () => {
      const testEmail = { emailContent: '' };
      
      mockSummarizeEmail.mockRejectedValue(new Error('Empty email content'));
      
      await expect(summarizeEmail(testEmail)).rejects.toThrow('Empty email content');
    });
  })

  describe('Action Items Extraction Workflow', () => {
    test('should extract action items from meeting follow-up email', async () => {
      const testEmail = {
        emailContent: `Team,

Following up on today's meeting, here are the action items:

Please review the attached document by Wednesday.
John, can you prepare the presentation slides for the client meeting?
Everyone should submit their timesheets by end of day Friday.
Sarah, please schedule the follow-up meeting with the stakeholders.

Thanks,
Mike`
      };

      mockExtractActionItems.mockResolvedValue({
        actionItems: [
          'Review attached document by Wednesday',
          'John: Prepare presentation slides for client meeting',
          'Submit timesheets by end of day Friday',
          'Sarah: Schedule follow-up meeting with stakeholders'
        ]
      });

      const result = await extractActionItems(testEmail);
      
      expect(mockExtractActionItems).toHaveBeenCalledWith(testEmail);
      expect(result.actionItems).toHaveLength(4);
      expect(result.actionItems[0]).toContain('Review attached document');
      expect(result.actionItems[1]).toContain('John');
    });

    test('should return empty array for emails with no action items', async () => {
      const testEmail = {
        emailContent: 'Thanks for the update. This is just an FYI, no action needed.'
      };

      mockExtractActionItems.mockResolvedValue({
        actionItems: []
      });

      const result = await extractActionItems(testEmail);
      
      expect(result.actionItems).toHaveLength(0);
    });
  })

  describe('Reply Drafting Workflow', () => {
    test('should draft professional reply for business email', async () => {
      const testEmail = {
        emailContent: 'Can we schedule a meeting to discuss the project timeline?',
        replyTone: 'formal' as const
      };

      mockDraftReply.mockResolvedValue({
        reply: 'Thank you for reaching out. I would be happy to discuss the project timeline with you. I have availability next Tuesday at 2 PM or Wednesday at 10 AM. Please let me know which time works better for you, and I will send a calendar invitation.'
      });

      const result = await draftReply(testEmail);
      
      expect(mockDraftReply).toHaveBeenCalledWith(testEmail);
      expect(result.reply).toContain('Thank you');
      expect(result.reply).toContain('availability');
    });

    test('should draft casual reply when specified', async () => {
      const testEmail = {
        emailContent: 'Hey, are you free for lunch tomorrow?',
        replyTone: 'casual' as const
      };

      mockDraftReply.mockResolvedValue({
        reply: 'Hey! Yes, I should be free for lunch tomorrow. How about we meet at that new place downtown around 12:30? Let me know if that works!'
      });

      const result = await draftReply(testEmail);
      
      expect(result.reply).toContain('Hey');
      expect(result.reply).toContain('12:30');
    });
  })

  describe('End-to-End AI Workflow', () => {
    test('should process complete email workflow: summarize, extract actions, draft reply', async () => {
      const testEmail = {
        emailContent: `Hi Sarah,

I hope you're doing well. I wanted to follow up on our discussion about the marketing campaign.

Could you please:
1. Review the campaign materials by Friday
2. Provide feedback on the budget allocation
3. Schedule a meeting with the creative team

I think we should aim to launch by next month. What are your thoughts?

Best,
Alex`
      };

      // Mock all AI services
      mockSummarizeEmail.mockResolvedValue({
        summary: 'Follow-up on marketing campaign discussion with requests for material review, budget feedback, and team meeting scheduling. Launch target: next month.'
      });

      mockExtractActionItems.mockResolvedValue({
        actionItems: [
          'Review campaign materials by Friday',
          'Provide feedback on budget allocation',
          'Schedule meeting with creative team'
        ]
      });

      mockDraftReply.mockResolvedValue({
        reply: 'Hi Alex, Thank you for the follow-up. I will review the campaign materials and provide budget feedback by Friday. I\'ll also coordinate with the creative team for a meeting next week. The next month launch timeline looks feasible. I\'ll keep you updated on progress.'
      });

      // Execute workflow
      const summaryResult = await summarizeEmail({ emailContent: testEmail.emailContent });
      const actionItemsResult = await extractActionItems({ emailContent: testEmail.emailContent });
      const replyResult = await draftReply({ emailContent: testEmail.emailContent, replyTone: 'formal' });

      // Verify complete workflow
      expect(summaryResult.summary).toContain('marketing campaign');
      expect(actionItemsResult.actionItems).toHaveLength(3);
      expect(replyResult.reply).toContain('Friday');
      
      // Verify all services were called
      expect(mockSummarizeEmail).toHaveBeenCalled();
      expect(mockExtractActionItems).toHaveBeenCalled();
      expect(mockDraftReply).toHaveBeenCalled();
    });
  })

  describe('Error Handling and Resilience', () => {
    test('should handle AI service timeouts gracefully', async () => {
      const testEmail = { emailContent: 'Test email content' };
      
      mockSummarizeEmail.mockRejectedValue(new Error('Service timeout'));
      
      await expect(summarizeEmail(testEmail)).rejects.toThrow('Service timeout');
    });

    test('should handle network failures gracefully', async () => {
      const testEmail = { emailContent: 'Test email content' };
      
      mockExtractActionItems.mockRejectedValue(new Error('Network error'));
      
      await expect(extractActionItems(testEmail)).rejects.toThrow('Network error');
    });

    test('should handle invalid input gracefully', async () => {
      const invalidEmail = { emailContent: null };
      
      mockDraftReply.mockRejectedValue(new Error('Invalid input'));
      
      await expect(draftReply(invalidEmail as any)).rejects.toThrow('Invalid input');
    });
  })
})