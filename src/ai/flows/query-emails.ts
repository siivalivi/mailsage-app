
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
  try {
    const result = await queryEmailsFlow(input);
    return result;
  } catch (error: any) {
    console.error(
      `[queryEmails EXPORTED_FUNCTION_CRITICAL_ERROR] Critical error during flow execution for query "${input.query}". Error:`,
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
- Your response MUST be a single, valid JSON object string with a single key "gmailQuery".

Example:
User Query: "invoices from Uber last month"
Current Date: 2024-07-23
Output:
'{"gmailQuery": "from:uber (invoice OR receipt OR bill OR payment) after:2024/06/22 before:2024/07/24"}'

User Query: "{{query}}"
Current Date: {{currentDate}}`,
});

// --- Prompt 2: Refine and Summarize Fetched Emails ---
const refineAndSummarizeEmailsPrompt = ai.definePrompt({
  name: 'refineAndSummarizeEmailsPrompt',
  input: {
    schema: z.object({
      userQuery: z.string(),
      emails: z.array(
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
  system: `You are an intelligent email processing agent. Given a user's original query and a list of emails (with snippets) fetched from Gmail, your job is to:
1.  Filter out any emails that are not relevant to the user's query.
2.  For each relevant email, create a concise, one-sentence summary of the snippet that directly addresses the user's intent.
3.  Return a JSON string that conforms to the specified output structure.

User's Original Query: "{{userQuery}}"

Emails to process:
{{#each emails}}
- ID: {{id}}, Sender: {{sender}}, Subject: {{subject}}, Snippet: {{{snippet}}}
{{/each}}

Your response MUST be a single, valid JSON object string that conforms to this structure: { "emailList": [{ "id": "...", "sender": "...", "subject": "...", "snippet": "...", "timestamp": 123, "summary": "..." }] }.
- Include all fields from the original email.
- The "summary" field is your new, AI-generated summary.
- If no emails are relevant, return an empty list: '{"emailList": []}'.
- Do not add any explanatory text before or after the JSON string.`,
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

    // STEP 1: Transform the user's natural language query into a Gmail query string.
    console.log('[queryEmailsFlow] Step 1: Transforming user query to Gmail query.');
    const transformResponse = await transformQueryPrompt({
      query: flowInput.query,
      currentDate: currentDateForLLM,
    });

    const transformText = transformResponse.text;
    if (!transformText) {
      throw new Error('AI failed to generate a query transform string.');
    }
    console.log(`[queryEmailsFlow] Raw transform response text: ${transformText}`);

    let transformData;
    try {
      transformData = JSON.parse(transformText);
    } catch (e) {
      throw new Error(
        `AI failed to return a valid JSON string for the query transform. Raw output: ${transformText}`
      );
    }

    const transformSchema = z.object({ gmailQuery: z.string() });
    const parsedTransform = transformSchema.safeParse(transformData);

    if (!parsedTransform.success) {
      throw new Error(
        `AI returned JSON with an invalid structure for the query transform. Error: ${parsedTransform.error.message}`
      );
    }
    const gmailQuery = parsedTransform.data.gmailQuery;
    console.log(`[queryEmailsFlow] Successfully generated Gmail query: "${gmailQuery}"`);

    // STEP 2: Fetch emails from Gmail using the generated query string.
    console.log('[queryEmailsFlow] Step 2: Fetching emails from Gmail service.');
    const fetchedEmails = await fetchGmailMessages(flowInput.accessToken, gmailQuery);

    if (fetchedEmails.length === 0) {
      console.log('[queryEmailsFlow] No emails found matching the query. Returning empty list.');
      return { emailList: [] };
    }
    console.log(`[queryEmailsFlow] Fetched ${fetchedEmails.length} emails from Gmail.`);

    // STEP 3: Use AI to refine the list and summarize each email's snippet.
    console.log('[queryEmailsFlow] Step 3: Refining and summarizing fetched emails.');
    const refineResponse = await refineAndSummarizeEmailsPrompt({
      userQuery: flowInput.query,
      emails: fetchedEmails,
    });

    const refineText = refineResponse.text;
    if (!refineText) {
      throw new Error('AI failed to generate an email summary string.');
    }
    console.log(`[queryEmailsFlow] Raw summary response text: ${refineText}`);

    let refineData;
    try {
      refineData = JSON.parse(refineText);
    } catch (e) {
      throw new Error(
        `AI failed to return a valid JSON string for the email summary. Raw output: ${refineText}`
      );
    }

    const parsedRefine = QueryEmailsOutputSchema.safeParse(refineData);

    if (!parsedRefine.success) {
      throw new Error(
        `AI returned JSON with an invalid structure for the email summary. Error: ${parsedRefine.error.message}`
      );
    }
    console.log(`[queryEmailsFlow] Successfully refined and summarized ${parsedRefine.data.emailList.length} emails. Flow complete.`);
    return parsedRefine.data;
  }
);
