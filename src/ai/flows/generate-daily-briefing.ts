'use server';
/**
 * @fileOverview A flow that generates a categorized daily briefing of emails.
 *
 * - generateDailyBriefing - The primary exported function.
 * - GenerateDailyBriefingInput - The input type for the function.
 * - GenerateDailyBriefingOutput - The return type for the function.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { fetchGmailMessages, type FetchedEmailData } from '@/services/gmailService';
import { subDays, format, startOfWeek } from 'date-fns';

const GenerateDailyBriefingInputSchema = z.object({
  timeRange: z.enum(['today', 'yesterday', 'this-week', 'last-7-days']).describe("The time range to generate the briefing for."),
  accessToken: z.string().describe('Google OAuth2 Access Token for Gmail API.'),
});
export type GenerateDailyBriefingInput = z.infer<typeof GenerateDailyBriefingInputSchema>;

const GenerateDailyBriefingOutputSchema = z.object({
  briefing: z.string().describe('A categorized summary of the day\'s emails, formatted in Markdown.'),
});
export type GenerateDailyBriefingOutput = z.infer<typeof GenerateDailyBriefingOutputSchema>;

// Exported server action wrapper
export async function generateDailyBriefing(input: GenerateDailyBriefingInput): Promise<GenerateDailyBriefingOutput> {
  const result = await generateDailyBriefingFlow(input);
  if (!result) {
    throw new Error('The AI failed to generate a daily briefing.');
  }
  return result;
}

const briefingPrompt = ai.definePrompt({
    name: 'dailyBriefingPrompt',
    input: { schema: z.object({ emails: z.array(z.any()), timeRange: z.string() }) },
    output: { schema: GenerateDailyBriefingOutputSchema },
    prompt: `You are a highly efficient executive assistant. Your task is to create a concise daily briefing from a list of emails for the following time range: {{timeRange}}.
Analyze the provided list of emails and categorize them into logical groups.

**CRITICAL INSTRUCTIONS:**
- Group emails into categories like: "Receipts & Invoices", "Promotions & Marketing", "Travel Confirmations", "Social Notifications", "Important Conversations", and "Other".
- For each category, provide a very brief one-sentence summary of what's in that group.
- Then, list the 1-3 most important or representative emails from that category with their sender and subject.
- If a category is empty, do not include it in the output.
- The entire output should be a single block of text, formatted with markdown for clarity (e.g., using '###' for category titles and '*' for list items).
- Keep the entire briefing concise and scannable.

Here are the emails to process:
{{#each emails}}
- From: {{sender}}
  Subject: {{subject}}
  Snippet: {{{snippet}}}
---
{{/each}}

Generate the briefing based on these emails. If there are no emails, state that the inbox for that time range was empty.
`,
});

const generateDailyBriefingFlow = ai.defineFlow(
  {
    name: 'generateDailyBriefingFlow',
    inputSchema: GenerateDailyBriefingInputSchema,
    outputSchema: GenerateDailyBriefingOutputSchema,
  },
  async (input) => {
    const now = new Date();
    // Set time to start of day for consistent date comparisons
    now.setHours(0, 0, 0, 0); 
    
    let afterDate: Date;
    let beforeDate: Date = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default to tomorrow morning

    switch (input.timeRange) {
        case 'today':
            afterDate = now;
            break;
        case 'yesterday':
            afterDate = subDays(now, 1);
            beforeDate = now;
            break;
        case 'this-week':
            afterDate = startOfWeek(now, { weekStartsOn: 1 }); // week starts on Monday
            break;
        case 'last-7-days':
            afterDate = subDays(now, 7);
            break;
    }
    
    const gmailQuery = `after:${format(afterDate, 'yyyy/MM/dd')} before:${format(beforeDate, 'yyyy/MM/dd')}`;
    
    console.log(`[generateDailyBriefingFlow] Fetching emails with query: "${gmailQuery}" for time range "${input.timeRange}"`);

    const emails: FetchedEmailData[] = await fetchGmailMessages(
      input.accessToken,
      gmailQuery,
      50 // Fetch up to 50 emails for a briefing
    );

    if (emails.length === 0) {
      return { briefing: `No emails found for ${input.timeRange.replace('-', ' ')}. Your inbox is clear!` };
    }

    console.log(`[generateDailyBriefingFlow] Found ${emails.length} emails. Generating briefing.`);

    const response = await briefingPrompt({ emails, timeRange: input.timeRange });

    if (!response || !response.output) {
        throw new Error('The AI failed to generate a summary for the briefing.');
    }

    return response.output;
  }
);
