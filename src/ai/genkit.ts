
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// CRITICAL CHECK FOR GOOGLE_API_KEY
// Genkit's googleAI plugin uses GOOGLE_API_KEY or GEMINI_API_KEY.
// We check for GOOGLE_API_KEY as the primary, but either will work if set.
const googleApiKeyFromEnv = process.env.GOOGLE_API_KEY;
const geminiApiKeyFromEnv = process.env.GEMINI_API_KEY; // Fallback if GOOGLE_API_KEY is not set

if ((!googleApiKeyFromEnv || googleApiKeyFromEnv.startsWith("YOUR_") || googleApiKeyFromEnv.startsWith("PASTE_") || googleApiKeyFromEnv === "AIzaSyBFrz8N_uGTrSkpivKRfMg9z5JEjDUxdcM" /* This is Firebase API Key, not Genkit key */) &&
    (!geminiApiKeyFromEnv || geminiApiKeyFromEnv.startsWith("YOUR_") || geminiApiKeyFromEnv.startsWith("PASTE_") || geminiApiKeyFromEnv === "AIzaSyBFrz8N_uGTrSkpivKRfMg9z5JEjDUxdcM")) {
  const errorMsg =
    "CRITICAL GENKIT CONFIGURATION ERROR: The GOOGLE_API_KEY (or GEMINI_API_KEY) environment variable is not set, is a placeholder, or is incorrectly set to the Firebase API Key. " +
    "Genkit requires this API key to communicate with Google AI services (e.g., Gemini).\n\n" +
    "POTENTIAL CAUSES & SOLUTIONS:\n" +
    "1. For local development: Ensure your .env file in the project root contains GOOGLE_API_KEY=<your_actual_genkit_api_key> (e.g., AIzaSy...). Do NOT use your Firebase API Key here.\n" +
    "2. For deployed environments (like Firebase App Hosting): This variable MUST be set in your hosting provider's environment variable configuration. In Firebase App Hosting, this is managed via the apphosting.<ENVIRONMENT_NAME>.yaml file (e.g., apphosting.mailsageprod.yaml). Ensure this file is correctly configured with the Genkit API key and deployed.\n" +
    "3. After setting/modifying the environment variable (either in .env or apphosting.<env>.yaml), you MUST REBUILD AND REDEPLOY your application for the changes to take effect.\n\n" +
    "You can obtain a Genkit/Google AI API key from Google AI Studio by visiting https://aistudio.google.com/app/apikey.\n" +
    "Current GOOGLE_API_KEY: " + googleApiKeyFromEnv + "\n" +
    "Current GEMINI_API_KEY: " + geminiApiKeyFromEnv;
  console.error(errorMsg);
  throw new Error(errorMsg); // Halt execution to prevent further errors
}

export const ai = genkit({
  plugins: [googleAI()], // This will automatically use GOOGLE_API_KEY or GEMINI_API_KEY from the environment
  model: 'googleai/gemini-2.0-flash', // Default model for the application
});
