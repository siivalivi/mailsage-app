'use client';

import SignInButton from '@/components/auth/SignInButton';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Mail, Zap, Search } from 'lucide-react'; // Zap for summarize, Search for query

export default function HomePage() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && currentUser) {
      router.push('/dashboard');
    }
  }, [currentUser, loading, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary p-4">
        <Mail className="h-24 w-24 text-primary animate-pulse" />
        <p className="text-xl text-foreground mt-4">Loading MailSage...</p>
      </div>
    );
  }

  if (currentUser) {
     // This case should ideally be handled by the redirect in useEffect,
     // but as a fallback or during brief state transitions:
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary p-4">
        <p className="text-xl text-foreground">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary p-6 text-center">
      <div className="bg-card p-8 rounded-xl shadow-2xl max-w-md w-full">
        <Mail className="h-20 w-20 text-primary mx-auto mb-6" />
        <h1 className="text-5xl font-bold text-primary mb-4">MailSage</h1>
        <p className="text-muted-foreground text-lg mb-8">
          Your intelligent assistant for Gmail. Summarize threads and find emails with natural language.
        </p>
        
        <div className="space-y-4 mb-10">
          <div className="flex items-center justify-center text-left p-3 bg-secondary/50 rounded-lg">
            <Zap className="h-6 w-6 text-accent mr-3 shrink-0" />
            <p className="text-foreground/80">Instantly summarize long email threads.</p>
          </div>
          <div className="flex items-center justify-center text-left p-3 bg-secondary/50 rounded-lg">
            <Search className="h-6 w-6 text-accent mr-3 shrink-0" />
            <p className="text-foreground/80">Query your inbox using everyday language.</p>
          </div>
        </div>

        <SignInButton />
        
        <p className="text-xs text-muted-foreground mt-8">
          By signing in, you agree to our imaginary Terms of Service.
        </p>
      </div>
    </div>
  );
}
