
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
  query: z.string().min(1, { message: 'Query cannot be empty.' }),
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
    console.log('[QueryForm] onSubmit called. Data:', data);
    if (!currentUser) {
      toast({ variant: 'destructive', title: 'Not Authenticated', description: 'Please sign in to query emails.' });
      setIsLoading(false); // Ensure loading is false if we return early
      return;
    }

    const accessToken = getGoogleAccessToken();
    console.log(`[QueryForm] AccessToken for query: ${accessToken ? accessToken.substring(0,10) + '...' : 'MISSING'}`);

    if (!accessToken) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'Access token for Gmail is missing or expired. Please try signing in again to refresh permissions.',
        action: <Button variant="outline" size="sm" onClick={async () => {
          await signInWithGoogle();
        }}>Refresh Sign-In</Button>
      });
      setIsLoading(false);
      return;
    }

    setIsSubmitting(true);
    setIsLoading(true);
    try {
      console.log(`[QueryForm] Attempting to call queryEmails server action with query: "${data.query}" and accessToken (first 10): ${accessToken.substring(0,10)}...`);
      const result = await queryEmails({ query: data.query, accessToken });
      console.log('[QueryForm] queryEmails server action returned. Result:', result);
      onQuerySubmit(result.emailList);
      toast({
        title: 'Gmail Query Processed',
        description: `Found and processed ${result.emailList.length} email(s) from your Gmail account.`,
      });
    } catch (error: any) {
      console.error('[QueryForm] Error calling queryEmails server action:', error);
      let errorMessage = 'An error occurred while querying your emails from Gmail.';
      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast({
        variant: 'destructive',
        title: 'Gmail Query Failed',
        description: errorMessage,
        duration: 7000, // Longer duration for error messages
      });
      // Check for specific token-related errors if possible (though this error is client-side interpretation)
      if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('token')) {
         toast({ // This might show a second toast, or can be combined
            variant: 'destructive',
            title: 'Gmail Access Expired/Revoked?',
            description: 'Permission to access Gmail may have expired. Please try signing in again.',
            action: <Button variant="outline" size="sm" onClick={signInWithGoogle}>Refresh Sign-In</Button>,
            duration: 10000,
         });
      }
      onQuerySubmit([]); 
    } finally {
      setIsSubmitting(false);
      setIsLoading(false);
      console.log('[QueryForm] onSubmit finally block. isSubmitting:', false, 'isLoading:', false);
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
