
'use server';

// This service interacts with the Gmail API.
// It's designed to be called from a server environment (e.g., Genkit flow)
// and requires a valid OAuth 2.0 access token for the user.

interface GmailMessageHeader {
  name: string;
  value: string;
}

interface GmailMessagePartBody {
  attachmentId?: string;
  size: number;
  data?: string; // base64url encoded
}

interface GmailMessagePart {
  partId: string;
  mimeType: string;
  filename: string;
  headers: GmailMessageHeader[];
  body: GmailMessagePartBody;
  parts?: GmailMessagePart[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: string; // timestamp ms string
  payload: GmailMessagePart;
  sizeEstimate: number;
  raw?: string;
}

export interface FetchedEmailData {
  id: string;
  sender: string;
  subject: string;
  snippet: string;
  timestamp: number; // Unix timestamp
}

function getHeaderValue(headers: GmailMessageHeader[], name: string): string {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : 'N/A';
}

function decodeBase64Url(data: string): string {
  // Replace Base64 URL specific characters
  let base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  // Pad with '=' if necessary
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

// Helper to append to debug messages if the array is provided
const appendToDebug = (debugMessages: string[] | undefined, message: string) => {
  if (debugMessages && Array.isArray(debugMessages)) {
    debugMessages.push(message);
  }
  console.log(message); // Always log to console
};


export async function fetchGmailMessages(
  accessToken: string,
  queryString?: string,
  maxResults: number = 15,
  debugMessages?: string[] // Optional array for debug logging
): Promise<FetchedEmailData[]> {
  
  appendToDebug(debugMessages, `[gmailService] fetchGmailMessages: START. QueryString="${queryString}", MaxResults=${maxResults}, AccessToken (first 10): ${accessToken ? accessToken.substring(0,10) + '...' : 'MISSING'}`);

  if (!accessToken) {
    const errMsg = '[gmailService] fetchGmailMessages ERROR: Access token is required.';
    appendToDebug(debugMessages, errMsg);
    console.error(errMsg); // Ensure this is logged as an error too
    throw new Error('Access token is required to fetch Gmail messages.');
  }

  let apiUrl = `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`;
  if (queryString && queryString.trim() !== "") {
    apiUrl += `&q=${encodeURIComponent(queryString.trim())}`;
    appendToDebug(debugMessages, `[gmailService] fetchGmailMessages: User query string provided for Gmail API: "${queryString.trim()}"`);
  } else {
    appendToDebug(debugMessages, '[gmailService] fetchGmailMessages: No user query string provided, fetching recent messages.');
  }
  appendToDebug(debugMessages, `[gmailService] fetchGmailMessages: Constructed Gmail API URL: ${apiUrl}`);

  try {
    const listResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    appendToDebug(debugMessages, `[gmailService] fetchGmailMessages: Gmail API list messages call - Status: ${listResponse.status}`);
    if (!listResponse.ok) {
      const errorData = await listResponse.json().catch(() => ({ message: listResponse.statusText }));
      const errMsg = `[gmailService] fetchGmailMessages: Gmail API error (list messages) - Status: ${listResponse.status}, Response: ${JSON.stringify(errorData)}`;
      appendToDebug(debugMessages, errMsg);
      console.error(errMsg);
      throw new Error(`Failed to list Gmail messages: ${errorData?.error?.message || listResponse.statusText}`);
    }

    const listResult = await listResponse.json();
    const numMessagesFound = listResult.messages ? listResult.messages.length : 0;
    appendToDebug(debugMessages, `[gmailService] fetchGmailMessages: Gmail API list call returned ${numMessagesFound} message ID(s) initially.`);
    
    if (!listResult.messages || listResult.messages.length === 0) {
      appendToDebug(debugMessages, '[gmailService] fetchGmailMessages: No message IDs returned by Gmail API list call for the query. Returning empty array.');
      return [];
    }

    const fetchedEmails: FetchedEmailData[] = [];
    appendToDebug(debugMessages, `[gmailService] fetchGmailMessages: Attempting to fetch details for ${Math.min(numMessagesFound, maxResults)} message ID(s)...`);

    for (const messageInfo of listResult.messages.slice(0, maxResults)) {
      const messageId = messageInfo.id;
      const messageUrl = `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`;
      
      appendToDebug(debugMessages, `[gmailService] fetchGmailMessages: Fetching metadata for message ID ${messageId}`);
      const messageResponse = await fetch(messageUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      appendToDebug(debugMessages, `[gmailService] fetchGmailMessages: Gmail API get message metadata call for ID ${messageId} - Status: ${messageResponse.status}`);
      if (!messageResponse.ok) {
        const errorData = await messageResponse.json().catch(() => ({ message: messageResponse.statusText }));
        const warnMsg = `[gmailService] fetchGmailMessages WARNING: Failed to fetch details for message ID ${messageId} - Status: ${messageResponse.status}, Response: ${JSON.stringify(errorData)}`;
        appendToDebug(debugMessages, warnMsg);
        console.warn(warnMsg); 
        continue; 
      }

      const messageData: GmailMessage = await messageResponse.json();
      
      const emailEntry: FetchedEmailData = {
        id: messageData.id,
        sender: getHeaderValue(messageData.payload.headers, 'From'),
        subject: getHeaderValue(messageData.payload.headers, 'Subject'),
        snippet: messageData.snippet,
        timestamp: parseInt(messageData.internalDate, 10),
      };
      fetchedEmails.push(emailEntry);
      appendToDebug(debugMessages, `[gmailService] fetchGmailMessages: Successfully processed message ID ${messageId}. Subject: "${emailEntry.subject}"`);
    }
    appendToDebug(debugMessages, `[gmailService] fetchGmailMessages: Successfully fetched and processed details for ${fetchedEmails.length} email(s).`);
    if (fetchedEmails.length > 0) {
        appendToDebug(debugMessages, `[gmailService] fetchGmailMessages: First fetched email data (sample): ${JSON.stringify(fetchedEmails[0])}`);
    }
    appendToDebug(debugMessages, `[gmailService] fetchGmailMessages: END. Returning ${fetchedEmails.length} emails.`);
    return fetchedEmails;
  } catch (error) {
    const errMsg = `[gmailService] fetchGmailMessages CRITICAL_ERROR: Error during processing: ${error instanceof Error ? error.message : String(error)}`;
    appendToDebug(debugMessages, errMsg);
    console.error(errMsg, error); // Log the full error object too
    if (error instanceof Error) {
        throw new Error(`Could not fetch Gmail messages: ${error.message}`);
    }
    throw new Error('An unknown error occurred while fetching Gmail messages.');
  }
}


export async function fetchGmailMessageBody(
  accessToken: string, 
  messageId: string,
  debugMessages?: string[] // Optional array for debug logging
): Promise<string> {
  
  appendToDebug(debugMessages, `[gmailService] fetchGmailMessageBody: Fetching full body for message ID ${messageId}`);
  
  if (!accessToken) {
    const errMsg = '[gmailService] fetchGmailMessageBody ERROR: Access token is required.';
    appendToDebug(debugMessages, errMsg);
    console.error(errMsg);
    throw new Error('Access token is required to fetch Gmail message body.');
  }
  const messageUrl = `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;
  
  try {
    const response = await fetch(messageUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      const errMsg = `[gmailService] fetchGmailMessageBody: Gmail API error (get message) - Status: ${response.status}, Response: ${JSON.stringify(errorData)}`;
      appendToDebug(debugMessages, errMsg);
      console.error(errMsg);
      throw new Error(`Failed to fetch email body for ${messageId}: ${errorData?.error?.message || response.statusText}`);
    }
    const message: GmailMessage = await response.json();

    let bodyContent = "";
    if (message.payload) {
      if (message.payload.mimeType === 'text/plain' && message.payload.body.data) {
        bodyContent = decodeBase64Url(message.payload.body.data);
      } else if (message.payload.mimeType === 'text/html' && message.payload.body.data) {
        bodyContent = decodeBase64Url(message.payload.body.data); 
      } else if (message.payload.parts) {
        const findBodyInParts = (parts: GmailMessagePart[]): string | null => {
          let plainText: string | null = null;
          let htmlText: string | null = null;

          for (const part of parts) {
            if (part.mimeType === 'text/plain' && part.body.data) {
              plainText = decodeBase64Url(part.body.data);
              // Prefer plain text, so break if found
              // However, if debug needed for HTML part, remove break.
              break; 
            }
            if (part.mimeType === 'text/html' && part.body.data) {
              htmlText = decodeBase64Url(part.body.data);
            }
            // Recursive call for nested parts
            if (part.parts) {
              const nestedBody = findBodyInParts(part.parts);
              if (nestedBody) { 
                 // Prioritize plain text from deeper parts first if not already found
                 if (part.mimeType === 'text/plain' && plainText === null) plainText = nestedBody;
                 else if (part.mimeType === 'text/html' && htmlText === null) htmlText = nestedBody;
                 // If neither plainText nor htmlText is found yet at this level,
                 // take whatever nestedBody provided (could be plain or html)
                 else if (plainText === null && htmlText === null) { 
                    if(nestedBody) return nestedBody; 
                 }
              }
            }
          }
          return plainText || htmlText; // Prefer plain text, fallback to HTML
        };
        
        const foundBody = findBodyInParts(message.payload.parts);
        if (foundBody) {
          bodyContent = foundBody;
        }
      }
    }
    appendToDebug(debugMessages, `[gmailService] fetchGmailMessageBody: Successfully decoded body for message ID ${messageId}. Length: ${bodyContent.length}. Preview (first 100 chars): ${bodyContent.substring(0,100)}`);
    return bodyContent || message.snippet || "Email body could not be extracted.";
  } catch (error) {
    const errMsg = `[gmailService] fetchGmailMessageBody CRITICAL_ERROR: Error fetching/processing body for message ${messageId}: ${error instanceof Error ? error.message : String(error)}`;
    appendToDebug(debugMessages, errMsg);
    console.error(errMsg, error);
    if (error instanceof Error) {
         throw error;
    }
    throw new Error('An unknown error occurred while fetching email body.');
  }
}
