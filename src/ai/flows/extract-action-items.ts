'use server';
/**
 * @fileOverview A flow that extracts action items from an email.
 *
 * - extractActionItems - The primary exported function.
 * - ExtractActionItemsInput - The input type for the function.
 * - ExtractActionItemsOutput - The return type for the function.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ExtractActionItemsInputSchema = z.object({
  emailContent: z
    .string()
    .describe('The complete content of the email to extract action items from.'),
});
export type ExtractActionItemsInput = z.infer<
  typeof ExtractActionItemsInputSchema
>;

const ExtractActionItemsOutputSchema = z.object({
  actionItems: z
    .array(z.string().describe('A single, clear action item extracted from the email.'))
    .describe(
      'A list of tasks, questions, or deadlines found in the email content.'
    ),
});
export type ExtractActionItemsOutput = z.infer<
  typeof ExtractActionItemsOutputSchema
>;

export async function extractActionItems(
  input: ExtractActionItemsInput
): Promise<ExtractActionItemsOutput> {
  const response = await extractActionItemsFlow(input);
  if (!response) {
    console.error(
      '[extractActionItems] ERROR: The flow returned an undefined response.'
    );
    throw new Error('The AI failed to extract action items.');
  }
  return response;
}

const extractActionItemsPrompt = ai.definePrompt({
  name: 'extractActionItemsPrompt',
  input: { schema: ExtractActionItemsInputSchema },
  output: { schema: ExtractActionItemsOutputSchema },
  prompt: `You are an expert at productivity and task management.
Your task is to analyze an email and extract a clear, concise list of all action items.
Action items can be explicit tasks, questions that require a response, or important deadlines.

- Review the following email content carefully.
- Identify anything that requires the recipient to take an action.
- If no action items are found, return an empty array for the actionItems field.

Email Content:
{{{emailContent}}}
`,
});

const extractActionItemsFlow = ai.defineFlow(
  {
    name: 'extractActionItemsFlow',
    inputSchema: ExtractActionItemsInputSchema,
    outputSchema: ExtractActionItemsOutputSchema,
  },
  async (input) => {
    const response = await ai.generate({
      prompt: extractActionItemsPrompt,
      input: input,
    });

    if (!response || !response.output) {
      console.error(
        '[extractActionItemsFlow] ERROR: The AI model failed to extract action items. The response or its output was undefined.',
        response
      );
      throw new Error('The AI failed to extract action items.');
    }

    return response.output;
  }
);
