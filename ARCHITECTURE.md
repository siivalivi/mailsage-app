# MailSage Application Architecture

This document outlines the architecture of the MailSage application, a Next.js app using Genkit for AI-powered Gmail interaction.

## Design Pattern: Model Context Protocol (MCP)

The application is structured following the principles of the **Model Context Protocol (MCP)**. This pattern is particularly well-suited for modern, AI-driven applications where a packet of information (the Context) is progressively transformed by different services according to a defined sequence (the Protocol).

*   **Model:** The core business logic and data transformation engine. In our app, this is handled by the **Genkit Flows** (e.g., `queryEmailsFlow`). The Model is responsible for the "heavy lifting": executing AI prompts, calling external services like the Gmail API, and structuring the final output. It is the brain of the operation.

*   **Context:** A "packet" of data that travels through the system. It originates from the user (e.g., their natural language query) and is progressively enriched as it moves through the protocol. It includes the user's query, authentication tokens, intermediate data like the raw list of emails from Gmail, and the final, summarized results.

*   **Protocol:** The defined sequence of steps for communication and data transformation. It dictates how the Context moves between different layers of the application.
    1.  The **View** (React Components) captures the initial user input, creating the starting Context.
    2.  The **Controller** (Next.js Server Actions) receives this Context, adds necessary credentials (like the Google Access Token from `AuthContext`), and invokes the Model.
    3.  The **Model** (Genkit Flow) executes its internal, multi-step protocol on the Context: transforming the query, fetching data, refining results, etc.
    4.  The final, enriched Context is returned back up the chain to the View to be displayed to the user.

This separation makes the application robust and scalable. The complex AI orchestration is neatly encapsulated within the Model, which acts on a well-defined Context object following a clear Protocol.

---

## System Architecture Diagram

The following diagram illustrates the main components of the MailSage application and their interactions, reflecting the MCP pattern. The "Context" flows from the user, through the UI and Server Actions, is processed by the Backend Logic (Model), and returns to the user.

