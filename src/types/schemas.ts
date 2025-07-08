import { z } from 'zod';

export const ReplyToneSchema = z.enum(['polite', 'formal', 'casual', 'direct', 'friendly']);
export type ReplyTone = z.infer<typeof ReplyToneSchema>;
