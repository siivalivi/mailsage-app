'use client';

import Link from 'next/link';
import SignOutButton from '@/components/auth/SignOutButton';
import { Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function Header() {
  const { currentUser } = useAuth();

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/dashboard" className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
          <Mail className="h-7 w-7" />
          <h1 className="text-2xl font-headline font-semibold">MailSage</h1>
        </Link>
        {currentUser && <SignOutButton />}
      </div>
    </header>
  );
}
