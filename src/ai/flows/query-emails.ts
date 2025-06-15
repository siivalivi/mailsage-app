
'use server';

/**
 * @fileOverview A flow that allows users to query their REAL emails using natural language.
 *
 * - queryEmails - A function that handles the email querying process.
 * - QueryEmailsInput - The input type for the queryEmails function.
 * - QueryEmailsOutput - The return type for the queryEmails function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { fetchGmailMessages, type FetchedEmailData } from '@/services/gmailService';

const QueryEmailsInputSchema = z.object({
  query: z.string().describe('The natural language query to search emails. This will be used by Gmail API search and also by the AI for refining selection and summarizing.'),
  accessToken: z.string().describe('Google OAuth2 Access Token for Gmail API.'),
});
export type QueryEmailsInput = z.infer<typeof QueryEmailsInputSchema>;

// This schema represents the data structure after AI processing
const QueriedEmailAISummarySchema = z.object({
  id: z.string().describe('The Gmail message ID.'),
  sender: z.string().describe('The sender of the email.'),
  subject: z.string().describe('The subject of the email.'),
  snippet: z.string().describe('The original snippet of the email from Gmail.'),
  timestamp: z.number().describe('The timestamp (Unix epoch ms) of the email.'),
  summary: z.string().describe('A structured and informative AI-generated summary of the email snippet, tailored to the user query.'),
});

const QueryEmailsOutputSchema = z.object({
  emailList: z
    .array(QueriedEmailAISummarySchema)
    .describe('A list of real emails, selected and summarized by AI based on their snippets and the user query.'),
});
export type QueryEmailsOutput = z.infer<typeof QueryEmailsOutputSchema>;

export async function queryEmails(input: QueryEmailsInput): Promise<QueryEmailsOutput> {
  return queryEmailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'queryEmailsPrompt',
  input: { schema: z.object({
    userQuery: z.string().describe("The user's original natural language query."),
    fetchedGmailEmails: z.array(z.object({ // This is FetchedEmailData from gmailService
      id: z.string(),
      sender: z.string(),
      subject: z.string(),
      snippet: z.string(),
      timestamp: z.number(),
    })).describe("A list of emails fetched from the user's Gmail based on their query.")
  })},
  output: { schema: QueryEmailsOutputSchema }, 
  prompt: `You are an AI assistant helping users to process emails fetched from their Gmail account.
You have been provided with a list of emails retrieved from Gmail based on the user's search term.
The user's original natural language query was: "{{userQuery}}"

Your tasks are:
1. Review the provided list of emails (ID, sender, subject, date, snippet).
2. Even though Gmail performed an initial search, further refine the selection if needed based on the user's specific query details. For example, if the user asked for "emails from John about marketing last week" and Gmail returned some emails from John about other topics, you should focus on the marketing ones.
3. For each email you deem relevant to "{{userQuery}}", generate a concise, structured summary based on its snippet. This summary should:
    - Extract and highlight key information such as names of people or organizations, monetary amounts, specific dates or deadlines, and locations if present in the snippet.
    - Clearly list any explicit action items or questions directed at the recipient if discernible from the snippet.
    - If the snippet suggests a bill, receipt, or financial statement, make sure to summarize the total amount, key items or services, and payment due dates if mentioned. Include details like the last four digits of a payment method if it's part of a financial confirmation visible in the snippet.
    - Present information in an easy-to-scan format. Use bullet points for lists, action items, or breakdowns where appropriate.
    - Aim for a balance between brevity and completeness of critical information from the snippet.
    - The summary should be distinct from the original snippet, adding analytical value.
4. If an email from the provided list does not seem relevant to the user's specific query "{{userQuery}}", DO NOT include it in your output.
5. If no emails from the list are relevant after your analysis, return an empty list.

Return a list of these processed emails. Each item in your list should include the original 'id', 'sender', 'subject', 'snippet', 'timestamp', and your newly generated 'summary'.

List of emails provided from Gmail:
{{#each fetchedGmailEmails}}
- Email ID: {{id}}
  From: {{sender}}
  Subject: {{subject}}
  Date (ms): {{timestamp}}
  Snippet: {{{snippet}}}
---
{{/each}}
`,
});

const queryEmailsFlow = ai.defineFlow(
  {
    name: 'queryEmailsFlow',
    inputSchema: QueryEmailsInputSchema,
    outputSchema: QueryEmailsOutputSchema,
  },
  async (input: QueryEmailsInput) => {
    if (!input.accessToken) {
      throw new Error("Access token is missing. Cannot query emails from Gmail.");
    }

    // 1. Fetch real emails using the gmailService.
    // The user's query string is passed to Gmail's 'q' parameter for initial filtering.
    const actualEmailsData: FetchedEmailData[] = await fetchGmailMessages(input.accessToken, input.query, 20);

    if (actualEmailsData.length === 0) {
      return { emailList: [] }; // No emails found by Gmail or error during fetch
    }
    
    // 2. Pass the fetched emails and the original user query to the AI prompt for further selection and summarization.
    const { output } = await prompt({
      userQuery: input.query,
      fetchedGmailEmails: actualEmailsData,
    });

    if (!output) {
        console.error("AI prompt did not return an output for queryEmailsFlow.");
        return { emailList: [] }; // Should ideally match schema with empty list
    }
    
    // The AI's output is expected to match QueryEmailsOutputSchema directly.
    return output;
  }
);
