
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
  }, []); // Removed googleAccessToken from dependencies as it caused potential loops with sessionStorage


  useEffect(() => {
    // This effect runs once on mount if not loading, or when loading status changes.
    // It tries to initialize googleAccessToken from sessionStorage if a Firebase user is already active.
    if (typeof window !== 'undefined' && !googleAccessToken && !loading && auth.currentUser) { 
        const tokenFromStorage = sessionStorage.getItem('googleAccessToken');
        if (tokenFromStorage) {
            console.log('[AuthContext] Initial mount/hydration effect: Found token in sessionStorage for active user. Setting state.');
            setGoogleAccessToken(tokenFromStorage);
        } else {
            console.log('[AuthContext] Initial mount/hydration effect: Active user but no token in sessionStorage.');
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, auth.currentUser]); // Runs when loading state changes or auth.currentUser object reference changes


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
      } else if (popupError.code === 'auth/popup-blocked') {
        toast({
          variant: "destructive",
          title: "Popup Blocked",
          description: "The Google Sign-In popup was blocked by your browser. Please allow popups for this site and try again.",
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
      // Ensure loading is set to false if popup fails before user object is processed
      if (!auth.currentUser) { // Check if a user object was ever established
        console.log("[AuthContext] signInWithGoogle (popupError): No current user after popup error, setting loading false.");
        setLoading(false); 
      }
      return; 
    }
    
    if (result && result.user) {
      console.log('[AuthContext] signInWithGoogle: User object from result:', result.user);
      setCurrentUser(result.user); // Update current user state immediately
      
      console.log('[AuthContext] signInWithGoogle: Raw result.credential object:', result.credential);

      // IMPORTANT: This is where we expect the OAuthCredential for Google services
      const credential = result.credential as OAuthCredential | null; 

      if (credential && credential.accessToken) {
        const token = credential.accessToken;
        console.log('[AuthContext] signInWithGoogle: Google OAuth AccessToken for Google Services OBTAINED:', token.substring(0, 20) + "...");
        setGoogleAccessToken(token);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('googleAccessToken', token);
          console.log('[AuthContext] signInWithGoogle: Google OAuth Token stored in sessionStorage.');
        }
        toast({
          title: "Signed In & Gmail Access Granted",
          description: "Successfully obtained permissions to access Gmail.",
        });
      } else {
        console.warn('[AuthContext] signInWithGoogle: Google OAuth Credential object from result is NULL or lacks an accessToken. This is needed for Gmail. User object from result:', result.user);
        setGoogleAccessToken(null);
        if (typeof window !== 'undefined') sessionStorage.removeItem('googleAccessToken');
        toast({
          variant: "destructive",
          title: "Sign-In Permissions Issue (Gmail Access Token)",
          description: "Sign-in to MailSage was successful, but the specific OAuth access token for Gmail was not obtained. This can happen if Gmail permissions were denied on the consent screen, if the Gmail API is not enabled in your Google Cloud Project, or if your app (in 'Testing' mode on GCP) doesn't list this account as a 'Test user'. Please check consent choices, ensure Gmail API is enabled in GCP, and verify 'Test user' settings if applicable.",
          action: <Button variant="outline" size="sm" onClick={() => {
            signOutUser().then(() => signInWithGoogle());
          }}>Re-Authenticate</Button>
        });
      }
    } else {
      console.error("[AuthContext] signInWithGoogle: signInWithPopup result or result.user is null/undefined, but no error was caught. This is unexpected.");
       toast({
        variant: "destructive",
        title: "Sign-In Failed Unexpectedly",
        description: "Could not complete sign-in with Google due to an unexpected issue. Please try again.",
      });
      // setLoading(false) might already be handled by onAuthStateChanged if user becomes null
    }
    
    // If after all this, loading is still true and no user, set loading to false.
    // This covers edge cases where onAuthStateChanged might not fire immediately or as expected.
    // However, onAuthStateChanged should set loading to false once user state stabilizes.
    // The primary setLoading(false) call is within onAuthStateChanged.
    console.log("[AuthContext] signInWithGoogle: End of function. Current loading state:", loading, "CurrentUser UID:", auth.currentUser?.uid);
  };

  const signOutUser = async () => {
    console.log('[AuthContext] signOutUser: Initiating sign-out. Setting loading to true.');
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      // setGoogleAccessToken(null); // Done by onAuthStateChanged
      // if (typeof window !== 'undefined') sessionStorage.removeItem('googleAccessToken'); // Done by onAuthStateChanged
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
      // router.push('/'); // Navigation is handled by the useEffect down below
    } catch (error: any) {
      console.error("[AuthContext] signOutUser: Error during sign-out:", error);
      toast({
        variant: "destructive",
        title: "Sign-Out Failed",
        description: error.message || "Could not sign out. Please try again.",
      });
      setLoading(false); // Ensure loading is false if sign-out errors
    }
  };

  const getGoogleAccessToken = (): string | null => {
    console.log(`[AuthContext] getGoogleAccessToken called. Current state token: ${googleAccessToken ? googleAccessToken.substring(0,10)+'...' : 'null'}`);
    if (googleAccessToken) {
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

