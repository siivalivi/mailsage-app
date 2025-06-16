
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
             console.warn('[AuthContext] onAuthStateChanged: User PRESENT. Token in state but NOT in sessionStorage. Clearing state token.');
             setGoogleAccessToken(null);
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
    // Initialize token from sessionStorage on mount if not already set by onAuthStateChanged
    if (typeof window !== 'undefined' && !googleAccessToken) {
        const tokenFromStorage = sessionStorage.getItem('googleAccessToken');
        if (tokenFromStorage) {
            console.log('[AuthContext] Initial mount/hydration effect: Found token in sessionStorage. Setting state.');
            setGoogleAccessToken(tokenFromStorage);
        }
    }
  }, []); // Runs once on mount


  const signInWithGoogle = async () => {
    console.log('[AuthContext] signInWithGoogle: Initiating sign-in. Setting loading to true.');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log('[AuthContext] signInWithGoogle: popup result object received. User:', result.user?.uid); 
      
      // THIS IS THE CRITICAL PART: result.credential
      const credential = result.credential as OAuthCredential | null;

      if (credential) {
        console.log('[AuthContext] signInWithGoogle: credential object from result IS PRESENT.');
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
          console.warn('[AuthContext] signInWithGoogle: Credential object PRESENT but its accessToken property is MISSING or falsy.');
          setGoogleAccessToken(null); 
          if (typeof window !== 'undefined') sessionStorage.removeItem('googleAccessToken');
          toast({
            variant: "destructive",
            title: "Gmail Permission Token Issue",
            description: "Sign-in was successful, but could not retrieve the specific Gmail access token from the credential. Ensure Gmail API is enabled and you grant all permissions on the consent screen.",
          });
        }
      } else {
        console.warn('[AuthContext] signInWithGoogle: Google OAuth Credential object from result is NULL. User object from result:', result.user);
        setGoogleAccessToken(null); 
        if (typeof window !== 'undefined') sessionStorage.removeItem('googleAccessToken');
        toast({
          variant: "destructive",
          title: "Critical: OAuth Credential for Gmail Missing",
          description: "Google Sign-In did not provide an OAuth Credential for Gmail access. This often means permissions were not granted on the consent screen, or there's an OAuth configuration issue (e.g., app in 'Testing' mode but user isn't a 'Test user', or Gmail API not fully enabled/propagated). Please check Google Cloud Console.",
        });
      }
    } catch (error: any) {
      console.error("[AuthContext] signInWithGoogle: Error during sign-in popup:", error);
      setGoogleAccessToken(null);
      if (typeof window !== 'undefined') sessionStorage.removeItem('googleAccessToken');
      toast({
        variant: "destructive",
        title: "Sign-In Failed",
        description: error.message || "Could not sign in with Google. Please try again.",
        action: <Button variant="outline" size="sm" onClick={() => signInWithGoogle()}>Try Again</Button>,
      });
    } finally {
        // Loading will be set to false by onAuthStateChanged, or here if an early error occurs.
        // However, ensure it's always set if signInWithGoogle completes but onAuthStateChanged might be delayed or not fire.
        if (!auth.currentUser) { // If after all this, there's still no currentUser, then set loading false.
             setLoading(false);
             console.log("[AuthContext] signInWithGoogle: Setting loading false in finally block as no currentUser yet.");
        }
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
    } catch (error: any) {
      console.error("[AuthContext] signOutUser: Error during sign-out:", error);
      toast({
        variant: "destructive",
        title: "Sign-Out Failed",
        description: error.message || "Could not sign out. Please try again.",
      });
    } finally {
        // onAuthStateChanged will handle setCurrentUser(null), setGoogleAccessToken(null), and setLoading(false)
        // Adding a safeguard if onAuthStateChanged is slow or fails.
        if (auth.currentUser) {
            setLoading(false); // Should not happen, means sign out failed but error wasn't caught
        }
    }
  };

  const getGoogleAccessToken = (): string | null => {
    if (typeof window !== 'undefined') {
        const tokenFromStorage = sessionStorage.getItem('googleAccessToken');
        if (tokenFromStorage && tokenFromStorage !== googleAccessToken) {
            console.log('[AuthContext] getGoogleAccessToken: Syncing token from sessionStorage to state during access.');
            setGoogleAccessToken(tokenFromStorage);
            return tokenFromStorage;
        }
    }
    console.log('[AuthContext] getGoogleAccessToken called. Returning current state token:', googleAccessToken ? googleAccessToken.substring(0,10)+'...' : 'null');
    return googleAccessToken;
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

