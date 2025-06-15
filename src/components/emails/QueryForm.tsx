
'use client';

import { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Search, Loader2 } from 'lucide-react';
import { queryEmails, QueryEmailsOutput } from '@/ai/flows/query-emails';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const formSchema = z.object({
  query: z.string().min(1, { message: 'Query cannot be empty.' }), // Min 1 for more flexible queries to Gmail
});

type QueryFormValues = z.infer<typeof formSchema>;

interface QueryFormProps {
  onQuerySubmit: (results: QueryEmailsOutput['emailList']) => void;
  setIsLoading: (loading: boolean) => void;
}

export default function QueryForm({ onQuerySubmit, setIsLoading }: QueryFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { getGoogleAccessToken, currentUser, signInWithGoogle } = useAuth();

  const form = useForm<QueryFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      query: '',
    },
  });

  const onSubmit: SubmitHandler<QueryFormValues> = async (data) => {
    if (!currentUser) {
      toast({ variant: 'destructive', title: 'Not Authenticated', description: 'Please sign in to query emails.' });
      return;
    }

    let accessToken = getGoogleAccessToken();

    if (!accessToken) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'Access token for Gmail is missing or expired. Please try signing in again to refresh permissions.',
        action: <Button variant="outline" size="sm" onClick={async () => {
          await signInWithGoogle(); // Attempt to re-sign in / refresh token
          // After re-sign in, the token should be available. User might need to submit form again.
        }}>Refresh Sign-In</Button>
      });
      setIsLoading(false);
      return;
    }

    setIsSubmitting(true);
    setIsLoading(true);
    try {
      const result = await queryEmails({ query: data.query, accessToken });
      onQuerySubmit(result.emailList);
      toast({
        title: 'Gmail Query Successful',
        description: `Found and processed ${result.emailList.length} email(s) from your Gmail account.`,
      });
    } catch (error: any) {
      console.error('Error querying emails:', error);
      // Check for specific token-related errors if possible
      if (error.message && (error.message.includes('401') || error.message.toLowerCase().includes('token'))) {
         toast({
            variant: 'destructive',
            title: 'Gmail Access Expired/Revoked',
            description: 'Your permission to access Gmail may have expired. Please try signing in again.',
            action: <Button variant="outline" size="sm" onClick={signInWithGoogle}>Refresh Sign-In</Button>
         });
      } else {
        toast({
          variant: 'destructive',
          title: 'Gmail Query Failed',
          description: error.message || 'An error occurred while querying your emails from Gmail.',
        });
      }
      onQuerySubmit([]); 
    } finally {
      setIsSubmitting(false);
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2 items-start mb-8">
        <FormField
          control={form.control}
          name="query"
          render={({ field }) => (
            <FormItem className="flex-grow">
              <FormControl>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="e.g., 'invoices from Uber last month'"
                    className="pl-10 text-base"
                    {...field}
                    aria-label="Email query input"
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting || !currentUser} className="h-12 text-base px-6">
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>Ask MailSage (Gmail)</>
          )}
        </Button>
      </form>
    </Form>
  );
}
