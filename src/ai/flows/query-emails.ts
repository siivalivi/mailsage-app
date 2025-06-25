
'use server';
/**
 * @fileOverview A Genkit flow that uses AI to query a user's Gmail account.
 * This flow orchestrates a multi-step AI process to transform a natural language query
 * into a structured Gmail search, fetches the emails, and then summarizes the results.
 *
 * - queryEmails - The primary exported function that executes the email query process.
 * - QueryEmailsInput - The input type for the queryEmails function.
 * - QueryEmailsOutput - The return type for the queryEmails function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { fetchGmailMessages } from '@/services/gmailService';

// --- Public Input/Output Schemas ---

const QueryEmailsInputSchema = z.object({
  query: z.string().describe('The natural language query to search emails.'),
  accessToken: z
    .string()
    .describe('Google OAuth2 Access Token for Gmail API.'),
});
export type QueryEmailsInput = z.infer<typeof QueryEmailsInputSchema>;

const QueriedEmailAISummarySchema = z.object({
  id: z.string().describe('The Gmail message ID.'),
  sender: z.string().describe('The sender of the email.'),
  subject: z.string().describe('The subject of the email.'),
  snippet: z.string().describe('The original snippet of the email from Gmail.'),
  timestamp: z
    .number()
    .describe('The timestamp (Unix epoch ms) of the email.'),
  summary: z
    .string()
    .describe(
      'A structured and informative AI-generated summary of the email snippet, tailored to the user query.'
    ),
});

const QueryEmailsOutputSchema = z.object({
  emailList: z
    .array(QueriedEmailAISummarySchema)
    .describe(
      'A list of emails, selected and summarized by AI based on the user query.'
    ),
});
export type QueryEmailsOutput = z.infer<typeof QueryEmailsOutputSchema>;

// --- Exported Function ---

export async function queryEmails(
  input: QueryEmailsInput
): Promise<QueryEmailsOutput> {
  try {
    const result = await queryEmailsFlow(input);
    return result;
  } catch (error: any) {
    console.error(
      `[queryEmails] Critical error during flow execution for query "${input.query}". Error:`,
      error
    );
    // Create a user-facing error email
    return {
      emailList: [
        {
          id: 'error-critical-flow-error',
          sender: 'MailSage System',
          subject: 'Error: Failed to Process Query',
          snippet: `An unexpected server error occurred: ${error.message}`,
          timestamp: Date.now(),
          summary:
            'A critical error occurred on the server while trying to process your request.',
        },
      ],
    };
  }
}

// --- Prompt 1: Transform Natural Language to Gmail Query ---
const transformQueryPrompt = ai.definePrompt({
  name: 'transformQueryPrompt',
  input: { schema: z.object({ query: z.string(), currentDate: z.string() }) },
  system: `You are a powerful text-processing utility. Your task is to convert a user's natural language email query into a valid, efficient Gmail API search query string.
- Use the current date ("{{currentDate}}") as a reference for any relative date expressions (e.g., "last week", "month of may").
- Translate keywords into Gmail search operators (e.g., from:, to:, subject:).
- For financial queries mentioning "invoices," "bills," or "charges," broaden the search with terms like '(invoice OR receipt OR bill OR payment)'.
- IMPORTANT: Your response MUST be ONLY the query string itself. Do NOT wrap it in JSON or add any other text.

Example:
User Query: "invoices from Uber last month"
Current Date: 2024-07-23
Output:
from:uber (invoice OR receipt OR bill OR payment) after:2024/06/22 before:2024/07/24

User Query: "{{query}}"
Current Date: {{currentDate}}`,
});

// --- DIAGNOSTIC Main Flow Definition ---

const queryEmailsFlow = ai.defineFlow(
  {
    name: 'queryEmailsFlow',
    inputSchema: QueryEmailsInputSchema,
    outputSchema: QueryEmailsOutputSchema,
  },
  async (flowInput) => {
    const now = new Date();
    const currentDateForLLM = `${now.getFullYear()}-${(now.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

    // STEP 1: Call the AI and do nothing else but log the response.
    console.log('[DIAGNOSTIC PROBE] Calling the AI model...');
    const transformResponse = await transformQueryPrompt({
      query: flowInput.query,
      currentDate: currentDateForLLM,
    });
    
    console.log('----------------------------------------------------');
    console.log('[DIAGNOSTIC PROBE] RAW AI RESPONSE OBJECT:');
    console.log(JSON.stringify(transformResponse, null, 2));
    console.log('----------------------------------------------------');

    // Return a fixed response to the UI to show the test is complete.
    return {
      emailList: [
        {
          id: 'diagnostic-run-complete',
          sender: 'MailSage Diagnostics',
          subject: 'Diagnostic Test Finished',
          snippet: 'The diagnostic test has finished. Please check your server logs for the output from the AI model.',
          timestamp: Date.now(),
          summary: 'Check the server logs for the "RAW AI RESPONSE OBJECT".',
        },
      ],
    };
  }
);
