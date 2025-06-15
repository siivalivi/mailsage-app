
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';

const apiKeyFromEnv = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomainFromEnv = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectIdFromEnv = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucketFromEnv = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderIdFromEnv = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appIdFromEnv = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

const placeholderApiKey = "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXX"; // Default placeholder

if (!apiKeyFromEnv || apiKeyFromEnv === placeholderApiKey) {
  console.warn(
    "WARNING: Firebase API Key is missing or using a placeholder value. " +
    "Please create a .env file in the project root and add your Firebase project's configuration. " +
    "For example:\n\n" +
    "NEXT_PUBLIC_FIREBASE_API_KEY=your_actual_api_key\n" +
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_actual_auth_domain\n" +
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_actual_project_id\n" +
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_actual_storage_bucket\n" +
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_actual_sender_id\n" +
    "NEXT_PUBLIC_FIREBASE_APP_ID=your_actual_app_id\n\n" +
    "The application may not function correctly until these are set. " +
    "You can find these values in your Firebase project settings (Project settings > General > Your apps > Web app)."
  );
}

const firebaseConfig = {
  apiKey: apiKeyFromEnv || placeholderApiKey,
  authDomain: authDomainFromEnv || "your-project-id.firebaseapp.com",
  projectId: projectIdFromEnv || "your-project-id",
  storageBucket: storageBucketFromEnv || "your-project-id.appspot.com",
  messagingSenderId: messagingSenderIdFromEnv || "000000000000",
  appId: appIdFromEnv || "1:000000000000:web:0000000000000000000000",
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Add scope to request access to Gmail API if needed in future, for now just basic profile
// googleProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');

export { auth, googleProvider, signInWithPopup, signOut, type User };
