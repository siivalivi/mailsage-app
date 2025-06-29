# MailSage Application Architecture

This document outlines the architecture of the MailSage application, a Next.js app using Genkit for AI-powered Gmail interaction.

## Design Pattern: Model Context Protocol (MCP)

The application is structured following the principles of the **Model Context Protocol (MCP)**. This pattern is particularly well-suited for modern, AI-driven applications where a packet of information (the Context) is progressively transformed by different services according to a defined sequence (the Protocol).

*   **Model:** The core business logic and data transformation engine. In our app, this is handled by the **Genkit Flows** (e.g., `queryEmailsFlow`) which run exclusively on the server. The Model is responsible for the "heavy lifting": executing AI prompts, calling external services like the Gmail API, and structuring the final output.

*   **Context:** A "packet" of data that travels through the system. It originates from the user on the client, is passed to the server, and is progressively enriched as it moves through the protocol. It includes the user's query, authentication tokens, intermediate data like the raw list of emails from Gmail, and the final, summarized results.

*   **Protocol:** The defined sequence of steps for communication and data transformation. It dictates how the Context moves between the client and server.
    1.  The **View** (React Components on the Client) captures the initial user input, creating the starting Context.
    2.  The **Controller** (Next.js Server Actions on the Server) receives this Context, adds necessary server-side credentials (like the Google Access Token), and invokes the Model.
    3.  The **Model** (Genkit Flow on the Server) executes its internal, multi-step protocol on the Context.
    4.  The final, enriched Context is returned back to the Client to be displayed in the View.

This separation makes the application robust and scalable. The complex AI orchestration is neatly encapsulated within the server-side Model, which acts on a well-defined Context object following a clear Protocol that bridges the client and server.

### Client-Server Roles in MCP

-   **Client:** The user's web browser. This environment is responsible for rendering the user interface and capturing user interaction. It runs our **React Components** (`'use client'`) which form the "View" layer of the application.

-   **Server:** The Next.js backend. This environment handles all business logic, data fetching, and communication with external APIs. It runs our **Server Actions** (the "Controller") and the **Genkit Flows** (the "Model"). No sensitive logic or keys ever reside on the client. The transition from client to server happens when a UI component invokes a Server Action.

---

## Comprehensive Testing Strategy for an MCP Architecture

A key advantage of the MCP pattern is its testability. By clearly separating concerns (View, Controller, Model), we can test each part independently, leading to a robust and reliable application. Our testing strategy uses Jest and is broken down into two main categories:

### 1. Component Testing (The View & Controller Interface)

*   **Tooling**: We use **React Testing Library** to test our React components.
*   **Goal**: To verify the user-facing experience and the interaction between the View and the Controller.
*   **Process**:
    1.  Render a component (e.g., `QueryForm`) in Jest's virtual test environment.
    2.  Simulate user actions, such as typing into an input field or clicking a button (`fireEvent`).
    3.  Assert that the UI updates as expected—for example, a loading spinner appears, an error message is shown, or results are displayed (`expect(screen.getByText(...))`).

*   **The Key Technique**: The most crucial aspect of testing the View is **mocking the Controller (Server Actions)**. Our component tests *do not* execute the actual server-side code. Instead, we use `jest.mock` to replace a Server Action (like `queryEmails`) with a fake function. This allows us to:
    *   **Verify the Call**: Confirm that the component calls the correct action with the correct `Context` data (e.g., `expect(mockedQueryEmails).toHaveBeenCalledWith({ query: 'test', ... })`).
    *   **Simulate Outcomes**: Force the mock function to return success or error states, allowing us to test how the UI handles different server responses (e.g., displaying results vs. showing an error toast).
    *   **Isolate and Speed Up**: Keep tests fast and focused solely on the UI's behavior, completely independent of the backend logic.

### 2. Unit Testing (The Model)

*   **Tooling**: We use **Jest** in a Node.js environment to test our Genkit flows.
*   **Goal**: To verify the server-side business logic, AI orchestration, and data transformations.
*   **Process**:
    1.  Import the flow function (e.g., `queryEmails`) directly into the test file.
    2.  Provide it with a sample input `Context` object.
    3.  Assert that the flow returns the expected transformed output.

*   **The Key Technique**: Similar to the front-end, the key here is **mocking external dependencies**. Our flow unit tests *do not* make real API calls to Google AI or the Gmail API. We use `jest.mock` to replace `ai.generate` and our `gmailService` with fake functions. This lets us:
    *   **Test Orchestration**: Verify the flow's internal logic. For example, in `queryEmailsFlow`, we test: "Does it call the AI first to get a search string, *then* call the Gmail service with that string, *then* call the AI again to summarize the results?"
    *   **Simulate External APIs**: Control the data returned by the fake AI and Gmail calls, allowing us to test our flow's error handling and data transformation logic under various conditions.
    *   **Ensure Stability**: Keep tests lightning-fast, free of charge, and completely independent of external network conditions or API changes.

### Conclusion

By combining these two testing strategies, we achieve comprehensive coverage of our entire application. **Component tests** validate the user's interaction with the `View` and its contract with the `Controller`, while **Unit tests** validate the complex business logic within the `Model`. This layered approach ensures that every part of the Model-Context-Protocol works exactly as designed, giving us high confidence in the final product.

---

