
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
  summary: z.string().describe('A structured and informative AI-generated summary of the email snippet, tailored to the user query, focusing on financial details if relevant.'),
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
    
    const finalDebugMessages = result.emailList.find(e => e.id.startsWith('diagnostic-'))
      ? result.emailList[0].summary 
      : debugMessages.join('\n');

    debugMessages.push(`[queryEmailsFlow EXPORTED_FUNCTION_SUCCESS] Genkit flow call completed. Returned ${result.emailList.length} email(s).`);
    console.log(`[queryEmailsFlow EXPORTED_FUNCTION_SUCCESS] Successfully returning ${result.emailList.length} emails from Genkit flow. Query: "${input.query}"`);

    if (result.emailList.length === 0 && debugMessages.length > 0) {
      debugMessages.push("[queryEmailsFlow EXPORTED_FUNCTION_INFO] Genkit flow returned an empty email list. Adding diagnostic email.");
      console.log("[queryEmailsFlow EXPORTED_FUNCTION_INFO] Genkit flow returned 0 emails. Preparing diagnostic response based on THIS scope's debugMessages.");
      result.emailList.push({
        id: 'diagnostic-empty-result-from-flow',
        sender: 'MailSage Server Debug',
        subject: `No actual emails processed for query: "${input.query}"`,
        snippet: `Server-Side Diagnostic Information:\n${finalDebugMessages}`, 
        timestamp: diagnosticTimestamp,
        summary: `Server-Side Diagnostic Information:\n${finalDebugMessages}`, 
      });
    } else if (result.emailList.length > 0 && result.emailList[0].id.startsWith('diagnostic-')) {
      console.log("[queryEmailsFlow EXPORTED_FUNCTION_INFO] Genkit flow returned a diagnostic email. Passing it through.");
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

const TransformQueryInputSchema = z.object({
  userQuery: z.string().describe("The user's original natural language query."),
});
const TransformQueryOutputSchema = z.object({
  gmailApiQuery: z.string().describe("A search query string formatted for the Gmail API. This should use Gmail search operators like from:, to:, subject:, after:YYYY/MM/DD, before:YYYY/MM/DD, has:attachment, AND, OR, NOT, parentheses for grouping. For date ranges like 'last week' or 'month of May', convert them to specific after: and before: dates. Assume current year if not specified. For 'month of May YYYY', use after:YYYY/04/30 and before:YYYY/06/01."),
});

const RefineAndSummarizeInputSchema = z.object({
  originalUserQuery: z.string().describe("The user's original natural language query."),
  fetchedGmailEmails: z.array(z.object({
    id: z.string(),
    sender: z.string(),
    subject: z.string(),
    snippet: z.string(),
    timestamp: z.number(),
  })).describe("A list of emails fetched from the user's Gmail based on an AI-generated Gmail API query string (which likely included terms like 'invoice', 'receipt', 'charge', 'payment' if the original query was about financial transactions).")
});


// --- LLM Prompts ---

const transformQueryPrompt = ai.definePrompt({
  name: 'transformQueryToGmailPrompt',
  input: { schema: TransformQueryInputSchema },
  output: { schema: TransformQueryOutputSchema },
  prompt: `You are an expert at converting a user's natural language email search queries into optimized Gmail API search strings.
The user's query is: "{{userQuery}}"

Your task is to generate a Gmail API search query string based on this.
- Use Gmail search operators like from:, to:, subject:, after:YYYY/MM/DD, before:YYYY/MM/DD, has:attachment, boolean operators (AND, OR, NOT), and parentheses for grouping.
- If the query implies a date range (e.g., "last week", "month of May", "in 2023"), convert it to specific 'after:' and 'before:' dates in YYYY/MM/DD format.
  - For "month of [MonthName] [Year]", use 'after:[Year]/[PreviousMonthNumber]/[LastDayOfPreviousMonth]' and 'before:[Year]/[MonthNumberAsMM]/[FirstDayOfNextMonthAsDD]'. For example, "month of May 2024" becomes "after:2024/04/30 before:2024/06/01". For "December 2023", it would be "after:2023/11/30 before:2024/01/01".
  - For "last week", calculate relative to today.
  - If only a month is mentioned (e.g., "in May"), assume the current year unless otherwise specified.
- Focus on extracting key entities (senders, recipients), subject keywords, and date constraints.
- If the user query contains command words like "summarize", "find", "get", "show me", these words are instructions for YOU, not part of the search terms for Gmail. Remove them from the search query.
- If the user query mentions terms related to financial transactions like "charges", "invoices", "receipts", "bills", or "payments", translate these into effective search keywords. For example:
    - "Uber charges" could become "from:uber (invoice OR receipt OR charge OR payment OR e-receipt OR Uber) after:YYYY/MM/DD before:YYYY/MM/DD" if a date is implied. The terms in parentheses should search both subject and body for any of these financial keywords, AND the company name (e.g. "Uber") should also be included as a keyword.
    - "bills from Verizon" could become "from:Verizon (bill OR statement)".
- Combine multiple criteria with AND by default if not specified by OR/NOT. For example, "emails from john about marketing last week" should become "from:john (marketing) after:YYYY/MM/DD before:YYYY/MM/DD".

Example Transformation:
User Query: "Summarize month of May Uber charges"
Ideal Gmail API Query: "from:uber (invoice OR receipt OR charge OR payment OR e-receipt OR Uber) after:2024/04/30 before:2024/06/01"
(Assuming current year is 2024. Adjust year based on current date if not specified. Ensure the company name like 'Uber' is also included if it's a keyword.)

Return ONLY the Gmail API search query string. Do not add any explanation or conversational text.
`,
});

const refineAndSummarizeEmailsPrompt = ai.definePrompt({
  name: 'refineAndSummarizeEmailsPrompt',
  input: { schema: RefineAndSummarizeInputSchema }, 
  output: { schema: QueryEmailsOutputSchema },
  prompt: `You are an AI assistant helping users process emails fetched from their Gmail account.
The user's original natural language query was: "{{originalUserQuery}}"
You have been provided with a list of emails retrieved from Gmail. The Gmail search query used to fetch these emails likely already incorporated keywords related to financial transactions (like "invoice", "receipt", "charge", "payment") if "{{originalUserQuery}}" implied this.

Your tasks are:
1. Review the provided list of emails (ID, sender, subject, date, snippet).
2. For each email, carefully examine its snippet for ANY indication of financial relevance to "{{originalUserQuery}}".
    - Look for keywords such as "invoice", "receipt", "e-receipt", "payment", "charge", "bill", "statement", "order confirmed", "your trip", "total", currency symbols (e.g., $), specific amounts, due dates, or service/product names if they relate to a transaction.
3. If the snippet contains ANY such financial indicators:
    a. Consider this email relevant.
    b. Generate a concise, structured summary FOCUSED ON THE FINANCIAL ASPECTS. Extract and highlight key financial information:
        - Names of people or organizations involved in the transaction.
        - Monetary amounts (total amount, sub-totals, discounts).
        - Specific dates (transaction date, due date, service date).
        - Key items, services, or products mentioned.
        - Payment method details if visible (e.g., last four digits of a card).
        - Any explicit action items or questions related to the transaction.
    c. Present this financial summary in an easy-to-scan format. Use bullet points if appropriate.
    d. The summary should be distinct from the original snippet, adding analytical value specific to the financial query.
4. If an email's snippet is purely promotional, an update, or informational WITHOUT ANY discernible financial transaction details relevant to "{{originalUserQuery}}", then DO NOT include it in your output. For example, if the query is about "Uber charges" and an email is just an ad for a new Uber service with no mention of a past or current charge, exclude it.
5. If no emails from the list are deemed financially relevant after your analysis, return an empty list.
6. If all emails have relevant financial information in their snippets, summarize all of them.

Return a list of these processed emails. Each item in your list should include the original 'id', 'sender', 'subject', 'snippet', 'timestamp', and your newly generated 'summary' focused on financial details.

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
    inputSchema: QueryEmailsInputSchema, 
    outputSchema: QueryEmailsOutputSchema,
  },
  async (flowInput: QueryEmailsInput): Promise<QueryEmailsOutput> => {
    const debugMessages = flowInput._internalDebugMessages || []; 
    const diagnosticTimestamp = Date.now();
    
    const appendDebug = (msg: string) => {
      if (debugMessages && Array.isArray(debugMessages)) {
        debugMessages.push(msg);
      }
      console.log(msg); 
    };

    appendDebug(`[queryEmailsFlow GENKIT_FLOW_RUN_STARTED] Flow execution started. User Query: "${flowInput.query}"`);

    if (!flowInput.accessToken) {
      const errorMsg = "[queryEmailsFlow GENKIT_FLOW_ERROR] Access token is missing within Genkit flow. Cannot query emails from Gmail.";
      appendDebug(errorMsg);
      console.error(errorMsg);
      return {
        emailList: [{
          id: 'diagnostic-flow-no-token',
          sender: 'MailSage Flow Alert',
          subject: 'Flow Error: Missing Access Token',
          snippet: `Server-Side Flow Diagnostic:\n${debugMessages.join('\n')}`,
          timestamp: diagnosticTimestamp,
          summary: `Server-Side Flow Diagnostic:\n${debugMessages.join('\n')}`,
        }],
      };
    }

    // Step 1: Transform user query to Gmail API query string
    appendDebug(`[queryEmailsFlow STEP_1_TRANSFORM_QUERY_CALL] Calling transformQueryPrompt with user query: "${flowInput.query}"`);
    const transformQueryInputForLLM: z.infer<typeof TransformQueryInputSchema> = { userQuery: flowInput.query };
    let gmailApiQueryString = '';
    try {
      const transformResult = await transformQueryPrompt(transformQueryInputForLLM);
      if (!transformResult.output || !transformResult.output.gmailApiQuery) {
        const errorMsg = "[queryEmailsFlow STEP_1_TRANSFORM_QUERY_ERROR] Failed to transform user query to Gmail API query. LLM did not return expected output.";
        appendDebug(errorMsg);
        console.error(errorMsg);
        gmailApiQueryString = flowInput.query; 
        appendDebug(`[queryEmailsFlow STEP_1_TRANSFORM_QUERY_FALLBACK] Using original user query as fallback for Gmail API query: "${gmailApiQueryString}"`);
      } else {
        gmailApiQueryString = transformResult.output.gmailApiQuery;
        appendDebug(`[queryEmailsFlow STEP_1_TRANSFORM_QUERY_RESULT] LLM transformed query to: "${gmailApiQueryString}"`);
      }
    } catch (transformError: any) {
        const errorMsg = `[queryEmailsFlow STEP_1_TRANSFORM_QUERY_EXCEPTION] Exception during transformQueryPrompt: ${transformError.message}`;
        appendDebug(errorMsg);
        console.error(errorMsg, transformError);
        gmailApiQueryString = flowInput.query; 
        appendDebug(`[queryEmailsFlow STEP_1_TRANSFORM_QUERY_FALLBACK_EXCEPTION] Using original user query as fallback for Gmail API query due to exception: "${gmailApiQueryString}"`);
    }

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
    const refineAndSummarizeInputForLLM: z.infer<typeof RefineAndSummarizeInputSchema> = {
      originalUserQuery: flowInput.query,
      fetchedGmailEmails: actualEmailsData,
    };

    appendDebug(`[queryEmailsFlow STEP_3_SUMMARIZE_CALL] Calling refineAndSummarizeEmailsPrompt with originalUserQuery: "${refineAndSummarizeInputForLLM.originalUserQuery}" and ${refineAndSummarizeInputForLLM.fetchedGmailEmails.length} fetched emails.`);
    if (refineAndSummarizeInputForLLM.fetchedGmailEmails.length > 0) {
      appendDebug(`Summarize input (first email if any): ${JSON.stringify(refineAndSummarizeInputForLLM.fetchedGmailEmails[0])}`);
    }
    
    let summarizeResultOutput: QueryEmailsOutput | null = null;
    try {
        const summarizeResult = await refineAndSummarizeEmailsPrompt(refineAndSummarizeInputForLLM);
        if (!summarizeResult.output) {
            const errorMsg = "[queryEmailsFlow STEP_3_SUMMARIZE_ERROR] AI prompt (refineAndSummarize) did not return an output. Returning empty list.";
            appendDebug(errorMsg);
            console.error(errorMsg);
            summarizeResultOutput = { emailList: [] };
        } else {
            summarizeResultOutput = summarizeResult.output;
        }
    } catch (summarizeError: any) {
        const errorMsg = `[queryEmailsFlow STEP_3_SUMMARIZE_EXCEPTION] Exception during refineAndSummarizeEmailsPrompt: ${summarizeError.message}`;
        appendDebug(errorMsg);
        console.error(errorMsg, summarizeError);
        summarizeResultOutput = { emailList: [] }; 
    }

    appendDebug(`[queryEmailsFlow STEP_3_SUMMARIZE_RESULT] Refine/Summarize prompt returned ${summarizeResultOutput.emailList.length} email(s) after processing.`);
    if (summarizeResultOutput.emailList.length > 0) {
        appendDebug(`[queryEmailsFlow STEP_3_SUMMARIZE_OUTPUT_SAMPLE] AI output (first email ID if any): ${summarizeResultOutput.emailList[0].id}, Subject: ${summarizeResultOutput.emailList[0].subject}`);
    } else {
        appendDebug('[queryEmailsFlow STEP_3_SUMMARIZE_NO_EMAILS_POST_PROCESSING] Refine/Summarize prompt returned 0 emails.');
    }

    appendDebug(`[queryEmailsFlow GENKIT_FLOW_EXIT] Returning ${summarizeResultOutput.emailList.length} processed emails from Genkit flow.`);
    return summarizeResultOutput; 
  }
);
