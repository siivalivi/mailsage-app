
'use server';

/**
 * @fileOverview A Genkit flow that uses an AI-powered tool to query a user's Gmail account.
 * This file defines a tool for fetching emails and an agentic flow that uses this tool
 * to understand a user's natural language query, search Gmail, and summarize the results.
 *
 * - queryEmails - The primary exported function that executes the email query process.
 * - QueryEmailsInput - The input type for the queryEmails function.
 * - QueryEmailsOutput - The return type for the queryEmails function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { fetchGmailMessages, type FetchedEmailData } from '@/services/gmailService';

// --- Public Input/Output Schemas (Consistent with the rest of the app) ---

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
  summary: z.string().describe('A structured and informative AI-generated summary of the email snippet, tailored to the user query, focusing on financial details if relevant.'),
});

const QueryEmailsOutputSchema = z.object({
  emailList: z
    .array(QueriedEmailAISummarySchema)
    .describe('A list of real emails, selected and summarized by AI based on the user query.'),
});
export type QueryEmailsOutput = z.infer<typeof QueryEmailsOutputSchema>;


// --- Exported Function ---

export async function queryEmails(input: QueryEmailsInput): Promise<QueryEmailsOutput> {
  console.log(`[queryEmails EXPORTED_FUNCTION_ENTRY] Received query: "${input.query}"`);
  if (!input.accessToken) {
    console.error('[queryEmails EXPORTED_FUNCTION_ERROR] Access token is missing.');
    // Return a structured error that the UI can handle gracefully.
    return {
      emailList: [{
        id: 'diagnostic-no-access-token',
        sender: 'MailSage System',
        subject: 'Error: Missing Access Token',
        snippet: 'The application did not provide the necessary authentication token to search Gmail. Please try signing in again.',
        timestamp: Date.now(),
        summary: 'Authentication failed. Cannot connect to Gmail.',
      }],
    };
  }

  try {
    const result = await queryEmailsFlow(input);
    console.log(`[queryEmails EXPORTED_FUNCTION_SUCCESS] Flow returned ${result.emailList.length} email(s).`);
    return result;
  } catch (error: any) {
    console.error(`[queryEmails EXPORTED_FUNCTION_CRITICAL_ERROR] Critical error during flow execution for query "${input.query}".`, error);
    return {
      emailList: [{
        id: 'diagnostic-critical-flow-error',
        sender: 'MailSage System',
        subject: 'Error: Failed to Process Query',
        snippet: `An unexpected server error occurred: ${error.message}`,
        timestamp: Date.now(),
        summary: 'A critical error occurred on the server while trying to process your request.',
      }],
    };
  }
}

// --- Tool and Flow Definitions ---

// Helper schema for the tool's output, matching the service layer.
const FetchedEmailDataSchema = z.object({
  id: z.string(),
  sender: z.string(),
  subject: z.string(),
  snippet: z.string(),
  timestamp: z.number(),
});


const queryEmailsFlow = ai.defineFlow(
  {
    name: 'queryEmailsFlow',
    inputSchema: QueryEmailsInputSchema,
    outputSchema: QueryEmailsOutputSchema,
  },
  async (flowInput) => {
    
    // Define the tool *inside* the flow so it can securely access the accessToken
    // from the flow's input without exposing it to the LLM prompt.
    const getEmailsTool = ai.defineTool(
      {
        name: 'getEmails',
        description: "Fetches a list of email metadata (sender, subject, snippet, date) from the user's Gmail account based on a provided Gmail API-compatible query string.",
        inputSchema: z.object({
          queryString: z.string().describe("A search query string formatted for the Gmail API. This should use Gmail search operators like from:, to:, subject:, after:YYYY/MM/DD, before:YYYY/MM/DD, has:attachment, AND, OR, NOT, and parentheses for grouping. For example: 'from:uber after:2024/01/01 before:2024/02/01'"),
        }),
        outputSchema: z.array(FetchedEmailDataSchema),
      },
      async (toolInput) => {
        // The tool's implementation securely uses the accessToken from the flow's closure.
        console.log(`[getEmailsTool] Executing with query: "${toolInput.queryString}"`);
        const emails = await fetchGmailMessages(flowInput.accessToken, toolInput.queryString, 20);
        console.log(`[getEmailsTool] Fetched ${emails.length} emails from Gmail.`);
        return emails;
      }
    );

    const now = new Date();
    const currentDateForLLM = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

    // This single, powerful prompt replaces the previous two-step process.
    // It acts as an "agent" that can use the getEmailsTool.
    const mailSageAgent = ai.definePrompt({
        name: 'mailSageAgent',
        tools: [getEmailsTool],
        input: { schema: z.object({ query: z.string(), currentDate: z.string() }) },
        output: { schema: QueryEmailsOutputSchema },
        system: `You are an intelligent email assistant named MailSage. Your goal is to help users find and understand their emails based on their natural language queries.

Your process has three steps:
1.  **FORMULATE GMAIL QUERY:** First, analyze the user's query ("{{query}}") and the current date ("{{currentDate}}"). Convert the user's request into an optimized search query string for the Gmail API.
    -   Use Gmail search operators like from:, to:, subject:, after:YYYY/MM/DD, before:YYYY/MM/DD.
    -   Convert relative dates (e.g., "last week", "month of May") into specific 'after:' and 'before:' dates using "{{currentDate}}" as a reference.
    -   If the query mentions financial terms like "invoices", "bills", or "charges", include keywords like '(invoice OR receipt OR bill OR payment)' in the query string.

2.  **EXECUTE SEARCH:** Once you have formulated the precise Gmail API query string, you MUST use the \`getEmails\` tool to fetch the relevant emails. Do not invent email data or respond without using the tool.

3.  **ANALYZE & SUMMARIZE:** After the tool returns a list of emails, analyze the sender, subject, and snippet of each one.
    -   Filter out any emails that are not relevant to the user's original request.
    -   For each relevant email, generate a concise, helpful summary tailored to the user's query. If the query was about financial transactions, extract key details like amounts, services, and dates into the summary.
    -   Your final output must be a JSON object containing a list of these processed and summarized emails, conforming to the required output schema. If no relevant emails are found, return an empty list.
`,
    });

    console.log('[queryEmailsFlow] Invoking MailSage agent...');
    const agentResponse = await mailSageAgent({ query: flowInput.query, currentDate: currentDateForLLM });
    
    // The prompt is configured to return the final structured output directly.
    return agentResponse.output || { emailList: [] };
  }
);
