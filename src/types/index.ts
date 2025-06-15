
export interface Email {
  id: string; // Gmail message ID
  sender: string;
  subject: string;
  body: string; // For queried emails, this will be the snippet or later the full body.
  summary?: string; // AI generated summary of snippet or full body
  timestamp: number; // Unix timestamp from email date
  isRead?: boolean; // Gmail API can provide this
  snippet?: string; // Gmail message snippet
}

// Type that comes from queryEmails flow, derived from Gmail API and then AI summarized.
export interface QueriedEmail {
  id: string; // Gmail message ID
  sender: string;
  subject: string;
  snippet: string; // Snippet from Gmail
  timestamp: number; // Email date as Unix timestamp
  summary: string; // This summary is AI-generated based on the snippet
}