## System Architecture Diagram

```mermaid
graph TD
    %% Define subgraphs for clarity
    subgraph "Client-Side (User's Browser)"
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

        User -- "Interacts With" --> HomePage
        User -- "Interacts With" --> DashboardPage
        
        DashboardPage --> QueryForm
        DashboardPage --> EmailList
        EmailList -- "Selects Email" --> EmailPage
        EmailPage --> EmailView
    end

    subgraph "Server-Side (Next.js Backend)"
        direction TB
        
        subgraph "Server Actions (Controller)"
            SA_queryEmails["queryEmails"]
            SA_summarizeEmail["summarizeEmail"]
            SA_summarizeQueriedEmails["summarizeQueriedEmails"]
        end
        
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
        F_queryEmails -- "Uses Service" --> S_GmailService
        F_queryEmails -- "Calls LLM" --> M_Gemini["Gemini Model"]
        F_summarizeEmail -- "Calls LLM" --> M_Gemini
        F_summarizeQueriedEmails -- "Calls LLM" --> M_Gemini
        
        F_queryEmails -- "Uses" --> GenkitInit
        F_summarizeEmail -- "Uses" --> GenkitInit
        F_summarizeQueriedEmails -- "Uses" --> GenkitInit
    end
    
    %% Client to Server communication
    QueryForm -- "Submits Context (Query) via RPC" --> SA_queryEmails
    EmailView -- "Submits Context (Email Body) via RPC" --> SA_summarizeEmail
    DashboardPage -- "Submits Context (Summaries) via RPC" --> SA_summarizeQueriedEmails


    subgraph "External Services & APIs"
        direction RL
        
        subgraph "Authentication"
            AuthContext["AuthContext (Client-Side)"]
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
    classDef client fill:#e6e6fa,stroke:#333,stroke-width:2px;
    classDef server fill:#d4fcd7,stroke:#333,stroke-width:2px;
    classDef external fill:#d3d3d3,stroke:#333,stroke-width:2px;

    class HomePage,DashboardPage,EmailPage,QueryForm,EmailList,EmailView,AuthContext client;
    class SA_queryEmails,SA_summarizeEmail,SA_summarizeQueriedEmails,F_queryEmails,F_summarizeEmail,F_summarizeQueriedEmails,M_Gemini,S_GmailService,GenkitInit server;
    class FirebaseAuth,GoogleOAuth,GmailAPI,GoogleAI external;

```

## Data Flow Summary (The Protocol in Action):

1.  **Sign-In & Context Initialization (Client):** The user signs in. `AuthContext` uses Firebase/Google OAuth to create the initial **Context**, containing the user's identity and a Gmail API `accessToken`.
2.  **User Query (Client -> Server):** The user types a query into `QueryForm` on the client. This action calls the `queryEmails` Server Action, passing a **Context** object containing the query text across the network to the server.
3.  **Context Enrichment (Server):** The `queryEmails` Server Action enriches the **Context** with the `accessToken` from `AuthContext` and then invokes the `queryEmailsFlow` model.
4.  **Model Execution (Server):** The `queryEmailsFlow` executes its multi-step protocol on the **Context**:
    *   **LLM Call 1:** It sends the `query` from the **Context** to Gemini to transform it into a structured Gmail API search string.
    *   **Service Call:** It uses the new search string and the `accessToken` to call `gmailService`, which fetches email metadata from the external Gmail API.
    *   **LLM Call 2:** It takes the email snippets and sends them back to Gemini for relevance filtering and summarization.
5.  **Final Context (Server -> Client):** The flow returns the final, fully enriched **Context** containing a structured list of `QueriedEmail` objects. The Server Action passes this back to the `DashboardPage` on the client, which updates its state and displays the results.

## Flexibility of MCP vs. Direct API Calls

The core benefit of the MCP architecture is the **flexibility** gained by decoupling the client from the server's business logic.

### The Inflexible Approach: Direct API Calls from the Client

If our React components were to call the Google AI and Gmail APIs directly, the client would be:
*   **Insecure:** The browser would have to manage the user's sensitive Google Access Token and the Google AI API Key, making them vulnerable to theft.
*   **Rigid:** The client would be hard-coded to call specific versions of the Gmail and Gemini APIs. Any change to these external APIs would require updating, testing, and redeploying our client-side application.
*   **Complex:** The client would need to contain all the orchestration logic (call AI for query -> call Gmail -> call AI for summary). This makes the client "heavy," harder to maintain, and prone to bugs.

### The MCP Approach: Flexibility Through Abstraction

By using MCP, we gain enormous flexibility:
*   **The Client is Decoupled:** The client's only responsibility is to send a simple `query` string. It doesn't know or care how the server generates the results.
*   **The Server "Protocol" is Flexible:** We can change the server-side logic at any time without affecting the client. For example, we could:
    *   Swap `gemini-2.0-flash` for a more powerful model.
    *   Add a database caching layer to reduce Gmail API calls.
    *   Introduce a third AI step to categorize emails by urgency.
    *   Add more data sources besides Gmail.
*   **The Security is Centralized:** All credentials and complex logic are managed in one secure, server-side location.

In short, MCP treats the complex, multi-step process of querying emails as a black box. The client provides input to the box, and the server is free to change the internal wiring of that box at any time, providing ultimate flexibility and security.
