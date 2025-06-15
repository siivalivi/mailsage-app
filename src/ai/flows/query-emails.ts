'use server';

/**
 * @fileOverview A flow that allows users to query their emails using natural language.
 *
 * - queryEmails - A function that handles the email querying process.
 * - QueryEmailsInput - The input type for the queryEmails function.
 * - QueryEmailsOutput - The return type for the queryEmails function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const QueryEmailsInputSchema = z.object({
  query: z.string().describe('The natural language query to search emails.'),
});
export type QueryEmailsInput = z.infer<typeof QueryEmailsInputSchema>;

const QueryEmailsOutputSchema = z.object({
  emailList: z
    .array(
      z.object({
        sender: z.string().describe('The sender of the email.'),
        subject: z.string().describe('The subject of the email.'),
        summary: z.string().describe('A structured and informative summary of the email content.'),
      })
    )
    .describe('A list of emails matching the query, each with a detailed summary.'),
});
export type QueryEmailsOutput = z.infer<typeof QueryEmailsOutputSchema>;

export async function queryEmails(input: QueryEmailsInput): Promise<QueryEmailsOutput> {
  return queryEmailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'queryEmailsPrompt',
  input: {schema: QueryEmailsInputSchema},
  output: {schema: QueryEmailsOutputSchema},
  prompt: `You are an AI assistant helping users to search their emails.
Based on the user's query, retrieve a list of matching emails.
For each email, provide:
- Sender
- Subject
- A concise, structured summary of the email content. This summary should:
    - Extract and highlight key information such as names of people or organizations, monetary amounts, specific dates or deadlines, and locations.
    - Clearly list any explicit action items or questions directed at the recipient.
    - If the email appears to be a bill, receipt, or financial statement, make sure to summarize the total amount, key items or services, and payment due dates if mentioned.
    - Present information in an easy-to-scan format. Use bullet points for lists, action items, or breakdowns where appropriate.
    - Aim for a balance between brevity and completeness of critical information. The goal is to give the user a quick but thorough understanding of the email's essence.

User Query: {{{query}}}
  `,
});

const queryEmailsFlow = ai.defineFlow(
  {
    name: 'queryEmailsFlow',
    inputSchema: QueryEmailsInputSchema,
    outputSchema: QueryEmailsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
