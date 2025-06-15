
'use client';

import { useParams, useRouter } from 'next/navigation';
import EmailView from '@/components/emails/EmailView';
import type { Email } from '@/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchGmailMessageBody } from '@/services/gmailService'; 
import { useToast } from '@/hooks/use-toast';


// MOCK_EMAIL_DB is now only for absolute fallbacks for non-Gmail IDs
const MOCK_EMAIL_DB: Record<string, Email> = {
  'placeholder-initial-1': { 
    id: 'placeholder-initial-1', 
    sender: 'MailSage Assistant (Fallback)', 
    subject: 'Welcome! (Fallback)', 
    body: 'This is fallback content if data loading fails.',
    summary: 'Fallback welcome summary.',
    timestamp: Date.now(),
    isRead: true,
    snippet: 'Fallback snippet.'
  },
};


export default function EmailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string; // Gmail message ID
  const [email, setEmailData] = useState<Email | null | undefined>(undefined);
  const [isLoadingEmail, setIsLoadingEmail] = useState(true); // General loading for initial data or full body
  const { getGoogleAccessToken, currentUser, signInWithGoogle } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const loadEmail = async () => {
      setIsLoadingEmail(true);
      if (!id) {
        setEmailData(null);
        setIsLoadingEmail(false);
        return;
      }

      let emailFromStorage: Email | null = null;
      if (typeof window !== 'undefined') {
        const storedEmailJson = localStorage.getItem(`email-${id}`);
        if (storedEmailJson) {
          try {
            emailFromStorage = JSON.parse(storedEmailJson) as Email;
          } catch (e) {
            console.error(`Failed to parse email from localStorage for id ${id}:`, e);
            localStorage.removeItem(`email-${id}`);
          }
        }
      }

      if (emailFromStorage) {
        setEmailData(emailFromStorage);
        // If body is just the snippet (and not already HTML from a previous full fetch) or known placeholder, fetch full body
        const isSnippetOnly = emailFromStorage.body === emailFromStorage.snippet || 
                              emailFromStorage.body === "Snippet not available." ||
                              emailFromStorage.body === "Email body could not be extracted.";
        const isLikelyHtml = emailFromStorage.body?.toLowerCase().includes("<html") || emailFromStorage.body?.toLowerCase().includes("<body");

        if (isSnippetOnly && !isLikelyHtml && !id.startsWith('placeholder-')) {
          await fetchFullBodyAndUpdateState(id, emailFromStorage);
        } else {
          setIsLoadingEmail(false); // Already have full body or it's a mock
        }
      } else if (!id.startsWith('placeholder-')) { // Potentially a direct link to a real Gmail ID not in localStorage
        // Attempt to fetch its full content directly
        await fetchFullBodyAndUpdateState(id, null); // Pass null as no base data
      } else {
        // Fallback for known placeholder IDs if not in localStorage (should be rare)
        setEmailData(MOCK_EMAIL_DB[id] || null);
        setIsLoadingEmail(false);
      }
    };

    loadEmail();
  }, [id]);

  const fetchFullBodyAndUpdateState = async (messageId: string, baseEmailData: Email | null) => {
    setIsLoadingEmail(true); // Ensure loading state is true during fetch
    const accessToken = getGoogleAccessToken();
    if (!accessToken) {
      toast({ 
        variant: 'destructive', 
        title: 'Authentication Error', 
        description: 'Cannot fetch email body. Access token missing. Please try refreshing your sign-in.',
        action: <Button variant="outline" size="sm" onClick={signInWithGoogle}>Refresh Sign-In</Button>
      });
      if (baseEmailData) setEmailData(baseEmailData); // Revert to snippet/previous state
      else setEmailData(null); // No base data, truly failed
      setIsLoadingEmail(false);
      return;
    }

    try {
      const bodyContent = await fetchGmailMessageBody(accessToken, messageId);
      if (baseEmailData) {
        const updatedEmail = { ...baseEmailData, body: bodyContent };
        setEmailData(updatedEmail);
        localStorage.setItem(`email-${messageId}`, JSON.stringify(updatedEmail));
      } else {
        // This case handles if we only had an ID (e.g. direct navigation)
        // We'd need to fetch subject/sender/date separately for a complete Email object.
        // For now, create a partial Email object focused on the body.
         setEmailData({
            id: messageId,
            body: bodyContent,
            subject: 'Email Details (Loading...)', // Placeholder
            sender: 'Loading...',
            timestamp: Date.now(), // Placeholder
            snippet: 'Loading...'
         });
         // To fully populate this, we'd need another call to get message metadata.
      }
    } catch (error: any) {
      console.error(`Failed to fetch email body for ${messageId}:`, error);
      toast({ variant: 'destructive', title: 'Failed to Load Email Body', description: error.message });
      if (baseEmailData) setEmailData(baseEmailData); // Revert to snippet if full fetch failed
      else setEmailData(null);
    } finally {
      setIsLoadingEmail(false);
    }
  };


  if (isLoadingEmail || email === undefined) { 
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
        <p className="mt-4 text-muted-foreground">Loading email content...</p>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-semibold mb-4">Email Not Found</h2>
        <p className="text-muted-foreground mb-6">The email (ID: {id}) could not be loaded or does not exist.</p>
        <Button onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  // The EmailView component will decide whether to show "Summarize" or "Re-Summarize"
  // based on if email.summary already exists.
  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.push('/dashboard')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>
      <EmailView email={email} />
    </div>
  );
}
