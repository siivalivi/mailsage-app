
'use server';
/**
 * @fileOverview A flow that generates an overall summary from a list of queried email summaries.
 *
 * - summarizeQueriedEmails - A function that takes multiple email summaries and synthesizes a single meta-summary.
 * - SummarizeQueriedEmailsInput - The input type for the summarizeQueriedEmails function.
 * - SummarizeQueriedEmailsOutput - The return type for the summarizeQueriedEmails function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SummarizeQueriedEmailsInputSchema = z.object({
  queriedEmails: z // These are emails already processed by queryEmails flow
    .array(
      z.object({ 
        sender: z.string().describe('The sender of the email.'),
        subject: z.string().describe('The subject of the email.'),
        summary: z.string().describe('The individual AI-generated summary of the email (based on its snippet from Gmail).'),
      })
    )
    .describe('A list of individually summarized emails, based on snippets from a user query to Gmail.'),
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
  prompt: `You are an AI assistant tasked with creating a high-level synthesis from a list of AI-generated email summaries.
The user has performed a query against their Gmail, and received several emails. Each email's snippet has already been summarized by another AI.
Your goal is to provide an "executive summary" of these individual summaries.

Analyze the following email summaries (which were based on snippets from actual Gmail emails):
{{#each queriedEmails}}
- Email from: {{sender}}
  Subject: {{subject}}
  Individual Summary (from snippet): {{{summary}}}
---
{{/each}}

Based on ALL the individual email summaries provided, generate a single, concise overall summary. This overall summary should:
- Identify common themes or topics that appear across multiple emails.
- Highlight any critical information, deadlines, or collective action items that emerge from the set of emails.
- Point out any notable patterns (e.g., multiple updates on the same project, recurring issues).
- Be brief and easy to understand, giving the user a quick overview of what the queried emails are collectively about from their snippets.
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
      return { overallSummary: 'No email summaries were provided to synthesize.' };
    }
    
    // The prompt object is an invokable function. Calling it directly is the modern
    // and recommended pattern. It's equivalent to ai.generate({prompt:..., input:..., output:...}).
    const response = await prompt(input);

    if (!response || !response.output) {
      console.error('[summarizeQueriedEmailsFlow] ERROR: The AI model failed to generate an overall summary. The response or its output was undefined.', response);
      throw new Error("The AI failed to generate an overall summary.");
    }
    
    return response.output;
  }
);
