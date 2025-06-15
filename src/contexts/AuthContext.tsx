
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
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const token = sessionStorage.getItem('googleAccessToken');
      console.log('[AuthContext] Initializer: Token from sessionStorage:', token ? token.substring(0,10)+'...' : 'null');
      return token;
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    console.log('[AuthContext] Root effect (onAuthStateChanged subscription setup). Initializing loading to true.');
    setLoading(true); 
    const unsubscribe = auth.onAuthStateChanged(user => {
      console.log('[AuthContext] onAuthStateChanged: Firebase user event. User UID:', user?.uid);
      setCurrentUser(user);
      if (user) {
        const tokenFromStorage = typeof window !== 'undefined' ? sessionStorage.getItem('googleAccessToken') : null;
        console.log(`[AuthContext] onAuthStateChanged: User IS PRESENT. Token from storage: ${tokenFromStorage ? tokenFromStorage.substring(0,10)+'...' : 'null'}. Current state token: ${googleAccessToken ? googleAccessToken.substring(0,10)+'...' : 'null'}`);
        
        if (tokenFromStorage && googleAccessToken !== tokenFromStorage) {
            console.log('[AuthContext] onAuthStateChanged: Syncing token from sessionStorage to state because different.');
            setGoogleAccessToken(tokenFromStorage);
        } else if (tokenFromStorage && !googleAccessToken) {
            console.log('[AuthContext] onAuthStateChanged: User PRESENT. Token in sessionStorage but NOT in state (e.g. after page load or state loss). Syncing.');
            setGoogleAccessToken(tokenFromStorage);
        } else if (!tokenFromStorage && googleAccessToken) {
             console.warn('[AuthContext] onAuthStateChanged: User PRESENT. Token in state but NOT in sessionStorage. This could happen if storage was cleared externally. Clearing state token.');
             setGoogleAccessToken(null); // sessionStorage is source of truth after sign-in.
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
  }, []); // googleAccessToken removed from deps to prevent loops, sessionStorage sync is handled inside.

  const signInWithGoogle = async () => {
    console.log('[AuthContext] signInWithGoogle: Initiating sign-in. Setting loading to true.');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log('[AuthContext] signInWithGoogle: popup result object:', result); 
      
      const credential = result.credential as OAuthCredential | null;
      // Log the credential object in detail to understand its structure or why it might be null
      if (credential) {
        console.log('[AuthContext] signInWithGoogle: credential object from result IS PRESENT. Details:', JSON.stringify(credential)); 
        if (credential.accessToken) {
          const token = credential.accessToken;
          console.log('[AuthContext] signInWithGoogle: AccessToken OBTAINED:', token.substring(0, 20) + "...");
          setGoogleAccessToken(token);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('googleAccessToken', token);
            console.log('[AuthContext] signInWithGoogle: Token stored in sessionStorage.');
          }
          toast({
            title: "Signed In & Gmail Access Granted",
            description: "Successfully obtained permissions to access Gmail.",
          });
          // currentUser will be set by onAuthStateChanged, which also sets loading to false.
        } else {
          console.warn('[AuthContext] signInWithGoogle: Credential object PRESENT but accessToken property is MISSING or falsy.');
          setGoogleAccessToken(null); 
          if (typeof window !== 'undefined') sessionStorage.removeItem('googleAccessToken');
          toast({
            variant: "destructive",
            title: "Gmail Permission Issue",
            description: "Sign-in was successful, but could not retrieve Gmail access token. Ensure Gmail API is enabled in Google Cloud Console and you grant permissions on the consent screen.",
          });
          setLoading(false); // setLoading false here because onAuthStateChanged might not fire if user is already set
        }
      } else {
        console.warn('[AuthContext] signInWithGoogle: Google OAuth Credential object from result is NULL. User object from result:', result.user);
        setGoogleAccessToken(null); 
        if (typeof window !== 'undefined') sessionStorage.removeItem('googleAccessToken');
        toast({
          variant: "destructive",
          title: "Sign-In Permissions Issue",
          description: "Could not retrieve Google OAuth credential for Gmail access. Please ensure pop-ups are allowed, you grant Gmail access when prompted, and the Gmail API is enabled in your Google Cloud Console project. Also check if your account is a test user if the app is in testing mode.",
        });
        setLoading(false); // setLoading false here if credential is null
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
      setLoading(false); 
    }
  };

  const signOutUser = async () => {
    console.log('[AuthContext] signOutUser: Initiating sign-out. Setting loading to true.');
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      // setGoogleAccessToken(null), sessionStorage.removeItem, and setCurrentUser(null) are handled by onAuthStateChanged
      // which also sets loading to false.
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
      // No need to manually set loading to false; onAuthStateChanged will handle it.
    } catch (error: any) {
      console.error("[AuthContext] signOutUser: Error during sign-out:", error);
      toast({
        variant: "destructive",
        title: "Sign-Out Failed",
        description: error.message || "Could not sign out. Please try again.",
      });
      setLoading(false); // Set loading false here in case onAuthStateChanged doesn't fire or is delayed
    }
  };

  const getGoogleAccessToken = (): string | null => {
    console.log('[AuthContext] getGoogleAccessToken called. Current state token:', googleAccessToken ? googleAccessToken.substring(0,10)+'...' : 'null');
    if (typeof window !== 'undefined') {
        const tokenFromStorage = sessionStorage.getItem('googleAccessToken');
        if (!googleAccessToken && tokenFromStorage) {
            console.log('[AuthContext] getGoogleAccessToken: State token is null, but found token in storage. Returning storage token and updating state.');
            setGoogleAccessToken(tokenFromStorage);
            return tokenFromStorage;
        }
         if (googleAccessToken && tokenFromStorage && googleAccessToken !== tokenFromStorage) {
            console.warn('[AuthContext] getGoogleAccessToken: State token MISMATCHES storage token. Preferring state, but this is unusual. State:', googleAccessToken.substring(0,10)+'...', 'Storage:', tokenFromStorage.substring(0,10)+'...');
        }
    }
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

