'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export default function SignOutButton() {
  const { signOutUser, loading } = useAuth();

  return (
    <Button
      variant="outline"
      onClick={signOutUser}
      disabled={loading}
      aria-label="Sign out"
    >
      <LogOut className="mr-2 h-4 w-4" />
      Sign Out
    </Button>
  );
}
