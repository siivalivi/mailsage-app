
'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Email } from '@/types';
import { ArrowRight, CalendarDays, UserCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface EmailListItemProps {
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

export default function EmailListItem({ email }: EmailListItemProps) {
  const router = useRouter();

  const handleItemClick = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`email-${email.id}`, JSON.stringify(email));
      } catch (error) {
        console.error("Error saving email to localStorage:", error);
        // Potentially show a toast to the user if localStorage is full or disabled
      }
    }
    router.push(`/dashboard/email/${email.id}`);
  };

  return (
    // By separating onClick and onKeyDown, and calling preventDefault in onKeyDown,
    // we prevent a single keyboard press from firing the handler twice.
    <div
      onClick={handleItemClick}
      className="block group outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg h-full cursor-pointer"
      role="link" // ARIA role for accessibility
      tabIndex={0} // Make it focusable
      onKeyDown={(e) => { 
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault(); // Prevents the key press from also triggering a 'click' event
          handleItemClick();
        }
      }}
    >
      <Card className="hover:shadow-lg transition-shadow duration-200 ease-in-out group-hover:border-primary h-full">
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
            {email.summary || (email.body ? email.body.substring(0, 150) + "..." : "No preview available.")}
          </p>
          <div className="flex justify-end items-center mt-4 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            View Email <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
