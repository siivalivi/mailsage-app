'use client';

import { useState, useEffect } from 'react';
import QueryForm from '@/components/emails/QueryForm';
import EmailList from '@/components/emails/EmailList';
import { Email, QueriedEmail } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { MailQuestion, Info, Loader2 } from 'lucide-react';
import { summarizeQueriedEmails, SummarizeQueriedEmailsInput } from '@/ai/flows/summarize-queried-emails-flow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const generateMockEmails = (queriedEmails: QueriedEmail[]): Email[] => {
  return queriedEmails.map((qEmail, index) => ({
    id: `mock-${index + 1}-${Date.now()}`,
    sender: qEmail.sender,
    subject: qEmail.subject,
    body: `This is the mock body for the email titled "${qEmail.subject}" from ${qEmail.sender}. It contains various details that could be summarized by our AI. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. This email also talks about an important meeting scheduled for next Tuesday and a follow-up required by end of day Friday. Action items include preparing the presentation slides and sending the agenda to all attendees.`,
    summary: qEmail.summary,
    timestamp: Date.now() - Math.floor(Math.random() * 1000000000),
    isRead: Math.random() > 0.5,
  }));
};

const initialMockQueriedEmails: QueriedEmail[] = [
  { sender: 'Tech Conference Updates', subject: 'Call for Papers Extended!', summary: 'The deadline for paper submissions for the Annual Tech Summit has been extended by two weeks. New deadline is August 15th.' },
  { sender: 'Marketing Team', subject: 'Weekly Campaign Performance', summary: 'This week\'s email campaign saw a 15% open rate and 3% click-through rate. Detailed report attached.' },
  { sender: 'HR Department', subject: 'Important: New Company Policy', summary: 'Please review the updated remote work policy, effective September 1st. Acknowledge receipt by end of week.' },
  { sender: 'Client Support', subject: 'Your inquiry #12345: Resolved', summary: 'We are pleased to inform you that your recent support ticket regarding login issues has been resolved.' },
];


export default function DashboardPage() {
  const { currentUser } = useAuth();
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [overallSummary, setOverallSummary] = useState<string | null>(null);
  const [isOverallSummarizing, setIsOverallSummarizing] = useState(false);

  useEffect(() => {
    setEmails(generateMockEmails(initialMockQueriedEmails));
    setIsLoading(false);
    // Optionally, generate an overall summary for initial emails too
    // handleOverallSummary(initialMockQueriedEmails); 
  }, []);
  
  const handleOverallSummary = async (emailListForSummary: QueriedEmail[]) => {
    if (emailListForSummary.length > 0) {
      setIsOverallSummarizing(true);
      setOverallSummary(null); // Clear previous summary
      try {
        const result = await summarizeQueriedEmails({ queriedEmails: emailListForSummary } as SummarizeQueriedEmailsInput);
        setOverallSummary(result.overallSummary);
      } catch (error) {
        console.error('Error generating overall summary:', error);
        setOverallSummary('Could not generate an overall summary at this time.');
      } finally {
        setIsOverallSummarizing(false);
      }
    } else {
      setOverallSummary(null); // No emails, no summary
    }
  };

  const handleQuerySubmit = (queriedEmails: QueriedEmail[]) => {
    setEmails(generateMockEmails(queriedEmails));
    handleOverallSummary(queriedEmails); // Generate overall summary for new query results
  };

  if (!currentUser) {
    return <p>Redirecting to login...</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-semibold mb-2">Welcome back, {currentUser.displayName?.split(' ')[0] || 'User'}!</h2>
        <p className="text-muted-foreground text-lg">
          Use the search bar below to query your emails using natural language.
        </p>
      </div>
      
      <QueryForm onQuerySubmit={handleQuerySubmit} setIsLoading={setIsLoading} />

      {(isOverallSummarizing || overallSummary) && (
        <Card className="bg-secondary/30">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <Info className="w-5 h-5 mr-2 text-accent" />
              Overall Summary of Queried Emails
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
          </CardContent>
        </Card>
      )}
      
      <div className="mt-6">
        <div className="flex items-center mb-4">
          <MailQuestion className="w-6 h-6 mr-2 text-primary" />
          <h3 className="text-2xl font-semibold">Your Emails</h3>
        </div>
        <EmailList emails={emails} isLoading={isLoading} />
      </div>
    </div>
  );
}
