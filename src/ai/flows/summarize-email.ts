'use server';
/**
 * @fileOverview A flow that summarizes a single email's content.
 *
 * - summarizeEmail - The primary exported function.
 * - SummarizeEmailInput - The input type for the function.
 * - SummarizeEmailOutput - The return type for the function.
 */
import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeEmailInputSchema = z.object({
  emailContent: z.string().describe('The complete content of the email to summarize.'),
});
export type SummarizeEmailInput = z.infer<typeof SummarizeEmailInputSchema>;

const SummarizeEmailOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the email content.'),
});
export type SummarizeEmailOutput = z.infer<typeof SummarizeEmailOutputSchema>;

export async function summarizeEmail(input: SummarizeEmailInput): Promise<SummarizeEmailOutput> {
  const response = await summarizeEmailFlow(input);
  if (!response) {
      console.error('[summarizeEmail] ERROR: The flow returned an undefined response.');
      throw new Error('The AI failed to generate a summary for the email.');
  }
  return response;
}

const summarizeEmailPrompt = ai.definePrompt({
  name: 'summarizeEmailPrompt',
  input: {schema: SummarizeEmailInputSchema},
  output: {schema: SummarizeEmailOutputSchema},
  prompt: `Summarize the following email content, extracting the key points and any action items:\n\n{{{emailContent}}}`,
});

const summarizeEmailFlow = ai.defineFlow(
  {
    name: 'summarizeEmailFlow',
    inputSchema: SummarizeEmailInputSchema,
    outputSchema: SummarizeEmailOutputSchema,
  },
  async input => {
    const response = await ai.generate({
        prompt: summarizeEmailPrompt,
        input: input,
    });
    
    if (!response || !response.output) {
      console.error('[summarizeEmailFlow] ERROR: The AI model failed to generate a summary. The response or its output was undefined.', response);
      throw new Error("The AI failed to generate a summary for the email.");
    }
    
    return response.output;
  }
);
