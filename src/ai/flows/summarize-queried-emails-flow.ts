'use server';
/**
 * @fileOverview A flow that generates an overall summary from a list of queried email summaries.
 *
 * - summarizeQueriedEmails - A function that takes multiple email summaries and synthesizes a single meta-summary.
 * - SummarizeQueriedEmailsInput - The input type for the summarizeQueriedEmails function.
 * - SummarizeQueriedEmailsOutput - The return type for the summarizeQueriedEmails function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { QueriedEmail } from '@/types'; // Using existing QueriedEmail type

const SummarizeQueriedEmailsInputSchema = z.object({
  queriedEmails: z
    .array(
      z.object({
        sender: z.string().describe('The sender of the email.'),
        subject: z.string().describe('The subject of the email.'),
        summary: z.string().describe('The individual summary of the email content.'),
      })
    )
    .describe('A list of individually summarized emails from a user query.'),
});
export type SummarizeQueriedEmailsInput = z.infer<typeof SummarizeQueriedEmailsInputSchema>;

const SummarizeQueriedEmailsOutputSchema = z.object({
  overallSummary: z.string().describe('A concise, synthesized summary of all the provided email summaries, highlighting key themes, collective action items, or important patterns across the emails.'),
});
export type SummarizeQueriedEmailsOutput = z.infer<typeof SummarizeQueriedEmailsOutputSchema>;

export async function summarizeQueriedEmails(input: SummarizeQueriedEmailsInput): Promise<SummarizeQueriedEmailsOutput> {
  return summarizeQueriedEmailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeQueriedEmailsPrompt',
  input: { schema: SummarizeQueriedEmailsInputSchema },
  output: { schema: SummarizeQueriedEmailsOutputSchema },
  prompt: `You are an AI assistant tasked with creating a high-level synthesis from a list of email summaries.
The user has performed a query and received several emails, each already summarized.
Your goal is to provide an "executive summary" of these summaries.

Analyze the following email summaries:
{{#each queriedEmails}}
- Email from: {{sender}}
  Subject: {{subject}}
  Summary: {{{summary}}}
---
{{/each}}

Based on ALL the email summaries provided, generate a single, concise overall summary. This overall summary should:
- Identify common themes or topics that appear across multiple emails.
- Highlight any critical information, deadlines, or collective action items that emerge from the set of emails.
- Point out any notable patterns (e.g., multiple updates on the same project, recurring issues).
- Be brief and easy to understand, giving the user a quick overview of what the queried emails are collectively about.
- Do not just list the summaries; synthesize them.
- If there's only one email, the overall summary can be a slightly more contextualized version of its individual summary.
- If no common themes or patterns are evident, briefly state that the emails cover diverse topics and perhaps pick out the 1-2 most important individual items.
Provide only the overall summary.
  `,
});

const summarizeQueriedEmailsFlow = ai.defineFlow(
  {
    name: 'summarizeQueriedEmailsFlow',
    inputSchema: SummarizeQueriedEmailsInputSchema,
    outputSchema: SummarizeQueriedEmailsOutputSchema,
  },
  async (input: SummarizeQueriedEmailsInput) => {
    if (!input.queriedEmails || input.queriedEmails.length === 0) {
      return { overallSummary: 'No emails were provided to summarize.' };
    }
    const { output } = await prompt(input);
    return output!;
  }
);
