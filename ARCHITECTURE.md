
# MailSage Application Architecture

This document outlines the architecture of the MailSage application, a Next.js app using Genkit for AI-powered Gmail interaction.

## I. Frontend (Client-Side - Next.js with React & ShadCN UI)

```
User Browser
│
├─── 1. UI Components (src/app, src/components)
│    │
│    ├─── HomePage (`/`)
│    │    └── SignInButton -> invokes AuthContext.signInWithGoogle()
│    │
│    ├─── DashboardPage (`/dashboard`)
│    │    ├─── QueryForm
│    │    │    └── User inputs natural language query (e.g., "LinkedIn bills 2025")
│    │    │        │
│    │    │        └───[Client Action Call]───> 2. queryEmails (Server Action)
│    │    │                                       (passes query & access token)
│    │    │                                                │
│    │    │        <───[Returns List<QueriedEmail>]────────┘
│    │    │                 │
│    │    │                 └─── Adapts to List<Email> for display
│    │    │                 │
│    │    │                 └───[Client Action Call]───> 3. summarizeQueriedEmails (Server Action)
│    │    │                                               (passes adapted summaries)
│    │    │                                                        │
│    │    │                 <───[Returns OverallSummary]────────────┘
│    │    │
│    │    ├─── EmailList / EmailListItem
│    │    │    └── Displays queried emails. Clicking an item:
│    │    │        └── Navigates to EmailPage (stores email data in localStorage)
│    │    │
│    │    └── Overall Summary Card
│    │         └── Displays the overall summary from summarizeQueriedEmails.
│    │
│    ├─── EmailPage (`/dashboard/email/[id]`)
│    │    ├─── Reads email data (potentially including full body) from localStorage or EmailView fetches it.
│    │    ├─── EmailView
│    │    │    └── Displays email subject, sender, date.
│    │    │    └── "Original Email" section:
│    │    │        └── Renders HTML email body using `dangerouslySetInnerHTML`.
│    │    │    └── "AI Summary" section:
│    │    │        └── Displays existing summary or:
│    │    │        └── Button ("Summarize") ───[Client Action Call]───> 4. summarizeEmail (Server Action)
│    │    │                                                              (passes full email body)
│    │    │                                                                      │
│    │    │            <───[Returns new Email.summary]───────────────────────────┘
│    │
│    └─── AuthContext (`src/contexts/AuthContext.tsx`)
│         ├─── Manages user state (currentUser, loading).
│         ├─── Handles Google Sign-In via Firebase Auth.
│         └─── Obtains and stores Google OAuth Access Token (with `gmail.readonly` scope) in sessionStorage.
│
├─── Firebase SDK (`src/lib/firebase.ts`)
     └── Interfaces with Firebase Authentication.
```

## II. Backend (Server-Side - Next.js Server Actions & Genkit)

