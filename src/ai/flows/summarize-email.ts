// Summarizes an email provided as input.

'use server';

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
  return summarizeEmailFlow(input);
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
    const response = await summarizeEmailPrompt(input);
    const output = response.output;

    if (!output) {
      console.error('[summarizeEmailFlow] ERROR: The AI model failed to generate a summary. The response did not contain a valid `output` field.', response);
      throw new Error("The AI failed to generate a summary for the email.");
    }
    
    return output;
  }
);
