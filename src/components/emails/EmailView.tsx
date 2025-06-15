'use client';

import { useState, useEffect } from 'react';
import type { Email } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { summarizeEmail, SummarizeEmailInput } from '@/ai/flows/summarize-email';
import { Loader2, FileText, MessageSquareText, CalendarDays, UserCircle, Sparkles } from 'lucide-react'; // Replaced ZapIcon with Sparkles
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

  useEffect(() => {
    setEmail(initialEmail);
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
                  <Sparkles className="h-4 w-4 mr-2" /> // Using Sparkles icon
                )}
                {email.summary && email.summary !== "No summary available." ? 'Re-Summarize' : 'Summarize'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isSummarizing && !email.summary && ( // Show loading only if no summary exists yet
              <div className="flex items-center justify-center h-20">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                <p className="ml-2 text-muted-foreground">Generating summary...</p>
              </div>
            )}
            {!isSummarizing && (!email.summary || email.summary === "No summary available.") && (
              <p className="text-muted-foreground italic">
                No summary available. Click 'Summarize' to generate one.
              </p>
            )}
            {email.summary && email.summary !== "No summary available." && (
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

// Removed ZapIcon as it's replaced by lucide-react's Sparkles
