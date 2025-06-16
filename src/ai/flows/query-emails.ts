
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
    .describe('A list of real emails, selected and summarized by AI based on their snippets and the user query.'),
});
export type QueryEmailsOutput = z.infer<typeof QueryEmailsOutputSchema>;

export async function queryEmails(input: QueryEmailsInput): Promise<QueryEmailsOutput> {
  // This is the first log in the exported function.
  console.log(`[queryEmailsFlow EXPORTED_FUNCTION_ENTRY] Received input. User Query: "${input.query}", Access Token (first 10 chars): ${input.accessToken ? input.accessToken.substring(0,10) + '...' : 'MISSING'}`);
  
  if (!input.accessToken) {
    const errorMsg = `[queryEmailsFlow EXPORTED_FUNCTION_ERROR] Access token is missing in input. Query: "${input.query}". Cannot query emails.`;
    console.error(errorMsg);
    // For a 502, this might indicate the client sent a bad request, but the server should still ideally respond, not crash.
    // However, if the server *is* crashing, this log might not make it.
    return { emailList: [] }; // Return a default to prevent client breaking if server doesn't crash
  }

  console.log(`[queryEmailsFlow GENKIT_FLOW_RUN] Attempting to call queryEmailsFlow with input. User Query: "${input.query}"`);
  try {
    const result = await queryEmailsFlow(input);
    console.log(`[queryEmailsFlow EXPORTED_FUNCTION_EXIT] Successfully returning ${result.emailList.length} emails from Genkit flow. Query: "${input.query}"`);
    return result;
  } catch (error: any) {
    // This catch block is CRITICAL for diagnosing 502s if the error originates within the Genkit flow
    console.error(`[queryEmailsFlow EXPORTED_FUNCTION_ERROR] CRITICAL ERROR during queryEmailsFlow execution for query "${input.query}". Error: ${error.message}`, error);
    // Log the full error object, including stack if available
    if (error.stack) {
      console.error(`[queryEmailsFlow EXPORTED_FUNCTION_ERROR] Stack trace: ${error.stack}`);
    }
    // It's often better to throw a new error or a more structured error object
    // to the client rather than just the message, but for now, let's ensure server logs it.
    // To prevent a 502 if this catch is hit AND the server doesn't die, return a valid structure.
    return { emailList: [] }; // Or: throw new Error(`Error in queryEmails flow: ${error.message}`); to see if client gets a different error
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

const queryEmailsFlow = ai.defineFlow(
  {
    name: 'queryEmailsFlow',
    inputSchema: QueryEmailsInputSchema,
    outputSchema: QueryEmailsOutputSchema,
  },
  async (input: QueryEmailsInput) => {
    console.log(`[queryEmailsFlow GENKIT_FLOW_RUN] Flow execution started. User Query: "${input.query}"`);
    if (!input.accessToken) {
      console.error("[queryEmailsFlow GENKIT_FLOW_RUN] Access token is missing. Cannot query emails from Gmail.");
      // This should ideally be caught by the wrapper, but defensive check here.
      throw new Error("Access token is missing. Cannot query emails from Gmail.");
    }

    console.log(`[queryEmailsFlow GENKIT_FLOW_RUN] Calling fetchGmailMessages with user query: "${input.query}"`);
    const actualEmailsData: FetchedEmailData[] = await fetchGmailMessages(input.accessToken, input.query, 20);
    console.log(`[queryEmailsFlow GENKIT_FLOW_RUN] fetchGmailMessages returned ${actualEmailsData.length} email(s).`);
    
    if (actualEmailsData.length > 0) {
        console.log('[queryEmailsFlow GENKIT_FLOW_RUN] Data from fetchGmailMessages (first 3 subjects if any):', JSON.stringify(actualEmailsData.slice(0,3).map(e => ({id: e.id, subject: e.subject, snippetLength: e.snippet?.length}))));
    } else {
        console.log('[queryEmailsFlow GENKIT_FLOW_RUN] fetchGmailMessages returned no emails. Returning empty list to client directly (from Genkit flow).');
        return { emailList: [] }; 
    }
    
    const promptInput = {
      userQuery: input.query,
      fetchedGmailEmails: actualEmailsData,
    };
    console.log(`[queryEmailsFlow GENKIT_FLOW_RUN] Calling AI prompt with userQuery: "${input.query}" and ${actualEmailsData.length} fetched emails. Prompt input (first email if any): ${actualEmailsData.length > 0 ? JSON.stringify(promptInput.fetchedGmailEmails[0]) : 'N/A'}`);
    
    const { output } = await prompt(promptInput);

    if (!output) {
        console.error("[queryEmailsFlow GENKIT_FLOW_RUN] AI prompt did not return an output. Returning empty list to client.");
        return { emailList: [] }; 
    }
    
    console.log(`[queryEmailsFlow GENKIT_FLOW_RUN] AI prompt returned ${output.emailList.length} email(s) after processing.`);
    if (output.emailList.length > 0) {
        console.log('[queryEmailsFlow GENKIT_FLOW_RUN] AI output (first 3 subjects from AI if any):', JSON.stringify(output.emailList.slice(0,3).map(e => ({id: e.id, subject: e.subject, summaryLength: e.summary?.length}))));
    } else {
        console.log('[queryEmailsFlow GENKIT_FLOW_RUN] AI prompt returned 0 emails.');
    }
    console.log(`[queryEmailsFlow GENKIT_FLOW_EXIT] Returning ${output.emailList.length} processed emails from Genkit flow.`);
    return output;
  }
);

