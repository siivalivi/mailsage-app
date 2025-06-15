
'use server';

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// CRITICAL CHECK FOR GOOGLE_API_KEY
// Genkit's googleAI plugin uses GOOGLE_API_KEY or GEMINI_API_KEY.
// We check for GOOGLE_API_KEY as the primary, but either will work if set.
const googleApiKeyFromEnv = process.env.GOOGLE_API_KEY;
const geminiApiKeyFromEnv = process.env.GEMINI_API_KEY; // Fallback if GOOGLE_API_KEY is not set

if (!googleApiKeyFromEnv && !geminiApiKeyFromEnv) {
  const errorMsg =
    "CRITICAL GENKIT CONFIGURATION ERROR: The GOOGLE_API_KEY (or GEMINI_API_KEY) environment variable is not set. " +
    "Genkit requires this API key to communicate with Google AI services (e.g., Gemini).\n\n" +
    "POTENTIAL CAUSES & SOLUTIONS:\n" +
    "1. For local development: Ensure your .env file in the project root contains GOOGLE_API_KEY=<your_actual_api_key>.\n" +
    "2. For deployed environments (like Firebase App Hosting): This variable MUST be set in your hosting provider's environment variable configuration (e.g., apphosting.<env>.yaml file).\n" +
    "   - In Firebase App Hosting, ensure your apphosting.<ENVIRONMENT_NAME>.yaml file (e.g., apphosting.mailsageprod.yaml) correctly defines GOOGLE_API_KEY.\n" +
    "3. After setting the environment variable in a deployed environment (e.g., by modifying apphosting.<env>.yaml), you MUST REBUILD AND REDEPLOY your application for the changes to take effect.\n\n" +
    "You can obtain an API key from Google AI Studio (MakerSuite) by visiting https://aistudio.google.com/app/apikey.";
  console.error(errorMsg);
  throw new Error(errorMsg); // Halt execution to prevent further errors
}

export const ai = genkit({
  plugins: [googleAI()], // This will automatically use GOOGLE_API_KEY or GEMINI_API_KEY from the environment
  model: 'googleai/gemini-2.0-flash', // Default model for the application
});

    