
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
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    const storedToken = sessionStorage.getItem('googleAccessToken');
    if (storedToken) {
        setGoogleAccessToken(storedToken);
    }

    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
      if (!user) {
        setGoogleAccessToken(null);
        sessionStorage.removeItem('googleAccessToken');
      }
      // If user exists, token should have been set at sign-in or from session storage already.
      // A robust app would verify token validity here and refresh if necessary.
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = result.credential as OAuthCredential | null;

      if (credential && credential.accessToken) {
        setGoogleAccessToken(credential.accessToken);
        sessionStorage.setItem('googleAccessToken', credential.accessToken);
      } else {
        console.warn('Google OAuth Credential or Access Token not found after sign-in.');
        toast({
          variant: "destructive",
          title: "Sign-In Permissions Issue",
          description: "Could not retrieve necessary permissions for Gmail. Please ensure pop-ups are allowed and try again.",
        });
        // Do not clear currentUser here, onAuthStateChanged will handle the user state.
        // setLoading(false) will be called by onAuthStateChanged
        return; // Early exit if token is not available.
      }
      
      // User will be set by onAuthStateChanged, which also sets loading to false.
      toast({
        title: "Signed In",
        description: "Successfully signed in with Google. You can now query your Gmail.",
      });
      router.push('/dashboard'); // Redirect after successful token retrieval and toast.
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
      setLoading(false); // Explicitly set loading false on error path if onAuthStateChanged doesn't run
    }
    // setLoading will be managed by onAuthStateChanged or error path.
  };

  const signOutUser = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      // setCurrentUser(null) and token clearing is handled by onAuthStateChanged listener.
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
    } finally {
      // setLoading(false) will be handled by onAuthStateChanged if successful,
      // or here if there was an error during the signOut call itself.
      // However, onAuthStateChanged should always fire, making setLoading(false) there more reliable.
       if (auth.currentUser === null) setLoading(false); // only if user is confirmed signed out
    }
  };

  const getGoogleAccessToken = (): string | null => {
    // A more robust implementation would check token expiry and initiate a refresh flow.
    // For this prototype, we directly return the stored token.
    return googleAccessToken || sessionStorage.getItem('googleAccessToken');
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
