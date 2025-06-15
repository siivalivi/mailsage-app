
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
      console.log('[AuthContext] useState initializer: Token from sessionStorage:', token ? token.substring(0,10)+'...' : 'null');
      return token;
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    console.log('[AuthContext] Root effect monitoring user/token. Current user:', currentUser?.uid, 'Token state:', googleAccessToken ? googleAccessToken.substring(0,10)+'...' : 'null');
    const unsubscribe = auth.onAuthStateChanged(user => {
      console.log('[AuthContext] onAuthStateChanged: Firebase user event. User:', user?.uid);
      setCurrentUser(user);
      if (user) {
        const tokenFromStorage = typeof window !== 'undefined' ? sessionStorage.getItem('googleAccessToken') : null;
        console.log('[AuthContext] onAuthStateChanged: User is PRESENT. Token from storage:', tokenFromStorage ? tokenFromStorage.substring(0,10)+'...' : 'null', 'Token in state:', googleAccessToken ? googleAccessToken.substring(0,10)+'...' : 'null');
        
        if (tokenFromStorage && googleAccessToken !== tokenFromStorage) {
            console.log('[AuthContext] onAuthStateChanged: User PRESENT. Syncing token from sessionStorage to state.');
            setGoogleAccessToken(tokenFromStorage);
        } else if (!tokenFromStorage && googleAccessToken) {
             console.warn('[AuthContext] onAuthStateChanged: User PRESENT. Token in state but NOT in sessionStorage. This might be an issue or a race condition during sign-out/sign-in.');
             // We might clear state token here if sessionStorage is the absolute source of truth after sign-in
             // setGoogleAccessToken(null); 
        } else if (tokenFromStorage && !googleAccessToken) {
            console.log('[AuthContext] onAuthStateChanged: User PRESENT. Token in sessionStorage but NOT in state (e.g. after page load). Syncing.');
            setGoogleAccessToken(tokenFromStorage);
        }
      } else {
        // User is signed out
        console.log('[AuthContext] onAuthStateChanged: User is NULL (signed out). Clearing token state and sessionStorage.');
        setGoogleAccessToken(null);
        if (typeof window !== 'undefined') sessionStorage.removeItem('googleAccessToken');
      }
      setLoading(false);
    });
    return unsubscribe; // Cleanup subscription on unmount
  }, []); // Empty dependency array: runs once on mount, cleans up on unmount. State updates within will trigger re-renders.

  const signInWithGoogle = async () => {
    setLoading(true); // Set loading true at the beginning of the sign-in attempt
    try {
      console.log('[AuthContext] signInWithGoogle: Attempting sign-in.');
      const result = await signInWithPopup(auth, googleProvider);
      console.log('[AuthContext] signInWithGoogle: popup result:', result);
      const credential = result.credential as OAuthCredential | null;
      console.log('[AuthContext] signInWithGoogle: credential object:', credential);

      if (credential && credential.accessToken) {
        console.log('[AuthContext] signInWithGoogle: AccessToken OBTAINED:', credential.accessToken.substring(0, 20) + "...");
        setGoogleAccessToken(credential.accessToken);
        if (typeof window !== 'undefined') sessionStorage.setItem('googleAccessToken', credential.accessToken);
        toast({
          title: "Signed In",
          description: "Successfully signed in and obtained Gmail access. You can now query your Gmail.",
        });
        // currentUser will be set by onAuthStateChanged.
        // setLoading(false) will also be handled by onAuthStateChanged.
        // router.push('/dashboard') is handled by the navigation useEffect.
      } else {
        console.warn('[AuthContext] signInWithGoogle: Google OAuth Credential or Access Token NOT FOUND after sign-in.');
        setGoogleAccessToken(null); 
        if (typeof window !== 'undefined') sessionStorage.removeItem('googleAccessToken');
        toast({
          variant: "destructive",
          title: "Sign-In Permissions Issue",
          description: "Could not retrieve necessary permissions for Gmail. Please ensure pop-ups are allowed and you grant access to Gmail when prompted.",
        });
        // If Firebase auth itself failed (result.user is null), onAuthStateChanged handles currentUser & setLoading.
        // If Firebase auth succeeded but token failed, onAuthStateChanged handles currentUser & setLoading.
      }
    } catch (error: any) {
      console.error("[AuthContext] signInWithGoogle: Error during sign-in:", error);
      setGoogleAccessToken(null);
      if (typeof window !== 'undefined') sessionStorage.removeItem('googleAccessToken');
      toast({
        variant: "destructive",
        title: "Sign-In Failed",
        description: error.message || "Could not sign in with Google. Please try again.",
        action: <Button variant="outline" size="sm" onClick={() => signInWithGoogle()}>Try Again</Button>,
      });
      setLoading(false); // Explicitly set loading to false here as onAuthStateChanged might not fire or be delayed on certain errors.
    }
  };

  const signOutUser = async () => {
    setLoading(true);
    try {
      console.log('[AuthContext] signOutUser: Attempting sign-out.');
      await firebaseSignOut(auth);
      // setGoogleAccessToken(null) & sessionStorage.removeItem handled by onAuthStateChanged
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
      // router.push('/') is handled by the navigation useEffect.
      // setLoading(false) is handled by onAuthStateChanged.
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
    console.log('[AuthContext] getGoogleAccessToken called. Current state token:', googleAccessToken ? googleAccessToken.substring(0,10)+'...' : 'null');
    if (googleAccessToken) {
        return googleAccessToken;
    }
    // Fallback check to sessionStorage if state is unexpectedly null.
    // This is more of a safeguard; ideally, state should be consistently synced.
    if (typeof window !== 'undefined') {
        const tokenFromStorage = sessionStorage.getItem('googleAccessToken');
        if (tokenFromStorage) {
            console.warn('[AuthContext] getGoogleAccessToken: Returning token directly from sessionStorage as state was null. State may be out of sync.');
            // To avoid side-effects in a getter, we don't set state here.
            // The useEffect for onAuthStateChanged should handle state synchronization.
            return tokenFromStorage;
        }
    }
    console.log('[AuthContext] getGoogleAccessToken: Returning null because no token in state or sessionStorage fallback.');
    return null;
  };
  
  useEffect(() => {
    if (!loading) {
      const isAuthPage = pathname === '/';
      if (currentUser && isAuthPage) {
        console.log('[AuthContext] Navigation: User logged in and on auth page, redirecting to /dashboard');
        router.push('/dashboard');
      } else if (!currentUser && !isAuthPage && pathname.startsWith('/dashboard')) {
        console.log('[AuthContext] Navigation: User not logged in and on dashboard page, redirecting to /');
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
