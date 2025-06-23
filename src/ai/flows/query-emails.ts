
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
  accessToken: z.string().describe('Google OAuth2 Access Token for Gmail API.'),
});
export type QueryEmailsInput = z.infer<typeof QueryEmailsInputSchema>;

const QueriedEmailAISummarySchema = z.object({
  id: z.string().describe('The Gmail message ID.'),
  sender: z.string().describe('The sender of the email.'),
  subject: z.string().describe('The subject of the email.'),
  snippet: z.string().describe('The original snippet of the email from Gmail.'),
  timestamp: z.number().describe('The timestamp (Unix epoch ms) of the email.'),
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
  if (!input.accessToken) {
    console.error(
      '[queryEmails EXPORTED_FUNCTION_ERROR] Access token is missing.'
    );
    return {
      emailList: [
        {
          id: 'error-no-access-token',
          sender: 'MailSage System',
          subject: 'Error: Missing Access Token',
          snippet:
            'The application did not provide the necessary authentication token to search Gmail. Please try signing in again.',
          timestamp: Date.now(),
          summary: 'Authentication failed. Cannot connect to Gmail.',
        },
      ],
    };
  }

  try {
    const result = await queryEmailsFlow(input);
    return result;
  } catch (error: any) {
    console.error(
      `[queryEmails EXPORTED_FUNCTION_CRITICAL_ERROR] Critical error during flow execution for query "${input.query}".`,
      error
    );
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
  output: { schema: z.object({ gmailQuery: z.string() }) },
  system: `You are a powerful text-processing utility. Your task is to convert a user's natural language email query into a valid, efficient Gmail API search query string.
- Use the current date ("{{currentDate}}") as a reference for any relative date expressions (e.g., "last week", "month of may").
- Translate keywords into Gmail search operators (e.g., from:, to:, subject:).
- For financial queries mentioning "invoices," "bills," or "charges," broaden the search with terms like '(invoice OR receipt OR bill OR payment)'.
- Return ONLY the query string in the response.

User Query: "{{query}}"
Current Date: {{currentDate}}`,
});

// --- Prompt 2: Refine and Summarize Fetched Emails ---

const refineAndSummarizeEmailsPrompt = ai.definePrompt({
  name: 'refineAndSummarizeEmailsPrompt',
  input: {
    schema: z.object({
      userQuery: z.string(),
      fetchedEmails: z.array(
        z.object({
          id: z.string(),
          sender: z.string(),
          subject: z.string(),
          snippet: z.string(),
          timestamp: z.number(),
        })
      ),
    }),
  },
  output: { schema: QueryEmailsOutputSchema },
  system: `You are an intelligent email analysis assistant. You have been given a list of emails (metadata and snippets) that were fetched from Gmail based on an initial query. Your task is to analyze these results in the context of the user's original query, filter out any irrelevant emails, and generate a concise, helpful summary for each relevant one.

User's original query: "{{userQuery}}"

Analyze the following emails:
{{#each fetchedEmails}}
- Email ID: {{id}}
  - Sender: {{sender}}
  - Subject: {{subject}}
  - Snippet: {{{snippet}}}
---
{{/each}}

Your process:
1.  **Filter:** For each email, decide if its sender, subject, and snippet are truly relevant to the user's original query. Discard promotional content or notifications that don't match the query's intent (e.g., if the user asks for "LinkedIn bills," discard LinkedIn marketing emails).
2.  **Summarize:** For each relevant email, create a concise summary from its snippet that directly addresses what the user was asking for. If the query was financial, extract amounts, dates, and services.
3.  **Format Output:** Return a JSON object containing a list ('emailList') of the relevant, summarized emails. Ensure the output strictly conforms to the required JSON schema. If no emails are relevant, return an empty list.
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
    // Step 1: Convert natural language query to a Gmail API query string.
    console.log('[queryEmailsFlow] Step 1: Transforming query...');
    const now = new Date();
    const currentDateForLLM = `${now.getFullYear()}-${(
      now.getMonth() + 1
    )
      .toString()
      .padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

    const { output: transformOutput } = await transformQueryPrompt({
      query: flowInput.query,
      currentDate: currentDateForLLM,
    });

    const gmailQueryString = transformOutput?.gmailQuery;

    if (!gmailQueryString) {
      console.warn(
        '[queryEmailsFlow] AI failed to generate a Gmail query string. The model may have returned an invalid structure. Response was:', transformOutput
      );
      return { emailList: [] };
    }
    console.log(`[queryEmailsFlow] Step 1 complete. Generated Gmail query: "${gmailQueryString}"`);

    // Step 2: Fetch emails from Gmail using the generated query string.
    console.log('[queryEmailsFlow] Step 2: Fetching emails from Gmail...');
    const fetchedEmails = await fetchGmailMessages(
      flowInput.accessToken,
      gmailQueryString,
      20
    );

    if (fetchedEmails.length === 0) {
      console.log('[queryEmailsFlow] Step 2 complete. No emails found.');
      return { emailList: [] };
    }
    console.log(`[queryEmailsFlow] Step 2 complete. Fetched ${fetchedEmails.length} emails.`);

    // Step 3: Use AI to refine the list and generate summaries.
    console.log('[queryEmailsFlow] Step 3: Refining and summarizing emails...');
    const { output: finalResult } = await refineAndSummarizeEmailsPrompt({
      userQuery: flowInput.query,
      fetchedEmails: fetchedEmails,
    });

    if (!finalResult) {
      console.warn(
        '[queryEmailsFlow] AI failed to refine and summarize the fetched emails into the correct format.'
      );
      return { emailList: [] };
    }
    
    console.log(`[queryEmailsFlow] Step 3 complete. Returning ${finalResult.emailList.length} summarized emails.`);
    return finalResult;
  }
);
