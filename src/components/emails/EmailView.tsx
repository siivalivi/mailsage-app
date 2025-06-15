'use client';

import { useState, useEffect } from 'react';
import { Email } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { summarizeEmail, SummarizeEmailInput } from '@/ai/flows/summarize-email';
import { Loader2, FileText, MessageSquareText, CalendarDays, UserCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmailViewProps {
  email: Email;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EmailView({ email: initialEmail }: EmailViewProps) {
  const [email, setEmail] = useState<Email>(initialEmail);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const { toast } = useToast();

  // Effect to update local email state if initialEmail prop changes (e.g. navigating between emails)
  useEffect(() => {
    setEmail(initialEmail);
    // If the new email doesn't have a summary but the old one did, clear it or handle as needed
    // For now, just resetting to the new initialEmail is fine
  }, [initialEmail]);

  const handleSummarize = async () => {
    if (!email.body) {
      toast({
        variant: 'destructive',
        title: 'Cannot Summarize',
        description: 'Email body is empty.',
      });
      return;
    }

    setIsSummarizing(true);
    try {
      const input: SummarizeEmailInput = { emailContent: email.body };
      const result = await summarizeEmail(input);
      setEmail(prev => ({ ...prev, summary: result.summary }));
      toast({
        title: 'Email Summarized',
        description: 'The summary has been generated successfully.',
      });
    } catch (error: any) {
      console.error('Error summarizing email:', error);
      toast({
        variant: 'destructive',
        title: 'Summarization Failed',
        description: error.message || 'An error occurred while summarizing the email.',
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">{email.subject}</CardTitle>
          <CardDescription className="text-base flex flex-col sm:flex-row sm:items-center sm:gap-4 pt-1">
             <span className="flex items-center">
                <UserCircle className="w-4 h-4 mr-1.5 text-muted-foreground" />
                From: {email.sender}
              </span>
              <span className="flex items-center mt-1 sm:mt-0">
                <CalendarDays className="w-4 h-4 mr-1.5 text-muted-foreground" />
                Date: {formatDate(email.timestamp)}
              </span>
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center text-2xl">
                <FileText className="w-6 h-6 mr-2 text-primary" />
                Original Email
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap break-words text-foreground/90">
              {email.body || <p className="text-muted-foreground">Email content not available.</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-secondary/30">
          <CardHeader>
             <div className="flex justify-between items-center">
              <CardTitle className="flex items-center text-2xl">
                <MessageSquareText className="w-6 h-6 mr-2 text-accent" />
                AI Summary
              </CardTitle>
              <Button onClick={handleSummarize} disabled={isSummarizing || !email.body} size="sm">
                {isSummarizing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ZapIcon className="h-4 w-4 mr-2" />
                )}
                {email.summary ? 'Re-Summarize' : 'Summarize'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isSummarizing && !email.summary && (
              <div className="flex items-center justify-center h-20">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                <p className="ml-2 text-muted-foreground">Generating summary...</p>
              </div>
            )}
            {!isSummarizing && !email.summary && (
              <p className="text-muted-foreground italic">
                No summary available. Click 'Summarize' to generate one.
              </p>
            )}
            {email.summary && (
              <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap break-words text-foreground">
                {email.summary}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Placeholder ZapIcon as Lucide doesn't have a direct equivalent
function ZapIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}
