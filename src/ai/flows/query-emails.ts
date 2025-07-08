
'use server';
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

// --- Specialized Prompts (The "Skills" for our Tools) ---

const now = new Date();
const currentDateForLLM = `${now.getFullYear()}-${(now.getMonth() + 1)
  .toString()
  .padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

const commonPromptInstructions = `
You are a powerful text-processing utility. Your task is to convert a user's natural language email query into a valid, efficient Gmail API search query string.
- Use the current date ("${currentDateForLLM}") as a reference for any relative date expressions (e.g., "last week", "month of may").
- Translate keywords into Gmail search operators (e.g., from:, to:, subject:).
- For date ranges, use 'after:' and 'before:' (e.g., 'after:2023/01/01 before:2023/01/31').
- Your response MUST be a JSON object conforming to the required schema.
`;

const billingTransformPrompt = ai.definePrompt({
  name: 'billingTransformPrompt',
  output: { schema: GmailQuerySchema },
  prompt: `${commonPromptInstructions}
This is a BILLING query. Focus on financial terms.
- Broaden the search with terms like '(invoice OR receipt OR bill OR payment OR charge OR order)'.
- Pay attention to specific senders or merchants mentioned.
User Query: "{{query}}"`,
});

const travelTransformPrompt = ai.definePrompt({
  name: 'travelTransformPrompt',
  output: { schema: GmailQuerySchema },
  prompt: `${commonPromptInstructions}
This is a TRAVEL query. Focus on booking and itinerary terms.
- Look for keywords like '(flight OR hotel OR car rental OR confirmation OR booking OR itinerary)'.
- Identify travel companies, airlines, or hotel names.
User Query: "{{query}}"`,
});

const promotionsTransformPrompt = ai.definePrompt({
  name: 'promotionsTransformPrompt',
  output: { schema: GmailQuerySchema },
  prompt: `${commonPromptInstructions}
This is a PROMOTIONS query. Focus on marketing and sales terms.
- Search for terms like '(sale OR discount OR offer OR % off OR coupon)'.
- Consider searching within the 'promotions' category label if general: 'category:promotions'.
User Query: "{{query}}"`,
});

const generalTransformPrompt = ai.definePrompt({
  name: 'generalTransformPrompt',
  output: { schema: GmailQuerySchema },
  prompt: `${commonPromptInstructions}
This is a GENERAL query. Perform a standard keyword translation.
User Query: "{{query}}"`,
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
    // STEP 1 (REVISED): Invoke an agent with tools to generate the query string.
    console.log('[queryEmailsFlow] Step 1: Invoking agent to generate Gmail query via tool use.');

    const agentResponse = await ai.generate({
      prompt: `You are an expert email search agent. Your goal is to generate a precise Gmail search query string based on the user's request.
        - Analyze the user's query to understand its intent.
        - Select and use the single most appropriate tool to generate the query string.
        - Your final output must be ONLY the JSON object containing the query string from the tool.`,
      tools: [billingTool, travelTool, promotionsTool, generalTool],
      output: { schema: GmailQuerySchema },
      input: { query: flowInput.query },
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

    const refinePrompt = `You are an intelligent email processing agent. Review a list of emails and for EACH one:
      1. Relevance Check: Determine if it's truly relevant to the user's original query.
      2. Summarization: If relevant, create a concise summary focusing on the query's intent.
      Produce a JSON output with a 'refinedEmails' array. Only include relevant emails in the final list.
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

    