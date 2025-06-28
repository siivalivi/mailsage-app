
'use client';

import { useState, useEffect } from 'react';
import type { Email } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { summarizeEmail, SummarizeEmailInput } from '@/ai/flows/summarize-email';
import { draftReply, DraftReplyInput, ReplyTone, ReplyToneSchema } from '@/ai/flows/draft-reply';
import { Loader2, FileText, MessageSquareText, CalendarDays, UserCircle, Sparkles, PenSquare, ClipboardCopy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

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
  const [isDrafting, setIsDrafting] = useState(false);
  const [draft, setDraft] = useState('');
  const [replyTone, setReplyTone] = useState<ReplyTone>('polite');
  const { toast } = useToast();

  useEffect(() => {
    setEmail(initialEmail);
    setDraft(''); // Reset draft when email changes
  }, [initialEmail]);

  const handleSummarize = async () => {
    if (!email.body) {
      toast({ variant: 'destructive', title: 'Cannot Summarize', description: 'Email body is empty.' });
      return;
    }

    setIsSummarizing(true);
    try {
      const input: SummarizeEmailInput = { emailContent: email.body };
      const result = await summarizeEmail(input);
      setEmail(prev => ({ ...prev, summary: result.summary }));
      toast({ title: 'Email Summarized', description: 'The summary has been generated successfully.' });
    } catch (error: any) {
      console.error('Error summarizing email:', error);
      toast({ variant: 'destructive', title: 'Summarization Failed', description: error.message || 'An error occurred while summarizing the email.' });
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleGenerateDraft = async () => {
    if (!email.body) {
      toast({ variant: 'destructive', title: 'Cannot Generate Draft', description: 'Email body is empty.' });
      return;
    }

    setIsDrafting(true);
    setDraft('');
    try {
      const input: DraftReplyInput = { emailContent: email.body, replyTone };
      const result = await draftReply(input);
      setDraft(result.reply);
      toast({ title: 'Reply Drafted', description: 'The draft has been generated successfully.' });
    } catch (error: any) {
      console.error('Error drafting reply:', error);
      toast({ variant: 'destructive', title: 'Drafting Failed', description: error.message || 'An error occurred while drafting the reply.' });
    } finally {
      setIsDrafting(false);
    }
  };

  const handleCopy = () => {
    if (!draft) return;
    navigator.clipboard.writeText(draft);
    toast({ title: 'Copied to Clipboard', description: 'The draft reply has been copied.' });
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

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center text-2xl">
              <FileText className="w-6 h-6 mr-2 text-primary" />
              Original Email
            </CardTitle>
          </CardHeader>
          <CardContent>
            {email.body ? (
              <div
                className="prose prose-sm max-w-none dark:prose-invert text-foreground/90"
                dangerouslySetInnerHTML={{ __html: email.body }}
              />
            ) : (
              <p className="text-muted-foreground">Email content not available.</p>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-secondary/30">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center text-xl">
                  <MessageSquareText className="w-5 h-5 mr-2 text-accent" />
                  AI Summary
                </CardTitle>
                <Button onClick={handleSummarize} disabled={isSummarizing || !email.body} size="sm">
                  {isSummarizing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {email.summary && email.summary !== "No summary available." ? 'Re-Summarize' : 'Summarize'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isSummarizing && !email.summary && (
                <div className="flex items-center justify-center h-20">
                  <Loader2 className="h-8 w-8 animate-spin text-accent" />
                </div>
              )}
              {!isSummarizing && (!email.summary || email.summary === "No summary available.") && (
                <p className="text-muted-foreground italic text-sm">
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <PenSquare className="w-5 h-5 mr-2 text-primary" />
                Generate Reply
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2 items-center">
                <label className="text-sm font-medium col-span-1">Tone</label>
                <Select value={replyTone} onValueChange={(v) => setReplyTone(v as ReplyTone)} >
                  <SelectTrigger className="w-full col-span-2">
                    <SelectValue placeholder="Select tone" />
                  </SelectTrigger>
                  <SelectContent>
                    {ReplyToneSchema.options.map(tone => (
                      <SelectItem key={tone} value={tone} className="capitalize">{tone}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleGenerateDraft} disabled={isDrafting || !email.body} className="w-full">
                {isDrafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate Draft
              </Button>
              
              {(isDrafting || draft) && (
                 <div className="relative pt-2">
                  <Textarea
                    placeholder="AI draft will appear here..."
                    value={isDrafting ? "Generating draft..." : draft}
                    readOnly={isDrafting}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={6}
                    className="pr-10"
                  />
                  {!isDrafting && draft && (
                     <Button variant="ghost" size="icon" className="absolute top-3 right-1.5 h-7 w-7" onClick={handleCopy} aria-label="Copy draft">
                       <ClipboardCopy className="h-4 w-4 text-muted-foreground" />
                     </Button>
                  )}
                 </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
