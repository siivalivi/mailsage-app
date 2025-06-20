
'use server';

/**
 * @fileOverview A flow that allows users to query their REAL emails using natural language.
 * It first translates the natural language query into a Gmail API search string,
 * then fetches emails, and finally summarizes the relevant email snippets.
 *
 * - queryEmails - A function that handles the email querying process.
 * - QueryEmailsInput - The input type for the queryEmails function.
 * - QueryEmailsOutput - The return type for the queryEmails function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { fetchGmailMessages, type FetchedEmailData } from '@/services/gmailService';

const QueryEmailsInputSchema = z.object({
  query: z.string().describe('The natural language query to search emails.'),
  accessToken: z.string().describe('Google OAuth2 Access Token for Gmail API.'),
  _internalDebugMessages: z.array(z.string()).optional().describe('Internal: For passing debug messages through the flow. Not for LLM.'),
});
export type QueryEmailsInput = z.infer<typeof QueryEmailsInputSchema>;

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
    .describe('A list of real emails, selected and summarized by AI based on their snippets and the user query, or a diagnostic message if no emails are found/processed.'),
});
export type QueryEmailsOutput = z.infer<typeof QueryEmailsOutputSchema>;

// --- Exported Function ---
export async function queryEmails(input: Omit<QueryEmailsInput, '_internalDebugMessages'>): Promise<QueryEmailsOutput> {
  let debugMessages: string[] = [];
  const diagnosticTimestamp = Date.now();

  debugMessages.push(`[queryEmailsFlow EXPORTED_FUNCTION_ENTRY] Timestamp: ${new Date(diagnosticTimestamp).toISOString()}`);
  debugMessages.push(`User Query: "${input.query}"`);
  debugMessages.push(`Access Token (first 10 chars): ${input.accessToken ? input.accessToken.substring(0,10) + '...' : 'MISSING_TOKEN'}`);
  console.log(`[queryEmailsFlow EXPORTED_FUNCTION_ENTRY] Received input. User Query: "${input.query}", Access Token (first 10 chars): ${input.accessToken ? input.accessToken.substring(0,10) + '...' : 'MISSING'}`);

  if (!input.accessToken) {
    const errorMsg = `[queryEmailsFlow EXPORTED_FUNCTION_ERROR] Access token is missing. Query: "${input.query}". Cannot query emails.`;
    console.error(errorMsg);
    debugMessages.push(errorMsg);
    return {
      emailList: [{
        id: 'diagnostic-no-access-token',
        sender: 'MailSage System Alert',
        subject: 'Server Error: Missing Access Token',
        snippet: `Server-Side Diagnostic Information:\n${debugMessages.join('\n')}`,
        timestamp: diagnosticTimestamp,
        summary: `Server-Side Diagnostic Information:\n${debugMessages.join('\n')}`,
      }],
    };
  }

  debugMessages.push(`[queryEmailsFlow GENKIT_FLOW_RUN_ATTEMPT] Attempting to call internal queryEmailsFlow.`);
  console.log(`[queryEmailsFlow GENKIT_FLOW_RUN_ATTEMPT] Attempting to call queryEmailsFlow with input. User Query: "${input.query}"`);

  try {
    const flowInputWithDebug: QueryEmailsInput = { ...input, _internalDebugMessages: debugMessages };
    const result = await queryEmailsFlow(flowInputWithDebug);
    
    debugMessages.push(`[queryEmailsFlow EXPORTED_FUNCTION_SUCCESS] Genkit flow call completed. Returned ${result.emailList.length} email(s).`);
    console.log(`[queryEmailsFlow EXPORTED_FUNCTION_SUCCESS] Successfully returning ${result.emailList.length} emails from Genkit flow. Query: "${input.query}"`);

    if (result.emailList.length === 0 && debugMessages.length > 0) {
      debugMessages.push("[queryEmailsFlow EXPORTED_FUNCTION_INFO] Genkit flow returned an empty email list. Adding diagnostic email.");
      console.log("[queryEmailsFlow EXPORTED_FUNCTION_INFO] Genkit flow returned 0 emails. Preparing diagnostic response.");
      result.emailList.push({
        id: 'diagnostic-empty-result-from-flow',
        sender: 'MailSage Server Debug',
        subject: `No actual emails processed for query: "${input.query}"`,
        snippet: `Server-Side Diagnostic Information:\n${debugMessages.join('\n')}`,
        timestamp: diagnosticTimestamp,
        summary: `Server-Side Diagnostic Information:\n${debugMessages.join('\n')}`,
      });
    }
    return result;
  } catch (error: any) {
    const errorMsg = `[queryEmailsFlow EXPORTED_FUNCTION_CRITICAL_ERROR] CRITICAL ERROR during queryEmailsFlow execution for query "${input.query}".`;
    console.error(errorMsg, error);
    if (error.stack) {
      console.error(`[queryEmailsFlow EXPORTED_FUNCTION_CRITICAL_ERROR] Stack trace: ${error.stack}`);
    }
    debugMessages.push(errorMsg);
    debugMessages.push(`Error Type: ${error.name}, Message: ${error.message}`);
    if (error.stack) debugMessages.push(`Stack: ${error.stack}`);

    return {
      emailList: [{
        id: 'diagnostic-critical-server-error',
        sender: 'MailSage System Alert',
        subject: 'Critical Server Error Occurred',
        snippet: `Server-Side Diagnostic Information (Error):\n${debugMessages.join('\n')}`,
        timestamp: diagnosticTimestamp,
        summary: `Server-Side Diagnostic Information (Error):\n${debugMessages.join('\n')}`,
      }],
    };
  }
}

// --- Schemas for LLM Prompts ---

// Schema for the first LLM call (transforming user query to Gmail API query)
const TransformQueryInputSchema = z.object({
  userQuery: z.string().describe("The user's original natural language query."),
});
const TransformQueryOutputSchema = z.object({
  gmailApiQuery: z.string().describe("A search query string formatted for the Gmail API. This should use Gmail search operators like from:, to:, subject:, after:YYYY/MM/DD, before:YYYY/MM/DD, has:attachment, AND, OR, NOT, parentheses for grouping. For date ranges like 'last week' or 'month of May', convert them to specific after: and before: dates. Assume current year if not specified. For 'month of May YYYY', use after:YYYY/04/30 and before:YYYY/06/01."),
});

// Schema for the second LLM call (refining selection and summarizing snippets)
const RefineAndSummarizeInputSchema = z.object({
  originalUserQuery: z.string().describe("The user's original natural language query."),
  fetchedGmailEmails: z.array(z.object({
    id: z.string(),
    sender: z.string(),
    subject: z.string(),
    snippet: z.string(),
    timestamp: z.number(),
  })).describe("A list of emails fetched from the user's Gmail based on an AI-generated Gmail API query string.")
});


// --- LLM Prompts ---

// Prompt 1: Transform user's natural language query to a Gmail API search string
const transformQueryPrompt = ai.definePrompt({
  name: 'transformQueryToGmailPrompt',
  input: { schema: TransformQueryInputSchema },
  output: { schema: TransformQueryOutputSchema },
  prompt: `You are an expert at converting a user's natural language email search queries into optimized Gmail API search strings.
The user's query is: "{{userQuery}}"

Your task is to generate a Gmail API search query string based on this.
- Use Gmail search operators like from:, to:, subject:, after:YYYY/MM/DD, before:YYYY/MM/DD, has:attachment, boolean operators (AND, OR, NOT), and parentheses for grouping.
- If the query implies a date range (e.g., "last week", "month of May", "in 2023"), convert it to specific 'after:' and 'before:' dates in YYYY/MM/DD format.
  - For "month of [MonthName] [Year]", use 'after:[Year]/[PreviousMonthNumber]/[LastDayOfPreviousMonth]' and 'before:[Year]/[MonthNumber]/[FirstDayOfNextMonth]'. For example, "month of May 2024" becomes "after:2024/04/30 before:2024/06/01".
  - For "last week", calculate relative to today.
  - If only a month is mentioned (e.g., "in May"), assume the current year unless otherwise specified.
- Focus on extracting key entities, senders, recipients, subject keywords, and date constraints.
- If the user query is vague or seems like a command (e.g., "summarize..."), try to extract searchable terms. For "Summarize month of May Uber charges", focus on "month of May Uber charges" for search terms.

Return ONLY the Gmail API search query string. Do not add any explanation or conversational text.
`,
});


// Prompt 2: Refine selection from fetched emails and summarize snippets
const refineAndSummarizeEmailsPrompt = ai.definePrompt({
  name: 'refineAndSummarizeEmailsPrompt',
  input: { schema: RefineAndSummarizeInputSchema }, 
  output: { schema: QueryEmailsOutputSchema }, // Output is the final list of summarized emails
  prompt: `You are an AI assistant helping users to process emails fetched from their Gmail account.
You have been provided with a list of emails retrieved from Gmail based on an AI-generated search term.
The user's original natural language query was: "{{originalUserQuery}}"

Your tasks are:
1. Review the provided list of emails (ID, sender, subject, date, snippet).
2. Even though an AI generated the search query for Gmail, further refine the selection if needed based on the user's specific original query details "{{originalUserQuery}}". For example, if the user asked for "emails from John about marketing last week" and some emails from John about other topics were fetched, you should focus on the marketing ones.
3. For each email you deem relevant to "{{originalUserQuery}}", generate a concise, structured summary based on its snippet. This summary should:
    - Extract and highlight key information such as names of people or organizations, monetary amounts, specific dates or deadlines, and locations if present in the snippet.
    - Clearly list any explicit action items or questions directed at the recipient if discernible from the snippet.
    - If the snippet suggests a bill, receipt, or financial statement, make sure to summarize the total amount, key items or services, and payment due dates if mentioned. Include details like the last four digits of a payment method if it's part of a financial confirmation visible in the snippet.
    - Present information in an easy-to-scan format. Use bullet points for lists, action items, or breakdowns where appropriate.
    - Aim for a balance between brevity and completeness of critical information from the snippet.
    - The summary should be distinct from the original snippet, adding analytical value.
4. If an email from the provided list does not seem relevant to the user's specific original query "{{originalUserQuery}}", DO NOT include it in your output.
5. If no emails from the list are relevant after your analysis, return an empty list.
6. If all emails are relevant, summarize all of them.

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

// --- Genkit Flow Definition ---
const queryEmailsFlow = ai.defineFlow(
  {
    name: 'queryEmailsFlow',
    inputSchema: QueryEmailsInputSchema, // Flow input includes _internalDebugMessages
    outputSchema: QueryEmailsOutputSchema,
  },
  async (flowInput: QueryEmailsInput): Promise<QueryEmailsOutput> => {
    // Use the passed debugMessages array from flowInput
    const debugMessages = flowInput._internalDebugMessages || []; 
    
    const appendDebug = (msg: string) => {
      if (debugMessages && Array.isArray(debugMessages)) {
        debugMessages.push(msg);
      }
      console.log(msg); // Keep console logs for cloud logging
    };

    appendDebug(`[queryEmailsFlow GENKIT_FLOW_RUN_STARTED] Flow execution started. User Query: "${flowInput.query}"`);

    if (!flowInput.accessToken) {
      const errorMsg = "[queryEmailsFlow GENKIT_FLOW_ERROR] Access token is missing within Genkit flow. Cannot query emails from Gmail.";
      appendDebug(errorMsg);
      console.error(errorMsg);
      return { emailList: [] };
    }

    // Step 1: Transform user query to Gmail API query string
    appendDebug(`[queryEmailsFlow STEP_1_TRANSFORM_QUERY_CALL] Calling transformQueryPrompt with user query: "${flowInput.query}"`);
    const transformQueryInput: z.infer<typeof TransformQueryInputSchema> = { userQuery: flowInput.query };
    const transformResult = await transformQueryPrompt(transformQueryInput);

    if (!transformResult.output || !transformResult.output.gmailApiQuery) {
      const errorMsg = "[queryEmailsFlow STEP_1_TRANSFORM_QUERY_ERROR] Failed to transform user query to Gmail API query. LLM did not return expected output.";
      appendDebug(errorMsg);
      console.error(errorMsg);
      return { emailList: [] };
    }
    const gmailApiQueryString = transformResult.output.gmailApiQuery;
    appendDebug(`[queryEmailsFlow STEP_1_TRANSFORM_QUERY_RESULT] LLM transformed query to: "${gmailApiQueryString}"`);

    // Step 2: Fetch emails from Gmail using the transformed query
    appendDebug(`[queryEmailsFlow STEP_2_GMAIL_CALL] Calling fetchGmailMessages with AI-generated query: "${gmailApiQueryString}"`);
    const actualEmailsData: FetchedEmailData[] = await fetchGmailMessages(flowInput.accessToken, gmailApiQueryString, 20, debugMessages);
    appendDebug(`[queryEmailsFlow STEP_2_GMAIL_RESULT] fetchGmailMessages returned ${actualEmailsData.length} email(s) using AI-generated query.`);

    if (actualEmailsData.length === 0) {
        appendDebug('[queryEmailsFlow STEP_2_GMAIL_NO_EMAILS] fetchGmailMessages returned no emails with AI-generated query. Returning empty list.');
        return { emailList: [] };
    }
    if (actualEmailsData.length > 0) {
        appendDebug(`[queryEmailsFlow STEP_2_GMAIL_DATA_SAMPLE] Data from fetchGmailMessages (first email if any): ${JSON.stringify(actualEmailsData[0])}`);
    }

    // Step 3: Refine selection and summarize email snippets
    const refineAndSummarizeInput: z.infer<typeof RefineAndSummarizeInputSchema> = {
      originalUserQuery: flowInput.query, // Pass the original user query for context
      fetchedGmailEmails: actualEmailsData,
    };

    appendDebug(`[queryEmailsFlow STEP_3_SUMMARIZE_CALL] Calling refineAndSummarizeEmailsPrompt with originalUserQuery: "${refineAndSummarizeInput.originalUserQuery}" and ${refineAndSummarizeInput.fetchedGmailEmails.length} fetched emails.`);
    if (refineAndSummarizeInput.fetchedGmailEmails.length > 0) {
      appendDebug(`Summarize input (first email if any): ${JSON.stringify(refineAndSummarizeInput.fetchedGmailEmails[0])}`);
    }

    const summarizeResult = await refineAndSummarizeEmailsPrompt(refineAndSummarizeInput);

    if (!summarizeResult.output) {
        const errorMsg = "[queryEmailsFlow STEP_3_SUMMARIZE_ERROR] AI prompt (refineAndSummarize) did not return an output. Returning empty list.";
        appendDebug(errorMsg);
        console.error(errorMsg);
        return { emailList: [] };
    }

    appendDebug(`[queryEmailsFlow STEP_3_SUMMARIZE_RESULT] Refine/Summarize prompt returned ${summarizeResult.output.emailList.length} email(s) after processing.`);
    if (summarizeResult.output.emailList.length > 0) {
        appendDebug(`[queryEmailsFlow STEP_3_SUMMARIZE_OUTPUT_SAMPLE] AI output (first email ID if any): ${summarizeResult.output.emailList[0].id}, Subject: ${summarizeResult.output.emailList[0].subject}`);
    } else {
        appendDebug('[queryEmailsFlow STEP_3_SUMMARIZE_NO_EMAILS_POST_PROCESSING] Refine/Summarize prompt returned 0 emails.');
    }

    appendDebug(`[queryEmailsFlow GENKIT_FLOW_EXIT] Returning ${summarizeResult.output.emailList.length} processed emails from Genkit flow.`);
    return summarizeResult.output;
  }
);
