
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

export async function queryEmails(input: QueryEmailsInput): Promise<QueryEmailsOutput> {
  let debugMessages: string[] = [];
  const diagnosticTimestamp = Date.now();

  debugMessages.push(`[queryEmailsFlow EXPORTED_FUNCTION_ENTRY] Timestamp: ${new Date(diagnosticTimestamp).toISOString()}`);
  debugMessages.push(`User Query: "${input.query}"`);
  debugMessages.push(`Access Token (first 10 chars): ${input.accessToken ? input.accessToken.substring(0,10) + '...' : 'MISSING_TOKEN'}`);

  // Keep console logs in case they start working in Cloud Logging
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
        snippet: `Diagnostic Info:\n${debugMessages.join('\n')}`,
        timestamp: diagnosticTimestamp,
        summary: `Diagnostic Info:\n${debugMessages.join('\n')}`,
      }],
    };
  }

  debugMessages.push(`[queryEmailsFlow GENKIT_FLOW_RUN_ATTEMPT] Attempting to call internal queryEmailsFlow.`);
  console.log(`[queryEmailsFlow GENKIT_FLOW_RUN_ATTEMPT] Attempting to call queryEmailsFlow with input. User Query: "${input.query}"`);

  try {
    const result = await queryEmailsFlow(input, debugMessages); // Pass debugMessages to be appended by the flow
    debugMessages.push(`[queryEmailsFlow EXPORTED_FUNCTION_SUCCESS] Genkit flow call completed. Returned ${result.emailList.length} email(s).`);
    console.log(`[queryEmailsFlow EXPORTED_FUNCTION_SUCCESS] Successfully returning ${result.emailList.length} emails from Genkit flow. Query: "${input.query}"`);

    if (result.emailList.length === 0) {
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

const prompt = ai.definePrompt({
  name: 'queryEmailsPrompt',
  input: { schema: z.object({
    userQuery: z.string().describe("The user's original natural language query."),
    fetchedGmailEmails: z.array(z.object({
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

// Modified queryEmailsFlow to accept and append to debugMessages
const queryEmailsFlow = ai.defineFlow(
  {
    name: 'queryEmailsFlow',
    inputSchema: QueryEmailsInputSchema, // Input schema remains the same for the flow itself
    outputSchema: QueryEmailsOutputSchema,
  },
  async (input: QueryEmailsInput, debugMessages?: string[]): Promise<QueryEmailsOutput> => {
    const appendDebug = (msg: string) => {
      if (debugMessages) debugMessages.push(msg);
      console.log(msg); // Keep console logs
    };

    appendDebug(`[queryEmailsFlow GENKIT_FLOW_RUN_STARTED] Flow execution started. User Query: "${input.query}"`);
    if (!input.accessToken) {
      const errorMsg = "[queryEmailsFlow GENKIT_FLOW_ERROR] Access token is missing within Genkit flow. Cannot query emails from Gmail.";
      appendDebug(errorMsg);
      console.error(errorMsg); // Use console.error for actual errors
      // The calling function will handle creating a diagnostic email for this case.
      // Throwing error here will be caught by the outer try-catch.
      throw new Error("Access token is missing in Genkit flow. Cannot query emails from Gmail.");
    }

    appendDebug(`[queryEmailsFlow GENKIT_FLOW_GMAIL_CALL] Calling fetchGmailMessages with user query: "${input.query}"`);
    const actualEmailsData: FetchedEmailData[] = await fetchGmailMessages(input.accessToken, input.query, 20);
    appendDebug(`[queryEmailsFlow GENKIT_FLOW_GMAIL_RESULT] fetchGmailMessages returned ${actualEmailsData.length} email(s).`);

    if (actualEmailsData.length > 0) {
        appendDebug(`[queryEmailsFlow GENKIT_FLOW_GMAIL_DATA_SAMPLE] Data from fetchGmailMessages (first email if any): ${JSON.stringify(actualEmailsData[0])}`);
        console.log('[queryEmailsFlow GENKIT_FLOW_GMAIL_DATA_SAMPLE] Data from fetchGmailMessages (first 3 subjects if any):', JSON.stringify(actualEmailsData.slice(0,3).map(e => ({id: e.id, subject: e.subject, snippetLength: e.snippet?.length}))));
    } else {
        appendDebug('[queryEmailsFlow GENKIT_FLOW_GMAIL_NO_EMAILS] fetchGmailMessages returned no emails. Returning empty list (from Genkit flow).');
        console.log('[queryEmailsFlow GENKIT_FLOW_GMAIL_NO_EMAILS] fetchGmailMessages returned no emails. Returning empty list to client directly (from Genkit flow).');
        return { emailList: [] };
    }

    const promptInput = {
      userQuery: input.query,
      fetchedGmailEmails: actualEmailsData,
    };
    appendDebug(`[queryEmailsFlow GENKIT_FLOW_AI_PROMPT_CALL] Calling AI prompt with userQuery: "${input.query}" and ${actualEmailsData.length} fetched emails.`);
    if (actualEmailsData.length > 0) {
      appendDebug(`Prompt input (first email if any): ${JSON.stringify(promptInput.fetchedGmailEmails[0])}`);
    }
    console.log(`[queryEmailsFlow GENKIT_FLOW_AI_PROMPT_CALL] Calling AI prompt with userQuery: "${input.query}" and ${actualEmailsData.length} fetched emails. Prompt input (first email if any): ${actualEmailsData.length > 0 ? JSON.stringify(promptInput.fetchedGmailEmails[0]) : 'N/A'}`);

    const { output } = await prompt(promptInput);

    if (!output) {
        const errorMsg = "[queryEmailsFlow GENKIT_FLOW_AI_NO_OUTPUT_ERROR] AI prompt did not return an output. Returning empty list.";
        appendDebug(errorMsg);
        console.error(errorMsg);
        return { emailList: [] };
    }

    appendDebug(`[queryEmailsFlow GENKIT_FLOW_AI_PROMPT_RESULT] AI prompt returned ${output.emailList.length} email(s) after processing.`);
    if (output.emailList.length > 0) {
        appendDebug(`[queryEmailsFlow GENKIT_FLOW_AI_OUTPUT_SAMPLE] AI output (first email ID if any): ${output.emailList[0].id}, Subject: ${output.emailList[0].subject}`);
        console.log('[queryEmailsFlow GENKIT_FLOW_AI_OUTPUT_SAMPLE] AI output (first 3 subjects from AI if any):', JSON.stringify(output.emailList.slice(0,3).map(e => ({id: e.id, subject: e.subject, summaryLength: e.summary?.length}))));
    } else {
        appendDebug('[queryEmailsFlow GENKIT_FLOW_AI_NO_EMAILS_POST_PROCESSING] AI prompt returned 0 emails.');
        console.log('[queryEmailsFlow GENKIT_FLOW_AI_NO_EMAILS_POST_PROCESSING] AI prompt returned 0 emails.');
    }
    appendDebug(`[queryEmailsFlow GENKIT_FLOW_EXIT] Returning ${output.emailList.length} processed emails from Genkit flow.`);
    console.log(`[queryEmailsFlow GENKIT_FLOW_EXIT] Returning ${output.emailList.length} processed emails from Genkit flow.`);
    return output;
  }
);
