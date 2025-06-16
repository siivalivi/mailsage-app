
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth, googleProvider, signInWithPopup, signOut as firebaseSignOut, User, OAuthCredential, UserCredential } from '@/lib/firebase'; // Added UserCredential
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
        } else if (!tokenFromStorage && googleAccessToken) {
             console.warn('[AuthContext] onAuthStateChanged: User PRESENT. Token in state but NOT in sessionStorage. This should ideally not happen if sign-out clears both. Clearing state token.');
             // setGoogleAccessToken(null); // Avoid clearing if a sign-in is in progress which hasn't updated sessionStorage yet
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
    if (typeof window !== 'undefined' && !googleAccessToken && !loading && auth.currentUser) { // Only run if not loading and user is known
        const tokenFromStorage = sessionStorage.getItem('googleAccessToken');
        if (tokenFromStorage) {
            console.log('[AuthContext] Initial mount/hydration effect: Found token in sessionStorage. Setting state.');
            setGoogleAccessToken(tokenFromStorage);
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, auth.currentUser]); // Re-check if loading status changes or user object becomes available


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
      
      // Attempt to get customData if available, which might contain more specific OAuth errors
      if (popupError.customData) {
        console.error("[AuthContext] signInWithGoogle: Popup Error customData:", popupError.customData);
      }
       if (popupError.code === 'auth/popup-closed-by-user') {
        toast({
          variant: "destructive",
          title: "Sign-In Cancelled",
          description: "The sign-in popup was closed before completion.",
        });
      } else if (popupError.code === 'auth/cancelled-popup-request') {
         toast({
          variant: "destructive",
          title: "Sign-In Cancelled",
          description: "Multiple sign-in popups were opened. The request was cancelled.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Sign-In Popup Error",
          description: `An error occurred during the sign-in process: ${popupError.message || 'Please try again.'}`,
          action: <Button variant="outline" size="sm" onClick={() => signInWithGoogle()}>Try Again</Button>,
        });
      }
      setGoogleAccessToken(null);
      if (typeof window !== 'undefined') sessionStorage.removeItem('googleAccessToken');
      setLoading(false); // Ensure loading is false if popup fails
      return; // Stop execution if signInWithPopup itself fails
    }
    
    // Proceed if signInWithPopup resolved
    if (result && result.user) {
      console.log('[AuthContext] signInWithGoogle: User object from result:', result.user);
      const credential = result.credential as OAuthCredential | null;

      if (credential) {
        console.log('[AuthContext] signInWithGoogle: OAuthCredential object from result IS PRESENT. Details:', credential);
        if (credential.accessToken) {
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
          console.warn('[AuthContext] signInWithGoogle: OAuthCredential object PRESENT but its accessToken property is MISSING or falsy.');
          setGoogleAccessToken(null);
          if (typeof window !== 'undefined') sessionStorage.removeItem('googleAccessToken');
          toast({
            variant: "destructive",
            title: "Gmail Permission Token Issue",
            description: "Sign-in was successful, but could not retrieve the specific Gmail access token from the credential. Ensure you grant all permissions on the consent screen and check Google Cloud Console for Gmail API & OAuth config.",
          });
        }
      } else {
        console.warn('[AuthContext] signInWithGoogle: Google OAuth Credential object from result is NULL. User object from result:', result.user);
        setGoogleAccessToken(null);
        if (typeof window !== 'undefined') sessionStorage.removeItem('googleAccessToken');
        toast({
          variant: "destructive",
          title: "Critical: OAuth Credential for Gmail Missing",
          description: "Google Sign-In did not provide an OAuth Credential for Gmail access. This often means permissions were not fully granted on the consent screen, or there's an OAuth configuration issue in Google Cloud (e.g., app in 'Testing' mode but user isn't a 'Test user', or Gmail API not fully enabled/propagated, or incorrect OAuth client ID setup). Please verify your Google Cloud Project settings for the Gmail API and OAuth Consent Screen (including test user list if applicable).",
        });
      }
    } else {
      // This case should ideally be caught by the signInWithPopup catch block if result is null
      console.error("[AuthContext] signInWithGoogle: signInWithPopup result or result.user is null, but no error was caught from signInWithPopup itself. This is unexpected.");
       toast({
        variant: "destructive",
        title: "Sign-In Failed",
        description: "Could not complete sign-in with Google. The result was unexpected. Please try again.",
      });
    }
    // setLoading(false) will be handled by onAuthStateChanged or if an error occurs earlier.
    // If still no currentUser after this process (which would be unusual if result.user was present), ensure loading is false.
    if (!auth.currentUser && !loading) {
        console.log("[AuthContext] signInWithGoogle: Setting loading false as no currentUser yet and not already loading.");
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
      // onAuthStateChanged will handle setCurrentUser(null), setGoogleAccessToken(null), and clearing sessionStorage.
      // It will also set loading to false.
    } catch (error: any) {
      console.error("[AuthContext] signOutUser: Error during sign-out:", error);
      toast({
        variant: "destructive",
        title: "Sign-Out Failed",
        description: error.message || "Could not sign out. Please try again.",
      });
      setLoading(false); // Ensure loading is reset on error if onAuthStateChanged doesn't fire quickly
    }
  };

  const getGoogleAccessToken = (): string | null => {
    // Prioritize state, but check sessionStorage as a fallback (e.g. if state re-initializes after page load)
    if (googleAccessToken) {
      console.log('[AuthContext] getGoogleAccessToken: Returning token from state:', googleAccessToken.substring(0,10)+'...');
      return googleAccessToken;
    }
    if (typeof window !== 'undefined') {
        const tokenFromStorage = sessionStorage.getItem('googleAccessToken');
        if (tokenFromStorage) {
            console.log('[AuthContext] getGoogleAccessToken: Token not in state, but found in sessionStorage. Syncing and returning.');
            setGoogleAccessToken(tokenFromStorage); // Sync to state
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

