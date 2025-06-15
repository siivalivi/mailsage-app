'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Email } from '@/types'; // Using the more detailed Email type
import { ArrowRight, CalendarDays, UserCircle } from 'lucide-react';

interface EmailListItemProps {
  email: Email; // Expecting the enriched Email type which includes id and timestamp
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

export default function EmailListItem({ email }: EmailListItemProps) {
  return (
    <Link href={`/dashboard/email/${email.id}`} passHref legacyBehavior>
      <a className="block group outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg">
        <Card className="hover:shadow-lg transition-shadow duration-200 ease-in-out cursor-pointer group-hover:border-primary">
          <CardHeader>
            <div className="flex justify-between items-start">
              <CardTitle className="text-xl mb-1 group-hover:text-primary transition-colors">{email.subject}</CardTitle>
              {!email.isRead && <Badge variant="destructive" className="ml-2 shrink-0">New</Badge>}
            </div>
            <CardDescription className="flex flex-col sm:flex-row sm:items-center sm:gap-4 text-sm">
              <span className="flex items-center">
                <UserCircle className="w-4 h-4 mr-1 text-muted-foreground" />
                {email.sender}
              </span>
              <span className="flex items-center mt-1 sm:mt-0">
                <CalendarDays className="w-4 h-4 mr-1 text-muted-foreground" />
                {formatDate(email.timestamp)}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground line-clamp-2">
              {email.summary || email.body.substring(0,150) + "..."}
            </p>
            <div className="flex justify-end items-center mt-4 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              View Email <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </CardContent>
        </Card>
      </a>
    </Link>
  );
}
