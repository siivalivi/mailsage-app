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
import { subDays, format } from 'date-fns';

const GenerateDailyBriefingInputSchema = z.object({
  day: z.enum(['today', 'yesterday']).describe("The day to generate the briefing for, either 'today' or 'yesterday'."),
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
    input: { schema: z.object({ emails: z.array(z.any()), day: z.string() }) },
    output: { schema: GenerateDailyBriefingOutputSchema },
    prompt: `You are a highly efficient executive assistant. Your task is to create a concise daily briefing from a list of emails for {{day}}.
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

Generate the briefing based on these emails. If there are no emails, state that the inbox for that day was empty.
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
    
    const targetDate = input.day === 'today' ? now : subDays(now, 1);
    
    // Format for Gmail API query: YYYY/MM/DD
    const afterDate = format(targetDate, 'yyyy/MM/dd');
    const beforeDate = format(new Date(targetDate.getTime() + 24 * 60 * 60 * 1000), 'yyyy/MM/dd');

    const gmailQuery = `after:${afterDate} before:${beforeDate}`;
    
    console.log(`[generateDailyBriefingFlow] Fetching emails with query: "${gmailQuery}"`);

    const emails: FetchedEmailData[] = await fetchGmailMessages(
      input.accessToken,
      gmailQuery,
      50 // Fetch up to 50 emails for a daily briefing
    );

    if (emails.length === 0) {
      return { briefing: `No emails found for ${input.day}. Your inbox is clear!` };
    }

    console.log(`[generateDailyBriefingFlow] Found ${emails.length} emails. Generating briefing.`);

    const response = await briefingPrompt({ emails, day: input.day });

    if (!response || !response.output) {
        throw new Error('The AI failed to generate a summary for the briefing.');
    }

    return response.output;
  }
);