```
Next.js Server Environment
│
├─── Genkit Initialization (`src/ai/genkit.ts`)
│    └── Configures Genkit with Google AI plugin (Gemini models).
│
├─── 2. queryEmails Server Action (`src/ai/flows/query-emails.ts`)
│    │   Input: { userQuery: string, accessToken: string, _internalDebugMessages: string[] }
│    │
│    ├─── a. Get Current Date
│    │      └── For accurate relative date interpretation by LLM.
│    │
│    ├─── b. LLM Call 1: Transform Query (`transformQueryPrompt`)
│    │    │   Input: { userQuery, currentDate }
│    │    │   Model: Gemini
│    │    │   Task: Convert natural language (e.g., "LinkedIn bills 2025")
│    │    │         into a Gmail API search string (e.g., "from:linkedin (bill OR invoice) after:2024/12/31 before:2026/01/01").
│    │    │   Output: { gmailApiQuery: string }
│    │
│    ├─── c. Call Gmail Service (`gmailService.fetchGmailMessages`)
│    │    │   Input: { accessToken, gmailApiQuery (from step b), maxResults, debugMessages }
│    │    │   └───> Makes API call to III. Gmail API (messages.list)
│    │    │   <─── Returns List of {id, sender, subject, snippet, timestamp}
│    │
│    ├─── d. LLM Call 2: Refine & Summarize Snippets (`refineAndSummarizeEmailsPrompt`)
│    │    │   Input: { originalUserQuery, fetchedGmailEmails (from step c) }
│    │    │   Model: Gemini
│    │    │   Task: Evaluate each fetched email's snippet against the original user query's intent (e.g., financial relevance for "bills").
│    │    │         Filter out irrelevant emails.
│    │    │         Generate a concise, focused summary for each relevant email's snippet.
│    │    │   Output: { emailList: List<QueriedEmail> } (QueriedEmail includes id, sender, subject, snippet, timestamp, AI summary)
│    │
│    └─── Returns `emailList` to client.
│
├─── 3. summarizeQueriedEmails Server Action (`src/ai/flows/summarize-queried-emails-flow.ts`)
│    │   Input: { queriedEmails: List<{sender, subject, summary (from queryEmails output)}> }
│    │
│    ├─── a. LLM Call (`summarizeQueriedEmailsPrompt`)
│    │    │   Model: Gemini
│    │    │   Task: Synthesize an overall "executive summary" from the list of individual email summaries.
│    │    │   Output: { overallSummary: string }
│    │
│    └─── Returns `overallSummary` to client.
│
├─── 4. summarizeEmail Server Action (`src/ai/flows/summarize-email.ts`)
│    │   Input: { emailContent: string (full HTML body of one email) }
│    │
│    ├─── a. LLM Call (`summarizeEmailPrompt`)
│    │    │   Model: Gemini
│    │    │   Task: Generate a concise summary of the provided email content.
│    │    │   Output: { summary: string }
│    │
│    └─── Returns `summary` to client.
│
├─── Gmail Service (`src/services/gmailService.ts`)
     │
     ├─── fetchGmailMessages(accessToken, queryString, maxResults, debugMessages)
     │    └───> Calls III. Gmail API (messages.list with `q=queryString`)
     │    └───> For each message ID, calls III. Gmail API (messages.get with `format=metadata`)
     │    <─── Returns List of {id, sender, subject, snippet, timestamp}
     │
     └─── fetchGmailMessageBody(accessToken, messageId, debugMessages)
          └───> Calls III. Gmail API (messages.get with `format=full`)
          <─── Returns HTML string of email body.
```

## III. External Services & APIs

```
┌─────────────────────────┐      ┌──────────────────────────┐      ┌─────────────────────────┐
│ Firebase Authentication │<---->│ User's Google Account    │<---->│ Google OAuth 2.0        │
└─────────────────────────┘      └──────────────────────────┘      └─────────────────────────┘
          ∧                                                                │ (Grants Access Token
          │ (Handles Sign-In)                                              │  for Gmail API)
          │                                                                ∨
Frontend App (AuthContext)───────────────────────────────────────────> III. Gmail API
                                                                           │  (api.google.com/gmail/v1)
                                                                           │  ├─ messages.list
                                                                           │  └─ messages.get
Backend (Genkit Flows, gmailService)───────────────────────────────────────┘
          ∧
          │ (Genkit calls)
          ∨
┌─────────────────────────┐
│ Google AI Platform      │
│ (Gemini Models via Genkit)│
└─────────────────────────┘
```

## Data Flow Summary for a Typical Query:

1.  **User signs in:** `AuthContext` -> Firebase Auth -> Google OAuth -> `accessToken` stored.
2.  **User types query on Dashboard:** `QueryForm` -> `queryEmails` (Server Action).
3.  **`queryEmails` Action:**
    *   (LLM 1) Transforms query to Gmail API string.
    *   `gmailService` calls Gmail API, gets message list & metadata/snippets.
    *   (LLM 2) Refines list & summarizes snippets.
    *   Returns list of `QueriedEmail` objects to `DashboardPage`.
4.  **`DashboardPage`:**
    *   Displays email list.
    *   Calls `summarizeQueriedEmails` (Server Action) with summaries.
5.  **`summarizeQueriedEmails` Action:**
    *   (LLM 3) Generates overall summary.
    *   Returns overall summary to `DashboardPage`.
6.  **User clicks an email:** Navigates to `EmailPage`.
7.  **`EmailPage` / `EmailView`:**
    *   Displays email. `fetchGmailMessageBody` might be called if full body isn't cached.
    *   User clicks "Summarize" -> `summarizeEmail` (Server Action).
8.  **`summarizeEmail` Action:**
    *   (LLM 4) Summarizes full email body.
    *   Returns summary to `EmailView`.

This provides a good overview of the system's structure and how data moves through it.
