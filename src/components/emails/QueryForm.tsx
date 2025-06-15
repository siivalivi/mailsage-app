'use client';

import { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Search, Loader2 } from 'lucide-react';
import { queryEmails, QueryEmailsInput, QueryEmailsOutput } from '@/ai/flows/query-emails';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  query: z.string().min(3, { message: 'Query must be at least 3 characters long.' }),
});

type QueryFormValues = z.infer<typeof formSchema>;

interface QueryFormProps {
  onQuerySubmit: (results: QueryEmailsOutput['emailList']) => void;
  setIsLoading: (loading: boolean) => void;
}

export default function QueryForm({ onQuerySubmit, setIsLoading }: QueryFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<QueryFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      query: '',
    },
  });

  const onSubmit: SubmitHandler<QueryFormValues> = async (data) => {
    setIsSubmitting(true);
    setIsLoading(true);
    try {
      const result = await queryEmails({ query: data.query } as QueryEmailsInput);
      onQuerySubmit(result.emailList);
      toast({
        title: 'Query Successful',
        description: `Found ${result.emailList.length} email(s) matching your query.`,
      });
    } catch (error: any) {
      console.error('Error querying emails:', error);
      toast({
        variant: 'destructive',
        title: 'Query Failed',
        description: error.message || 'An error occurred while querying emails.',
      });
      onQuerySubmit([]); // Clear previous results on error
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
                    placeholder="e.g., 'find emails about the Smith project from last week'"
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
        <Button type="submit" disabled={isSubmitting} className="h-12 text-base px-6">
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>Ask MailSage</>
          )}
        </Button>
      </form>
    </Form>
  );
}
