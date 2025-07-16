

/**
 * @fileOverview A Genkit flow that uses an AI agent with tools to query a user's Gmail account.
 * This "agentic" flow presents the AI with a set of specialized tools, and the AI reasons
 * which tool is most appropriate to handle the user's natural language query. It then uses
 * that tool to generate a structured Gmail search, fetches the emails, and summarizes the results.
 *
 * - queryEmails - The primary exported function that executes the email query process.
 * - QueryEmailsInput - The input type for the queryEmails function.
 * - QueryEmailsOutput - The return type for the queryEmails function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { fetchGmailMessages, FetchedEmailData } from '@/services/gmailService';

// --- Public Input/Output Schemas (Unchanged) ---

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
  emailList: z.array(QueriedEmailAISummarySchema),
});
export type QueryEmailsOutput = z.infer<typeof QueryEmailsOutputSchema>;

// --- Schemas for AI responses and Tools ---

const GmailQuerySchema = z.object({
  gmailQueryString: z.string().describe('The generated Gmail API query string.'),
});

const RefinedEmailSchema = z.object({
  isRelevant: z
    .boolean()
    .describe(
      'Set to true if the email is relevant to the original user query, otherwise false.'
    ),
  id: z.string().describe('The original Gmail message ID.'),
  sender: z.string().describe('The original sender of the email.'),
  subject: z.string().describe('The original subject of the email.'),
  snippet: z.string().describe('The original snippet of the email.'),
  timestamp: z.number().describe('The original timestamp of the email.'),
  summary: z
    .string()
    .describe(
      'A concise, AI-generated summary of the snippet, focusing on aspects relevant to the user query. If not relevant, this can be a brief note.'
    ),
});

const RefineAndSummarizeOutputSchema = z.object({
  refinedEmails: z.array(RefinedEmailSchema),
});

// --- Exported Function (Unchanged public signature) ---

export async function queryEmails(
  input: QueryEmailsInput
): Promise<QueryEmailsOutput> {
  try {
    const result = await queryEmailsFlow(input);
    if (!result) {
      throw new Error('Flow returned no result.');
    }
    return result;
  } catch (error: any) {
    console.error(
      `[queryEmails] Critical error during agentic flow execution for query "${input.query}". Error:`,
      error
    );
    // Create a user-friendly error to display in the UI
    const friendlyMessage = error.message && error.message.includes('Schema validation failed') 
      ? `The AI agent failed to understand the query. Please try rephrasing your request.`
      : `An unexpected server error occurred: ${error.message}`;
      
    throw new Error(friendlyMessage);
  }
}

// --- Specialized Prompts (The "Skills" for our Tools) ---

const now = new Date();
const currentDateForLLM = `${now.getFullYear()}-${(now.getMonth() + 1)
  .toString()
  .padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

const commonPromptInstructions = `
You are a powerful text-processing utility. Your task is to convert a user's natural language email query into a valid, efficient Gmail API search query string.
- The user's query is: "{{query}}"
- The current date is: "${currentDateForLLM}". Use this as the reference for all relative date calculations.
- For date ranges like "this month" or "last two months", you MUST calculate the start and end dates and use the format 'after:YYYY/MM/DD before:YYYY/MM/DD'.
- If a specific sender is mentioned (e.g., from:uber, from:hotels.com), you MUST include it in the query using the 'from:' operator.
- If no specific sender is mentioned, use keywords from the query.
- Your final output MUST be a single JSON object conforming to the required schema: { "gmailQueryString": "your_generated_query" }.
- Do not add any extra explanations or text outside of the JSON object.
`;

const billingTransformPrompt = ai.definePrompt({
  name: 'billingTransformPrompt',
  output: { schema: GmailQuerySchema },
  prompt: `${commonPromptInstructions}
This is a BILLING query. Focus on financial terms.
- For broad billing queries, consider using terms like '(invoice OR receipt OR bill OR payment OR charge OR order)'.
- Combine these with any specific senders or date ranges from the user's query.`,
});

const travelTransformPrompt = ai.definePrompt({
  name: 'travelTransformPrompt',
  output: { schema: GmailQuerySchema },
  prompt: `${commonPromptInstructions}
This is a TRAVEL query. Focus on booking and itinerary terms.
- For broad travel queries, consider using terms like '(flight OR hotel OR car rental OR confirmation OR booking OR itinerary)'.
- Combine these with any specific travel companies, airlines, or hotel names mentioned in the user's query.`,
});

const promotionsTransformPrompt = ai.definePrompt({
  name: 'promotionsTransformPrompt',
  output: { schema: GmailQuerySchema },
  prompt: `${commonPromptInstructions}
This is a PROMOTIONS query. Focus on marketing and sales terms.
- Search for terms like '(sale OR discount OR offer OR % off OR coupon)'.
- If the query is general, consider adding 'category:promotions' to the search.
- Combine these with any specific senders or date ranges from the user's query.`,
});

const generalTransformPrompt = ai.definePrompt({
  name: 'generalTransformPrompt',
  output: { schema: GmailQuerySchema },
  prompt: `${commonPromptInstructions}
This is a GENERAL query. Perform a standard keyword translation.
- Extract the key nouns, verbs, and proper nouns from the user's query.
- Combine these with any specified date ranges.`,
});

// --- Agentic Tools ---

const toolInputSchema = z.object({ query: z.string().describe("The user's original, natural language query.") });

const billingTool = ai.defineTool({
    name: 'createBillingSearchQuery',
    description: 'Use for queries about billing, invoices, receipts, payments, charges, or orders.',
    inputSchema: toolInputSchema,
    outputSchema: GmailQuerySchema
  }, async (input) => {
    const response = await billingTransformPrompt(input);
    if (!response.output) {
      throw new Error("The AI subsystem for billing queries failed to generate a search string.");
    }
    return response.output;
  });

const travelTool = ai.defineTool({
    name: 'createTravelSearchQuery',
    description: 'Use for queries about travel, flights, hotels, car rentals, bookings, or itineraries.',
    inputSchema: toolInputSchema,
    outputSchema: GmailQuerySchema
  }, async (input) => {
    const response = await travelTransformPrompt(input);
    if (!response.output) {
      throw new Error("The AI subsystem for travel queries failed to generate a search string.");
    }
    return response.output;
  });

const promotionsTool = ai.defineTool({
    name: 'createPromotionsSearchQuery',
    description: 'Use for queries about promotions, sales, discounts, offers, or coupons.',
    inputSchema: toolInputSchema,
    outputSchema: GmailQuerySchema
  }, async (input) => {
    const response = await promotionsTransformPrompt(input);
    if (!response.output) {
      throw new Error("The AI subsystem for promotions queries failed to generate a search string.");
    }
    return response.output;
  });

const generalTool = ai.defineTool({
    name: 'createGeneralSearchQuery',
    description: 'Use for all other queries that do not fit into billing, travel, or promotions.',
    inputSchema: toolInputSchema,
    outputSchema: GmailQuerySchema
  }, async (input) => {
    const response = await generalTransformPrompt(input);
    if (!response.output) {
      throw new Error("The AI subsystem for general queries failed to generate a search string.");
    }
    return response.output;
  });


// --- Main Agentic Flow ---

const queryEmailsFlow = ai.defineFlow(
  {
    name: 'queryEmailsFlow',
    inputSchema: QueryEmailsInputSchema,
    outputSchema: QueryEmailsOutputSchema,
  },
  async (flowInput) => {
    // STEP 1: Invoke an agent with tools to generate the query string.
    console.log('[queryEmailsFlow] Step 1: Invoking agent to generate Gmail query via tool use.');

    const agentPrompt = `You are a highly intelligent email search query router. Your primary function is to analyze a user's natural language query and determine the most appropriate category for the search: "billing", "travel", "promotions", or "general".

Based on your analysis, you must select and invoke the single most relevant tool to generate a syntactically correct Gmail search query string.

The user's query is: "${flowInput.query}"

Pass this query to the chosen tool. The tool will handle the transformation.`;

    const agentResponse = await ai.generate({
      prompt: agentPrompt,
      tools: [billingTool, travelTool, promotionsTool, generalTool],
      output: { schema: GmailQuerySchema },
    });

    const transformedQuery = agentResponse.output?.gmailQueryString;

    if (!transformedQuery) {
      throw new Error(
        'Agent failed to generate a query string using tools. The model response was empty or invalid.'
      );
    }
    console.log(
      `[queryEmailsFlow] Agent-generated Gmail query: "${transformedQuery}"`
    );

    // STEP 2: Fetch emails from Gmail API using the transformed query.
    const emails: FetchedEmailData[] = await fetchGmailMessages(
      flowInput.accessToken,
      transformedQuery,
      20 // max results
    );

    if (emails.length === 0) {
      console.log('[queryEmailsFlow] No emails found from Gmail API. Returning empty list.');
      return { emailList: [] };
    }
    console.log(`[queryEmailsFlow] Fetched ${emails.length} emails. Now refining with AI.`);

    // STEP 3: Use AI to refine and summarize the fetched emails.
    const emailsToProcessString = emails.map(email => `---
      Email ID: ${email.id}
      From: ${email.sender}
      Subject: ${email.subject}
      Timestamp: ${email.timestamp}
      Snippet: "${email.snippet}"
      ---`).join('\n');

    const refinePrompt = `You are an intelligent email processing agent. Your task is to process a list of emails retrieved from a Gmail search. For EACH email provided below, you must perform two tasks:

1.  **Relevance Check**: Determine if the email is truly relevant to the user's original query. The initial Gmail search can sometimes be too broad.
2.  **Summarization**: Create a concise summary of the email snippet that directly addresses the user's query.

**CRITICAL INSTRUCTIONS:**
- Your final output MUST be a JSON object with a single key: 'refinedEmails'.
- The 'refinedEmails' key must contain an array of objects.
- This array MUST contain an object for EVERY single email provided in the input. **DO NOT OMIT ANY EMAILS.**
- For each email, you must set the 'isRelevant' boolean field. Set it to \`true\` if the email's content (sender, subject, snippet) directly matches the user's request. Otherwise, set it to \`false\`.
- Even if an email is not relevant, you must still include it in the output array with \`isRelevant: false\` and provide a brief summary explaining why it was not relevant (e.g., "This is a marketing email, not a bill.").

User's Original Query: "${flowInput.query}"

Here are the emails to process:
${emailsToProcessString}`;

    const refineResponse = await ai.generate({
      prompt: refinePrompt,
      output: { schema: RefineAndSummarizeOutputSchema },
    });

    const refineResult = refineResponse.output;

    if (!refineResult || !refineResult.refinedEmails) {
      throw new Error('AI failed to refine and summarize the fetched emails.');
    }

    // Filter for relevance on the server before sending to the client.
    // The AI is now instructed to return all emails, so this filter is important.
    const relevantEmails = refineResult.refinedEmails
      .filter((email) => email.isRelevant)
      .map((email) => ({
        id: email.id,
        sender: email.sender,
        subject: email.subject,
        snippet: email.snippet,
        timestamp: email.timestamp,
        summary: email.summary,
      }));

    console.log(`[queryEmailsFlow] AI refined list to ${relevantEmails.length} relevant emails.`);
    return { emailList: relevantEmails };
  }
);
