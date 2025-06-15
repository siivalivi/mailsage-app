export interface Email {
  id: string;
  sender: string;
  subject: string;
  body: string; // Full email content, might be mocked
  summary?: string; // AI generated summary
  timestamp: number; // Unix timestamp or similar
  isRead?: boolean; 
}

// Type matching the output of queryEmails AI flow
export interface QueriedEmail {
  sender: string;
  subject: string;
  summary: string; // This summary comes from the queryEmails flow
}
