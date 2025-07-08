'use server';
/**
 * @fileOverview A Genkit flow that uses an AI router to query a user's Gmail account.
 * This flow first categorizes the user's query, then invokes a specialized AI agent
 * to transform the natural language query into a structured Gmail search, fetches the emails,
 * and then summarizes the results.
 *
 * - queryEmails - The primary exported function that executes the email query process.
 * - QueryEmailsInput - The input type for the queryEmails function.
 * - QueryEmailsOutput - The return type for the queryEmails function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
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
  emailList: z.array(QueriedEmailAISummarySchema),
});
export type QueryEmailsOutput = z.infer<typeof QueryEmailsOutputSchema>;

// --- Schemas for AI responses ---

const QueryCategorySchema = z.enum([
  'billing',
  'travel',
  'promotions',
  'social_media',
  'general',
]);
type QueryCategory = z.infer<typeof QueryCategorySchema>;

const CategorizeQueryOutputSchema = z.object({
  category: QueryCategorySchema.describe(
    'The determined category of the user query.'
  ),
});

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

// --- Exported Function ---

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

// --- Specialized Prompts (The "Agents") ---

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

// --- Main Flow Definition ---

const queryEmailsFlow = ai.defineFlow(
  {
    name: 'queryEmailsFlow',
    inputSchema: QueryEmailsInputSchema,
    outputSchema: QueryEmailsOutputSchema,
  },
  async (flowInput) => {
    // STEP 1: Categorize the user's query to select the correct agent.
    console.log('[queryEmailsFlow] Step 1: Categorizing user query.');
    const categorizePrompt = `You are an expert query routing agent. Your job is to classify the user's email search query into one of the following categories: ${QueryCategorySchema.options.join(', ')}.
- billing: Queries about invoices, receipts, payments, charges, or orders.
- travel: Queries about flights, hotels, car rentals, bookings, or itineraries.
- promotions: Queries about sales, discounts, offers, or coupons.
- social_media: Queries mentioning platforms like Facebook, Twitter, LinkedIn.
- general: All other queries that do not fit the above categories.
Your response MUST be a JSON object conforming to the required schema.
User Query: "${flowInput.query}"`;

    const categoryResponse = await ai.generate({
      prompt: categorizePrompt,
      output: { schema: CategorizeQueryOutputSchema },
    });

    const category = categoryResponse.output?.category || 'general';
    console.log(`[queryEmailsFlow] Query categorized as: "${category}"`);

    // STEP 2: Select the specialized agent (prompt) and transform the query.
    console.log('[queryEmailsFlow] Step 2: Transforming natural language to Gmail query using specialized agent.');
    let transformPrompt;
    switch (category) {
      case 'billing':
        transformPrompt = billingTransformPrompt;
        break;
      case 'travel':
        transformPrompt = travelTransformPrompt;
        break;
      case 'promotions':
        transformPrompt = promotionsTransformPrompt;
        break;
      default:
        transformPrompt = generalTransformPrompt;
    }

    const transformResponse = await transformPrompt({ query: flowInput.query });
    const transformedQuery = transformResponse.output?.gmailQueryString;

    if (!transformedQuery) {
      throw new Error(
        'AI failed to transform the query. The model response was empty or invalid.'
      );
    }
    console.log(
      `[queryEmailsFlow] AI-generated Gmail query: "${transformedQuery}"`
    );

    // STEP 3: Fetch emails from Gmail API using the transformed query.
    const emails: FetchedEmailData[] = await fetchGmailMessages(
      flowInput.accessToken,
      transformedQuery,
      20 // max results
    );

    if (emails.length === 0) {
      console.log(
        '[queryEmailsFlow] No emails found from Gmail API. Returning empty list.'
      );
      return { emailList: [] };
    }
    console.log(
      `[queryEmailsFlow] Fetched ${emails.length} emails from Gmail. Now refining with AI.`
    );

    // STEP 4: Use AI to refine and summarize the fetched emails.
    console.log('[queryEmailsFlow] Step 4: Refining and summarizing fetched emails.');

    const emailsToProcessString = emails
      .map(
        (email) =>
          `---
Email ID: ${email.id}
From: ${email.sender}
Subject: ${email.subject}
Timestamp: ${email.timestamp}
Snippet: "${email.snippet}"
---`
      )
      .join('\n');

    const refinePrompt = `You are an intelligent email processing agent. Your task is to review a list of emails fetched from Gmail based on a search query.
For EACH email, you must perform two actions:
1.  Relevance Check: Determine if the email's content (snippet) is truly relevant to the user's original query.
2.  Summarization: If the email is relevant, create a concise, informative summary of its snippet that directly addresses the user's query intent.
Produce a JSON output containing a 'refinedEmails' array. For EACH email provided, include an object in the array with the fields 'isRelevant', 'id', 'sender', 'subject', 'snippet', 'timestamp', and 'summary'.
- Only include emails where 'isRelevant' is true in the final user-facing list.

User's Original Query: "${flowInput.query}"

Here are the emails to process:
${emailsToProcessString}
`;

    const refineResponse = await ai.generate({
      prompt: refinePrompt,
      output: { schema: RefineAndSummarizeOutputSchema },
    });

    const refineResult = refineResponse.output;

    if (!refineResult || !refineResult.refinedEmails) {
      throw new Error(
        'AI failed to refine and summarize the fetched emails. The model response was empty, invalid, or did not contain refined emails.'
      );
    }

    // Filter for relevant emails and map to the final output schema.
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

    console.log(
      `[queryEmailsFlow] AI refined the list to ${relevantEmails.length} relevant emails.`
    );
    return { emailList: relevantEmails };
  }
);
