
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth, googleProvider, signInWithPopup, signOut as firebaseSignOut, User, OAuthCredential } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  getGoogleAccessToken: () => string | null; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  // Initialize googleAccessToken state directly from sessionStorage on first render
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('googleAccessToken');
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
      if (user) {
        // User is signed in.
        // Attempt to load token from session storage if not already in state.
        // This helps if the AuthProvider re-mounts or state was lost but sessionStorage has the token.
        const tokenFromStorage = sessionStorage.getItem('googleAccessToken');
        if (tokenFromStorage && googleAccessToken !== tokenFromStorage) { 
            setGoogleAccessToken(tokenFromStorage);
        }
        // If tokenFromStorage is null here, it means it wasn't set during signIn or was cleared.
        // The user might be authenticated with Firebase but without a Gmail access token.
      } else {
        // User is signed out
        setGoogleAccessToken(null);
        sessionStorage.removeItem('googleAccessToken');
      }
      setLoading(false);
    });
    return unsubscribe; // Cleanup subscription on unmount
  }, [googleAccessToken]); // Add googleAccessToken to dependency array to re-evaluate if it changes externally

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = result.credential as OAuthCredential | null;

      if (credential && credential.accessToken) {
        setGoogleAccessToken(credential.accessToken);
        sessionStorage.setItem('googleAccessToken', credential.accessToken);
        // currentUser will be set by onAuthStateChanged
        toast({
          title: "Signed In",
          description: "Successfully signed in with Google and obtained Gmail access. You can now query your Gmail.",
        });
        router.push('/dashboard'); 
      } else {
        console.warn('Google OAuth Credential or Access Token not found after sign-in. Gmail features will be unavailable.');
        setGoogleAccessToken(null); 
        sessionStorage.removeItem('googleAccessToken');
        toast({
          variant: "destructive",
          title: "Sign-In Permissions Issue",
          description: "Could not retrieve necessary permissions for Gmail. Please ensure pop-ups are allowed and you grant access to Gmail when prompted. Gmail features will be unavailable.",
        });
        // User might be signed into Firebase, but without Gmail token.
        // onAuthStateChanged will set currentUser and setLoading(false).
        // If user is set, they might be redirected to dashboard but Gmail queries will fail.
        if (result.user) router.push('/dashboard'); // Still go to dashboard if Firebase user exists
        else setLoading(false); // If no Firebase user, ensure loading is false
        return; 
      }
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      setGoogleAccessToken(null);
      sessionStorage.removeItem('googleAccessToken');
      toast({
        variant: "destructive",
        title: "Sign-In Failed",
        description: error.message || "Could not sign in with Google. Please try again.",
        action: <Button variant="outline" size="sm" onClick={() => signInWithGoogle()}>Try Again</Button>,
      });
      setLoading(false); 
    }
  };

  const signOutUser = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      // setGoogleAccessToken(null) & sessionStorage.removeItem handled by onAuthStateChanged
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
      router.push('/');
    } catch (error: any) {
      console.error("Sign-Out Error:", error);
      toast({
        variant: "destructive",
        title: "Sign-Out Failed",
        description: error.message || "Could not sign out. Please try again.",
      });
      setLoading(false); // Ensure loading is false on sign-out error
    }
    // setLoading(false) primarily handled by onAuthStateChanged for success
  };

  const getGoogleAccessToken = (): string | null => {
    // Prioritize state, then session storage. State should be synced from session storage.
    if (googleAccessToken) return googleAccessToken;
    if (typeof window !== 'undefined') {
        return sessionStorage.getItem('googleAccessToken');
    }
    return null;
  };
  
  useEffect(() => {
    if (!loading) {
      const isAuthPage = pathname === '/';
      if (currentUser && isAuthPage) {
        router.push('/dashboard');
      } else if (!currentUser && !isAuthPage && pathname.startsWith('/dashboard')) {
        router.push('/');
      }
    }
  }, [currentUser, loading, router, pathname]);

  return (
    <AuthContext.Provider value={{ currentUser, loading, signInWithGoogle, signOutUser, getGoogleAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

