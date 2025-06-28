'use server';
/**
 * @fileOverview A flow that generates a draft reply to an email.
 *
 * - draftReply - The primary exported function.
 * - DraftReplyInput - The input type for the function.
 * - DraftReplyOutput - The return type for the function.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const ReplyToneSchema = z.enum(['polite', 'formal', 'casual', 'direct', 'friendly']);
export type ReplyTone = z.infer<typeof ReplyToneSchema>;


const DraftReplyInputSchema = z.object({
  emailContent: z.string().describe('The complete content of the email to reply to.'),
  replyTone: ReplyToneSchema.describe('The desired tone for the reply.'),
});
export type DraftReplyInput = z.infer<typeof DraftReplyInputSchema>;

const DraftReplyOutputSchema = z.object({
  reply: z.string().describe('The AI-generated draft reply.'),
});
export type DraftReplyOutput = z.infer<typeof DraftReplyOutputSchema>;

export async function draftReply(
  input: DraftReplyInput
): Promise<DraftReplyOutput> {
  const response = await draftReplyFlow(input);
  if (!response) {
    console.error(
      '[draftReply] ERROR: The flow returned an undefined response.'
    );
    throw new Error('The AI failed to generate a draft reply.');
  }
  return response;
}

const draftReplyPrompt = ai.definePrompt({
  name: 'draftReplyPrompt',
  input: { schema: DraftReplyInputSchema },
  output: { schema: DraftReplyOutputSchema },
  prompt: `You are an expert at writing professional and effective emails.
Your task is to generate a draft reply to the following email content.
The user wants the reply to have a specific tone.

- Email to reply to:
{{{emailContent}}}

- Desired tone for the reply: {{{replyTone}}}

Based on the email content and the desired tone, write a suitable draft reply.
The reply should be concise, relevant, and ready for the user to edit and send.
Do not include a subject line or signature, only the body of the reply.`,
});

const draftReplyFlow = ai.defineFlow(
  {
    name: 'draftReplyFlow',
    inputSchema: DraftReplyInputSchema,
    outputSchema: DraftReplyOutputSchema,
  },
  async (input) => {
    const response = await ai.generate({
      prompt: draftReplyPrompt,
      input: input,
    });

    if (!response || !response.output) {
      console.error(
        '[draftReplyFlow] ERROR: The AI model failed to generate a draft. The response or its output was undefined.',
        response
      );
      throw new Error('The AI failed to generate a draft reply.');
    }

    return response.output;
  }
);
