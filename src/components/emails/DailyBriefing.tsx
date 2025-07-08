'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Newspaper } from 'lucide-react';
import { generateDailyBriefing, GenerateDailyBriefingInput } from '@/ai/flows/generate-daily-briefing';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';

type TimeRange = GenerateDailyBriefingInput['timeRange'];

export default function DailyBriefing() {
  const [briefing, setBriefing] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeRange, setActiveRange] = useState<TimeRange | null>(null);
  const { getGoogleAccessToken } = useAuth();
  const { toast } = useToast();

  const handleGenerateBriefing = async (targetRange: TimeRange) => {
    setIsLoading(true);
    setActiveRange(targetRange);
    setBriefing(null);
    
    const accessToken = getGoogleAccessToken();
    if (!accessToken) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'Access token is missing. Please refresh your sign-in.',
      });
      setIsLoading(false);
      return;
    }

    try {
      const result = await generateDailyBriefing({ timeRange: targetRange, accessToken });
      setBriefing(result.briefing);
    } catch (error: any) {
      console.error('Error generating daily briefing:', error);
      toast({
        variant: 'destructive',
        title: 'Briefing Failed',
        description: error.message || 'An unexpected error occurred.',
      });
      setBriefing('Failed to generate your daily briefing. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const briefingRanges: { label: string; range: TimeRange }[] = [
    { label: 'Today', range: 'today' },
    { label: 'Yesterday', range: 'yesterday' },
    { label: 'This Week', range: 'this-week' },
    { label: 'Last 7 Days', range: 'last-7-days' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <Newspaper className="w-5 h-5 mr-2 text-primary" />
          AI Daily Briefing
        </CardTitle>
        <div className="text-sm text-muted-foreground pt-1">
          Get a categorized summary of your recent emails.
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 md:gap-4 mb-4">
          {briefingRanges.map(({ label, range }) => (
            <Button
              key={range}
              onClick={() => handleGenerateBriefing(range)}
              disabled={isLoading}
              variant={activeRange === range && !isLoading ? 'default' : 'outline'}
            >
              {isLoading && activeRange === range ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {label}
            </Button>
          ))}
        </div>
        {isLoading && (
          <div className="flex items-center text-muted-foreground p-4 justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-3" />
            <span>Generating your briefing for {activeRange?.replace('-', ' ')}...</span>
          </div>
        )}
        {briefing && !isLoading && (
          <div className="p-4 border rounded-lg bg-background mt-4">
            <ReactMarkdown
              className="prose prose-sm dark:prose-invert max-w-none"
              components={{
                h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-primary mt-4 mb-2" {...props} />,
                ul: ({node, ...props}) => <ul className="space-y-1 list-disc pl-5" {...props} />,
                li: ({node, ...props}) => <li className="text-foreground/90" {...props} />,
                p: ({node, ...props}) => <p className="text-foreground" {...props} />,
              }}
            >
              {briefing}
            </ReactMarkdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