```mermaid
graph TD
    %% Define subgraphs for clarity
    subgraph "User Interface (View & Controller Entry)"
        direction TB
        User(["User"])
        
        subgraph "React Components (View)"
            HomePage["/ (HomePage)"]
            DashboardPage["/dashboard (DashboardPage)"]
            EmailPage["/dashboard/email/[id] (EmailPage)"]
            
            subgraph "UI Components"
                QueryForm["QueryForm"]
                EmailList["EmailList/EmailListItem"]
                EmailView["EmailView"]
            end
        end
        
        subgraph "Server Actions (Controller)"
            SA_queryEmails["queryEmails (Server Action)"]
            SA_summarizeEmail["summarizeEmail (Server Action)"]
            SA_summarizeQueriedEmails["summarizeQueriedEmails (Server Action)"]
        end

        User -- "Interacts" --> HomePage
        User -- "Interacts" --> DashboardPage
        
        DashboardPage --> QueryForm
        DashboardPage --> EmailList
        EmailList -- "Selects Email" --> EmailPage
        EmailPage --> EmailView
        
        %% UI to Controller communication
        QueryForm -- "Submits Context (Query)" --> SA_queryEmails
        EmailView -- "Submits Context (Email Body)" --> SA_summarizeEmail
        DashboardPage -- "Submits Context (Summaries)" --> SA_summarizeQueriedEmails
    end

    subgraph "Backend Logic (Model)"
        direction TB
        
        subgraph "Genkit Flows (The Model)"
            F_queryEmails["Flow: queryEmailsFlow"]
            F_summarizeEmail["Flow: summarizeEmailFlow"]
            F_summarizeQueriedEmails["Flow: summarizeQueriedEmailsFlow"]
        end
        
        subgraph "Services (Data Access Layer)"
            S_GmailService["gmailService.ts"]
        end
        
        GenkitInit["Genkit Initialization (src/ai/genkit.ts)"]
        
        %% Controller to Model communication
        SA_queryEmails -- "Invokes Model w/ Context" --> F_queryEmails
        SA_summarizeEmail -- "Invokes Model w/ Context" --> F_summarizeEmail
        SA_summarizeQueriedEmails -- "Invokes Model w/ Context" --> F_summarizeQueriedEmails
        
        %% Model internal communication
        F_queryEmails -- "Calls LLM (to generate query)" --> M_Gemini["Gemini Model"]
        F_queryEmails -- "Uses Service" --> S_GmailService
        F_queryEmails -- "Calls LLM (to refine results)" --> M_Gemini
        F_summarizeEmail -- "Calls LLM" --> M_Gemini
        F_summarizeQueriedEmails -- "Calls LLM" --> M_Gemini
        
        F_queryEmails -- "Uses" --> GenkitInit
        F_summarizeEmail -- "Uses" --> GenkitInit
        F_summarizeQueriedEmails -- "Uses" --> GenkitInit
    end

    subgraph "External Services & APIs"
        direction RL
        
        subgraph "Authentication (Part of Context)"
            AuthContext["AuthContext"]
            FirebaseAuth["Firebase Authentication"]
            GoogleOAuth["Google OAuth 2.0 (gmail.readonly scope)"]
        end
        
        GmailAPI["Gmail API"]
        GoogleAI["Google AI Platform"]
        
        %% External Interactions
        User -- "Signs In Via" --> AuthContext
        AuthContext -- "Authenticates with" --> FirebaseAuth
        FirebaseAuth -- "Uses" --> GoogleOAuth
        GoogleOAuth -- "Provides Access Token" --> AuthContext
        
        AuthContext -- "Provides Token To" --> S_GmailService
        S_GmailService -- "Fetches Messages From" --> GmailAPI
        
        M_Gemini -- "Powered by" --> GoogleAI
        GenkitInit -- "Configures Google AI Plugin" --> GoogleAI
    end

    %% Styling
    classDef view fill:#e6e6fa,stroke:#333,stroke-width:2px;
    classDef controller fill:#90ee90,stroke:#333,stroke-width:2px;
    classDef model fill:#fffacd,stroke:#333,stroke-width:2px;
    classDef service fill:#f08080,stroke:#333,stroke-width:2px;
    classDef external fill:#d3d3d3,stroke:#333,stroke-width:2px;

    class HomePage,DashboardPage,EmailPage,QueryForm,EmailList,EmailView view;
    class SA_queryEmails,SA_summarizeEmail,SA_summarizeQueriedEmails controller;
    class F_queryEmails,F_summarizeEmail,F_summarizeQueriedEmails,M_Gemini model;
    class S_GmailService,GenkitInit service;
    class AuthContext,FirebaseAuth,GoogleOAuth,GmailAPI,GoogleAI external;
```

## Data Flow Summary (The Protocol in Action):

1.  **Sign-In & Context Initialization:** The user signs in. `AuthContext` uses Firebase/Google OAuth to create the initial **Context**, containing the user's identity and a Gmail API `accessToken`.
2.  **User Query (View -> Controller):** The user types a query into `QueryForm`. This action calls the `queryEmails` Server Action, passing a **Context** object containing the user's query text.
3.  **Context Enrichment (Controller -> Model):** The `queryEmails` Server Action enriches the **Context** with the `accessToken` from `AuthContext` and then invokes the `queryEmailsFlow` (the Model).
4.  **Model Execution:** The `queryEmailsFlow` executes its multi-step protocol on the **Context**:
    *   **LLM Call 1:** It sends the `query` from the **Context** to Gemini to transform it into a structured Gmail API search string, adding the result back to the **Context**.
    *   **Service Call:** It uses the new search string and the `accessToken` from the **Context** to call `gmailService`, which fetches email metadata. The results are added to the **Context**.
    *   **LLM Call 2:** It takes the email snippets from the **Context** and sends them back to Gemini for relevance filtering and summarization.
5.  **Final Context (Model -> Controller -> View):** The flow returns the final, fully enriched **Context** containing a structured list of `QueriedEmail` objects. The Server Action passes this back to the `DashboardPage`, which updates its state and displays the results.

This architecture ensures that each part of the application has a clear, distinct responsibility, leading to a more organized and scalable system.