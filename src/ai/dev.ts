import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-email.ts';
import '@/ai/flows/query-emails.ts';
import '@/ai/flows/summarize-queried-emails-flow.ts';
import '@/ai/flows/draft-reply.ts';
import '@/ai/flows/extract-action-items.ts';
import '@/ai/flows/generate-daily-briefing.ts';
