
'use client';

import { useState, useEffect } from 'react';
import QueryForm from '@/components/emails/QueryForm';
import EmailList from '@/components/emails/EmailList';
import { Email, QueriedEmail } from '@/types'; 
import { useAuth } from '@/contexts/AuthContext';
import { MailQuestion, Info, Loader2 } from 'lucide-react';
import { summarizeQueriedEmails, SummarizeQueriedEmailsInput } from '@/ai/flows/summarize-queried-emails-flow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DailyBriefing from '@/components/emails/DailyBriefing';

// Adapts QueriedEmail (from Gmail via AI flow) to the Email type for display list.
const adaptQueriedEmailsToDisplay = (queriedEmails: QueriedEmail[]): Email[] => {
  return queriedEmails.map((qEmail) => ({
    id: qEmail.id, 
    sender: qEmail.sender,
    subject: qEmail.subject,
    body: qEmail.snippet || "Snippet not available.", // Initially, body is the snippet. Full body fetched on demand.
    summary: qEmail.summary, 
    timestamp: qEmail.timestamp, 
    isRead: false, // This could be enhanced if Gmail API provides read status easily
    snippet: qEmail.snippet,
  }));
};

const initialPlaceholderEmails: Email[] = [
  { 
    id: 'placeholder-initial-1', 
    sender: 'MailSage Assistant', 
    subject: 'Welcome to Your Gmail-Powered Dashboard!', 
    body: 'Hi there! Use the search bar above to query your actual Gmail inbox. Emails fetched from your Gmail account will appear here after you search. This is a placeholder until your first search.',
    summary: 'This is a placeholder email. Search your Gmail to see real results.',
    timestamp: Date.now(),
    isRead: true,
    snippet: 'Search your Gmail to begin.'
  },
];


export default function DashboardPage() {
  const { currentUser } = useAuth();
  const [emails, setEmails] = useState<Email[]>(initialPlaceholderEmails);
  const [isLoading, setIsLoading] = useState(false);
  const [overallSummary, setOverallSummary] = useState<string | null>(null);
  const [isOverallSummarizing, setIsOverallSummarizing] = useState(false);
  const [hasPerformedQuery, setHasPerformedQuery] = useState(false);
  
  const handleOverallSummary = async (emailListForSummary: QueriedEmail[]) => {
    if (emailListForSummary.length > 0) {
      setIsOverallSummarizing(true);
      setOverallSummary(null);
      try {
        const adaptedSummaries = emailListForSummary.map(e => ({
            sender: e.sender,
            subject: e.subject,
            summary: e.summary, // This is the AI summary of the snippet
        }));
        const result = await summarizeQueriedEmails({ queriedEmails: adaptedSummaries });
        setOverallSummary(result.overallSummary);
      } catch (error) {
        console.error('Error generating overall summary:', error);
        setOverallSummary('Could not generate an overall summary at this time.');
      } finally {
        setIsOverallSummarizing(false);
      }
    } else {
      setOverallSummary(null);
    }
  };

  const handleQuerySubmit = (queriedEmailsFromFlow: QueriedEmail[]) => {
    setEmails(adaptQueriedEmailsToDisplay(queriedEmailsFromFlow));
    handleOverallSummary(queriedEmailsFromFlow); 
    setHasPerformedQuery(true); // Mark that a query has been made
  };

  if (!currentUser) {
    return <p>Redirecting to login...</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-semibold mb-2">Welcome back, {currentUser.displayName?.split(' ')[0] || 'User'}!</h2>
        <p className="text-muted-foreground text-lg">
          Use the features below to interact with your connected Gmail account.
        </p>
      </div>
      
      <DailyBriefing />
      
      <QueryForm onQuerySubmit={handleQuerySubmit} setIsLoading={setIsLoading} />

      {(isOverallSummarizing || (overallSummary && hasPerformedQuery)) && ( // Show summary card only if processing or if query made & summary exists
        <Card className="bg-secondary/30">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <Info className="w-5 h-5 mr-2 text-accent" />
              Overall Summary of Queried Gmail Emails
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isOverallSummarizing && (
              <div className="flex items-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span>Generating overall summary...</span>
              </div>
            )}
            {overallSummary && !isOverallSummarizing && (
              <p className="text-foreground whitespace-pre-wrap">{overallSummary}</p>
            )}
            {!overallSummary && !isOverallSummarizing && hasPerformedQuery && (
                 <p className="text-muted-foreground">No overall summary could be generated for this query.</p>
            )}
          </CardContent>
        </Card>
      )}
      
      <div className="mt-6">
        <div className="flex items-center mb-4">
          <MailQuestion className="w-6 h-6 mr-2 text-primary" />
          <h3 className="text-2xl font-semibold">
            {hasPerformedQuery ? "Queried Gmail Results" : "Recent Activity (Placeholders)"}
          </h3>
        </div>
        <EmailList emails={emails} isLoading={isLoading} />
      </div>
    </div>
  );
}
