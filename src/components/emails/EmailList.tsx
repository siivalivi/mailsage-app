'use client';

import { Email } from '@/types';
import EmailListItem from './EmailListItem';
import { Skeleton } from '@/components/ui/skeleton';
import { Inbox } from 'lucide-react';

interface EmailListProps {
  emails: Email[];
  isLoading: boolean;
}

export default function EmailList({ emails, isLoading }: EmailListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
        {[...Array(4)].map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="text-center py-10">
        <Inbox className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">No Emails Found</h3>
        <p className="text-muted-foreground">
          Try a different query or check back later. <br/> If you haven&apos;t searched yet, your results will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
      {emails.map(email => (
        <EmailListItem key={email.id} email={email} />
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="p-6 border rounded-lg shadow-sm bg-card">
      <Skeleton className="h-6 w-3/4 mb-2" />
      <Skeleton className="h-4 w-1/2 mb-4" />
      <Skeleton className="h-4 w-full mb-1" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}
