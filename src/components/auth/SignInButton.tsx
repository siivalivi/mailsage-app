'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Chrome } from 'lucide-react'; // Using Chrome as a stand-in for Google icon

export default function SignInButton() {
  const { signInWithGoogle, loading } = useAuth();

  return (
    <Button
      onClick={signInWithGoogle}
      disabled={loading}
      size="lg"
      className="w-full max-w-xs font-headline"
      aria-label="Sign in with Google"
    >
      <Chrome className="mr-2 h-5 w-5" />
      Sign in with Google
    </Button>
  );
}
