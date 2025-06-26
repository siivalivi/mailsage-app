
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
import { fetchGmailMessages, FetchedEmailData } from '@/services/gmailService';

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

const GmailQuerySchema = z.object({
  gmailQueryString: z.string().describe("The generated Gmail API query string."),
});

const transformQueryPrompt = ai.definePrompt({
  name: 'transformQueryPrompt',
  input: { schema: z.object({ query: z.string(), currentDate: z.string() }) },
  output: { schema: GmailQuerySchema },
  system: `You are a powerful text-processing utility. Your task is to convert a user's natural language email query into a valid, efficient Gmail API search query string.
- Use the current date ("{{currentDate}}") as a reference for any relative date expressions (e.g., "last week", "month of may").
- Translate keywords into Gmail search operators (e.g., from:, to:, subject:).
- For financial queries mentioning "invoices," "bills," or "charges," broaden the search with terms like '(invoice OR receipt OR bill OR payment)'.
- IMPORTANT: You MUST format your response as a JSON object that conforms to the provided schema.

Example:
User Query: "invoices from Uber last month"
Current Date: 2024-07-23
`,
});

// --- Prompt 2: Refine and Summarize Fetched Emails ---

const RefinedEmailSchema = z.object({
  isRelevant: z.boolean().describe('Set to true if the email is relevant to the original user query, otherwise false.'),
  id: z.string().describe('The original Gmail message ID.'),
  sender: z.string().describe('The original sender of the email.'),
  subject: z.string().describe('The original subject of the email.'),
  snippet: z.string().describe('The original snippet of the email.'),
  timestamp: z.number().describe('The original timestamp of the email.'),
  summary: z.string().describe('A concise, AI-generated summary of the snippet, focusing on aspects relevant to the user query. If not relevant, this can be a brief note.'),
});

const RefineAndSummarizeOutputSchema = z.object({
  refinedEmails: z.array(RefinedEmailSchema),
});


const refineAndSummarizeEmailsPrompt = ai.definePrompt({
  name: 'refineAndSummarizeEmailsPrompt',
  input: { schema: z.object({ query: z.string(), emails: z.array(z.any()) }) }, // Use z.any() for flexibility with FetchedEmailData
  output: { schema: RefineAndSummarizeOutputSchema },
  system: `You are an intelligent email processing agent. Your task is to review a list of emails fetched from Gmail based on a search query.
For EACH email, you must perform two actions:
1.  Relevance Check: Determine if the email's content (snippet) is truly relevant to the user's original query: "{{query}}".
2.  Summarization: If the email is relevant, create a concise, informative summary of its snippet that directly addresses the user's query intent.

User's Original Query: "{{query}}"

Here are the emails to process:
{{#each emails}}
---
Email ID: {{id}}
From: {{sender}}
Subject: {{subject}}
Timestamp: {{timestamp}}
Snippet: "{{snippet}}"
---
{{/each}}

Produce a JSON output containing a 'refinedEmails' array. For EACH email provided above, include an object in the array with the fields 'isRelevant', 'id', 'sender', 'subject', 'snippet', 'timestamp', and 'summary'.
- Only include emails where 'isRelevant' is true in the final user-facing list.
`,
});


// --- Main Flow Definition ---

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

    // STEP 1: Transform natural language query to a Gmail API query string.
    const transformResult = await transformQueryPrompt({
      query: flowInput.query,
      currentDate: currentDateForLLM,
    });

    const transformedQuery = transformResult.output?.gmailQueryString;
    if (!transformedQuery) {
      throw new Error('AI failed to transform the natural language query into a Gmail query string.');
    }
    console.log(`[queryEmailsFlow] AI-generated Gmail query: "${transformedQuery}"`);

    // STEP 2: Fetch emails from Gmail API using the transformed query.
    const emails = await fetchGmailMessages(
      flowInput.accessToken,
      transformedQuery,
      20 // max results
    );

    if (emails.length === 0) {
      console.log('[queryEmailsFlow] No emails found from Gmail API. Returning empty list.');
      return { emailList: [] };
    }
    console.log(`[queryEmailsFlow] Fetched ${emails.length} emails from Gmail. Now refining with AI.`);


    // STEP 3: Use AI to refine and summarize the fetched emails.
    const refineResult = await refineAndSummarizeEmailsPrompt({
        query: flowInput.query,
        emails: emails,
    });
    
    if (!refineResult.output) {
        throw new Error("AI failed to refine and summarize the fetched emails.");
    }
    
    // Filter for relevant emails and map to the final output schema.
    const relevantEmails = refineResult.output.refinedEmails
      .filter(email => email.isRelevant)
      .map(email => ({
        id: email.id,
        sender: email.sender,
        subject: email.subject,
        snippet: email.snippet,
        timestamp: email.timestamp,
        summary: email.summary,
      }));

    console.log(`[queryEmailsFlow] AI refined the list to ${relevantEmails.length} relevant emails.`);
    return { emailList: relevantEmails };
  }
);
