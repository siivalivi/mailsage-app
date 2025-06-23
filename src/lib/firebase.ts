
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User, OAuthCredential, type UserCredential } from 'firebase/auth';

// Retrieve env variables
const apiKeyFromEnv = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomainFromEnv = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectIdFromEnv = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucketFromEnv = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderIdFromEnv = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appIdFromEnv = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

// Define placeholder values to check against
const placeholderApiKey = "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXX"; // Generic placeholder
const placeholderAuthDomain = "your-project-id.firebaseapp.com";
const placeholderProjectId = "your-project-id";
const placeholderStorageBucket = "your-project-id.appspot.com";
const placeholderMessagingSenderId = "000000000000";
const placeholderAppId = "1:000000000000:web:0000000000000000000000";

// CRITICAL CHECK FOR API KEY
if (!apiKeyFromEnv || apiKeyFromEnv === placeholderApiKey || apiKeyFromEnv === 'undefined' || apiKeyFromEnv.startsWith("YOUR_") || apiKeyFromEnv.startsWith("PASTE_")) {
  const errorMsg =
    "CRITICAL FIREBASE CONFIGURATION ERROR: Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY) is missing, a placeholder, or 'undefined' (value: '" + apiKeyFromEnv + "'). " +
    "The application cannot initialize Firebase. \n\n" +
    "POTENTIAL CAUSES & SOLUTIONS:\n" +
    "1. For local development: Ensure your .env file in the project root is correctly populated with NEXT_PUBLIC_FIREBASE_API_KEY and other Firebase credentials.\n" +
    "2. For deployed environments (like Firebase App Hosting): This variable MUST be set in your hosting provider's environment variable configuration. In Firebase App Hosting, this is typically managed via the apphosting.<ENVIRONMENT_NAME>.yaml file (e.g., apphosting.mailsageprod.yaml). Ensure this file is correctly configured and deployed.\n" +
    "3. After setting/modifying environment variables (either in .env or apphosting.<env>.yaml), you MUST REBUILD AND REDEPLOY your application for the changes to take effect.\n" +
    "4. Double-check the variable name NEXT_PUBLIC_FIREBASE_API_KEY for typos in your configuration files.\n\n" +
    "Find your Firebase SDK setup and configuration details in: Firebase project settings -> General tab -> Your apps section.";
  console.error(errorMsg);
  throw new Error(errorMsg); // Halt execution to prevent further errors
}

const firebaseConfig = {
  apiKey: apiKeyFromEnv,
  authDomain: authDomainFromEnv || placeholderAuthDomain,
  projectId: projectIdFromEnv || placeholderProjectId,
  storageBucket: storageBucketFromEnv || "mailsage-erevl.appspot.com", 
  messagingSenderId: messagingSenderIdFromEnv || placeholderMessagingSenderId,
  appId: appIdFromEnv || placeholderAppId,
};

// WARNING FOR OTHER PLACEHOLDER VALUES
const warnings = [];
if (!authDomainFromEnv || authDomainFromEnv === placeholderAuthDomain) warnings.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
if (!projectIdFromEnv || projectIdFromEnv === placeholderProjectId) warnings.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
// Corrected warning condition for storage bucket
if (!storageBucketFromEnv || storageBucketFromEnv === placeholderStorageBucket) warnings.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET may be using a hardcoded or placeholder value");
if (!messagingSenderIdFromEnv || messagingSenderIdFromEnv === placeholderMessagingSenderId) warnings.push("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
if (!appIdFromEnv || appIdFromEnv === placeholderAppId) warnings.push("NEXT_PUBLIC_FIREBASE_APP_ID");

if (warnings.length > 0) {
  console.warn(
    "FIREBASE CONFIG WARNING: The following Firebase configuration values might be using default placeholder values or are missing from the environment: " + warnings.join(', ') + ".\n" +
    "This could lead to unexpected behavior if these services are used. \n\n" +
    "Effective Firebase Config (API Key shown partially for security):\n" +
    `  apiKey: ${firebaseConfig.apiKey ? firebaseConfig.apiKey.substring(0, 8) + "..." : "MISSING!"}\n` +
    `  authDomain: ${firebaseConfig.authDomain} (from env: ${authDomainFromEnv || 'MISSING'})\n` +
    `  projectId: ${firebaseConfig.projectId} (from env: ${projectIdFromEnv || 'MISSING'})\n` +
    `  storageBucket: ${firebaseConfig.storageBucket} (from env: ${storageBucketFromEnv || 'MISSING or using fallback'})\n` +
    `  messagingSenderId: ${firebaseConfig.messagingSenderId} (from env: ${messagingSenderIdFromEnv || 'MISSING'})\n` +
    `  appId: ${firebaseConfig.appId} (from env: ${appIdFromEnv || 'MISSING'})\n\n` +
    "Ensure your apphosting.<ENVIRONMENT_NAME>.yaml (for deployed environments) or .env file (for local development) contains all correct NEXT_PUBLIC_ prefixed Firebase credentials from your Firebase project settings. " +
    "If you've recently updated these, a rebuild/redeploy of the application is likely necessary."
  );
}

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Add scope to request access to Gmail API
googleProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');
// Force consent screen every time for debugging OAuth token retrieval
googleProvider.setCustomParameters({
  prompt: 'consent'
});


export { auth, googleProvider, signInWithPopup, signOut, type User, type OAuthCredential, type UserCredential };
