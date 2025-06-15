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
        summary: z.string().describe('A short summary of the email content.'),
      })
    )
    .describe('A list of emails matching the query.'),
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

  Based on the user's query, you should return a list of emails that match the query.
  The email list should contain the sender, subject, and a short summary of the email content.

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
