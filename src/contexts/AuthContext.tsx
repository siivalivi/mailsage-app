
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth, googleProvider, signInWithPopup, signOut as firebaseSignOut, User, OAuthCredential, UserCredential } from '@/lib/firebase'; 
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
    console.log('[AuthContext] Root effect: Initializing. Setting loading to true.');
    setLoading(true);
    const unsubscribe = auth.onAuthStateChanged(user => {
      console.log('[AuthContext] onAuthStateChanged: Firebase user event. User UID:', user?.uid);
      setCurrentUser(user);
      if (user) {
        const tokenFromStorage = typeof window !== 'undefined' ? sessionStorage.getItem('googleAccessToken') : null;
        console.log(`[AuthContext] onAuthStateChanged: User IS PRESENT. Token from sessionStorage: ${tokenFromStorage ? tokenFromStorage.substring(0,10)+'...' : 'null'}. Current state token: ${googleAccessToken ? googleAccessToken.substring(0,10)+'...' : 'null'}`);
        
        if (tokenFromStorage && googleAccessToken !== tokenFromStorage) {
            console.log('[AuthContext] onAuthStateChanged: Syncing token from sessionStorage to state.');
            setGoogleAccessToken(tokenFromStorage);
        } else if (tokenFromStorage && !googleAccessToken) {
            console.log('[AuthContext] onAuthStateChanged: User PRESENT. Token in sessionStorage but NOT in state. Syncing.');
            setGoogleAccessToken(tokenFromStorage);
        }
      } else {
        console.log('[AuthContext] onAuthStateChanged: User IS NULL (signed out). Clearing token state and sessionStorage.');
        setGoogleAccessToken(null);
        if (typeof window !== 'undefined') sessionStorage.removeItem('googleAccessToken');
      }
      console.log('[AuthContext] onAuthStateChanged: Setting loading to false.');
      setLoading(false);
    });
    return () => {
      console.log('[AuthContext] Root effect cleanup: Unsubscribing from onAuthStateChanged.');
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (typeof window !== 'undefined' && !googleAccessToken && !loading && auth.currentUser) { 
        const tokenFromStorage = sessionStorage.getItem('googleAccessToken');
        if (tokenFromStorage) {
            console.log('[AuthContext] Initial mount/hydration effect: Found token in sessionStorage. Setting state.');
            setGoogleAccessToken(tokenFromStorage);
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, auth.currentUser]);


  const signInWithGoogle = async () => {
    console.log('[AuthContext] signInWithGoogle: Initiating sign-in. Setting loading to true.');
    setLoading(true);

    console.log('[AuthContext] signInWithGoogle: Provider scopes:', JSON.stringify(googleProvider.getScopes()));
    console.log('[AuthContext] signInWithGoogle: Provider custom parameters:', JSON.stringify(googleProvider.customParameters));

    let result: UserCredential | null = null;
    try {
      result = await signInWithPopup(auth, googleProvider);
      console.log('[AuthContext] signInWithGoogle: signInWithPopup promise resolved. Full result object:', result);
    } catch (popupError: any) {
      console.error("[AuthContext] signInWithGoogle: Error DIRECTLY from signInWithPopup:", popupError);
      console.error("[AuthContext] signInWithGoogle: Popup Error Code:", popupError.code);
      console.error("[AuthContext] signInWithGoogle: Popup Error Message:", popupError.message);
      
      if (popupError.customData) {
        console.error("[AuthContext] signInWithGoogle: Popup Error customData:", popupError.customData);
      }
       if (popupError.code === 'auth/popup-closed-by-user' || popupError.code === 'auth/cancelled-popup-request') {
        toast({
          variant: "destructive",
          title: "Sign-In Cancelled",
          description: "The Google Sign-In popup was closed or interrupted before completion.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Sign-In Popup Error",
          description: `An error occurred during the Google Sign-In process: ${popupError.message || 'Please try again.'}`,
          action: <Button variant="outline" size="sm" onClick={() => signInWithGoogle()}>Try Again</Button>,
        });
      }
      setGoogleAccessToken(null);
      if (typeof window !== 'undefined') sessionStorage.removeItem('googleAccessToken');
      setLoading(false); 
      return; 
    }
    
    if (result && result.user) {
      console.log('[AuthContext] signInWithGoogle: User object from result:', result.user);
      
      // Log the raw credential object from the result
      console.log('[AuthContext] signInWithGoogle: Raw result.credential object:', result.credential);

      const credential = result.credential as OAuthCredential | null; 

      if (credential && credential.accessToken) {
        const token = credential.accessToken;
        console.log('[AuthContext] signInWithGoogle: OAuth AccessToken for Google Services OBTAINED:', token.substring(0, 20) + "...");
        setGoogleAccessToken(token);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('googleAccessToken', token);
          console.log('[AuthContext] signInWithGoogle: OAuth Token stored in sessionStorage.');
        }
        toast({
          title: "Signed In & Gmail Access Granted",
          description: "Successfully obtained permissions to access Gmail.",
        });
      } else {
        console.warn('[AuthContext] signInWithGoogle: Google OAuthCredential (result.credential) is NULL or lacks an accessToken. User object from result:', result.user);
        setGoogleAccessToken(null);
        if (typeof window !== 'undefined') sessionStorage.removeItem('googleAccessToken');
        toast({
          variant: "destructive",
          title: "Gmail Permission Denied or Unavailable",
          description: "Sign-in was successful, but MailSage could not obtain specific permission to access your Gmail. This can happen if Gmail permissions were denied on the consent screen, or if there's an issue with your Google Cloud Project's OAuth configuration (e.g., app is in 'Testing' mode but your email isn't a 'Test user', or Gmail API not fully enabled/propagated). Please verify consent screen choices and Google Cloud settings, then try signing in again.",
          action: <Button variant="outline" size="sm" onClick={() => {
            signOutUser().then(() => signInWithGoogle()); // Try full sign-out then sign-in
          }}>Re-Authenticate</Button>
        });
      }
    } else {
      console.error("[AuthContext] signInWithGoogle: signInWithPopup result or result.user is null/undefined, but no error was caught from signInWithPopup. This is unexpected.");
       toast({
        variant: "destructive",
        title: "Sign-In Failed Unexpectedly",
        description: "Could not complete sign-in with Google due to an unexpected issue. Please try again.",
      });
    }
    
    // setLoading(false) will typically be handled by onAuthStateChanged.
    // Ensure it's false if we fall through without a user or token somehow.
    if (!auth.currentUser && !loading) {
        console.log("[AuthContext] signInWithGoogle: Setting loading false as no currentUser yet and not already loading (edge case).");
        setLoading(false);
    }
  };

  const signOutUser = async () => {
    console.log('[AuthContext] signOutUser: Initiating sign-out. Setting loading to true.');
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
      // onAuthStateChanged will handle setCurrentUser(null), setGoogleAccessToken(null), sessionStorage.removeItem, and setLoading(false).
    } catch (error: any) {
      console.error("[AuthContext] signOutUser: Error during sign-out:", error);
      toast({
        variant: "destructive",
        title: "Sign-Out Failed",
        description: error.message || "Could not sign out. Please try again.",
      });
      setLoading(false); 
    }
  };

  const getGoogleAccessToken = (): string | null => {
    if (googleAccessToken) {
      console.log('[AuthContext] getGoogleAccessToken: Returning token from state:', googleAccessToken.substring(0,10)+'...');
      return googleAccessToken;
    }
    if (typeof window !== 'undefined') {
        const tokenFromStorage = sessionStorage.getItem('googleAccessToken');
        if (tokenFromStorage) {
            console.log('[AuthContext] getGoogleAccessToken: Token not in state, but found in sessionStorage. Syncing to state and returning.');
            setGoogleAccessToken(tokenFromStorage); 
            return tokenFromStorage;
        }
    }
    console.log('[AuthContext] getGoogleAccessToken: Token not found in state or sessionStorage.');
    return null;
  };
  
  useEffect(() => {
    console.log(`[AuthContext] Navigation effect: loading=${loading}, currentUserUID=${currentUser?.uid}, pathname=${pathname}`);
    if (!loading) {
      const isAuthPage = pathname === '/';
      if (currentUser && isAuthPage) {
        console.log('[AuthContext] Navigation: User logged in and on auth page, redirecting to /dashboard');
        router.push('/dashboard');
      } else if (!currentUser && !isAuthPage && pathname.startsWith('/dashboard')) {
        // Only redirect to '/' if not already on an auth-related page
        // This prevents redirect loops if e.g. a settings page is introduced that doesn't require auth
        // For now, assuming all non-'/' pages under /dashboard/* require auth
        console.log('[AuthContext] Navigation: User not logged in and on protected page, redirecting to /');
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
