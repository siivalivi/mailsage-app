
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';

// Retrieve env variables
const apiKeyFromEnv = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomainFromEnv = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectIdFromEnv = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucketFromEnv = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderIdFromEnv = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appIdFromEnv = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

// Define placeholder values to check against
const placeholderApiKey = "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXX";
const placeholderAuthDomain = "your-project-id.firebaseapp.com";
const placeholderProjectId = "your-project-id";
const placeholderStorageBucket = "your-project-id.appspot.com";
const placeholderMessagingSenderId = "000000000000";
const placeholderAppId = "1:000000000000:web:0000000000000000000000"; // Generic placeholder for App ID

// CRITICAL CHECK FOR API KEY
if (!apiKeyFromEnv || apiKeyFromEnv === placeholderApiKey) {
  const errorMsg = "CRITICAL FIREBASE CONFIGURATION ERROR: Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY) is missing or is a placeholder ('" + apiKeyFromEnv + "'). " +
                   "The application cannot initialize Firebase. \n\n" +
                   "POTENTIAL CAUSES & SOLUTIONS:\n" +
                   "1. Ensure your .env file in the project root is correctly populated with your actual Firebase project credentials. All keys must be prefixed with NEXT_PUBLIC_.\n" +
                   "2. The application (especially in a deployed environment like GCP/Firebase App Hosting) MUST BE REBUILT AND REDEPLOYED, or the instance restarted, after .env file changes for them to take effect.\n" +
                   "3. Double-check the variable name NEXT_PUBLIC_FIREBASE_API_KEY for typos in your .env file.\n\n" +
                   "Find your Firebase SDK setup and configuration details in: Firebase project settings -> General tab -> Your apps section.";
  console.error(errorMsg);
  throw new Error(errorMsg); // Halt execution to prevent further errors
}

const firebaseConfig = {
  apiKey: apiKeyFromEnv, // Already validated
  authDomain: authDomainFromEnv || placeholderAuthDomain,
  projectId: projectIdFromEnv || placeholderProjectId,
  storageBucket: storageBucketFromEnv || placeholderStorageBucket,
  messagingSenderId: messagingSenderIdFromEnv || placeholderMessagingSenderId,
  appId: appIdFromEnv || placeholderAppId,
};

// WARNING FOR OTHER PLACEHOLDER VALUES
if (firebaseConfig.authDomain === placeholderAuthDomain ||
    firebaseConfig.projectId === placeholderProjectId ||
    firebaseConfig.storageBucket === placeholderStorageBucket ||
    firebaseConfig.messagingSenderId === placeholderMessagingSenderId ||
    (firebaseConfig.appId === placeholderAppId && appIdFromEnv !== placeholderAppId) // Warn if appId is default due to missing env, but not if placeholderAppId was the actual (unlikely) env value
   ) {
  console.warn(
    "WARNING: One or more Firebase configuration values (e.g., Auth Domain, Project ID) might be using default placeholder values. " +
    "This could lead to unexpected behavior if these services are used. \n\n" +
    "Effective Firebase Config (API Key shown partially for security):\n" +
    `  apiKey: ${firebaseConfig.apiKey ? firebaseConfig.apiKey.substring(0, 8) + "..." : "MISSING!"}\n` +
    `  authDomain: ${firebaseConfig.authDomain}\n` +
    `  projectId: ${firebaseConfig.projectId}\n` +
    `  storageBucket: ${firebaseConfig.storageBucket}\n` +
    `  messagingSenderId: ${firebaseConfig.messagingSenderId}\n` +
    `  appId: ${firebaseConfig.appId}\n\n` +
    "Ensure your .env file contains all correct NEXT_PUBLIC_ prefixed Firebase credentials from your Firebase project settings. " +
    "If you've recently updated .env, a rebuild/redeploy of the application is likely necessary."
  );
}

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Add scope to request access to Gmail API if needed in future, for now just basic profile
// googleProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');

export { auth, googleProvider, signInWithPopup, signOut, type User };
