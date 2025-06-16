
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


export async function fetchGmailMessages(
  accessToken: string,
  queryString?: string,
  maxResults: number = 15
): Promise<FetchedEmailData[]> {
  if (!accessToken) {
    console.error('[gmailService] fetchGmailMessages: Access token is required.');
    throw new Error('Access token is required to fetch Gmail messages.');
  }
  console.log(`[gmailService] fetchGmailMessages: START. QueryString="${queryString}", MaxResults=${maxResults}, AccessToken (first 10): ${accessToken ? accessToken.substring(0,10) + '...' : 'MISSING'}`);

  let apiUrl = `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`;
  if (queryString && queryString.trim() !== "") {
    apiUrl += `&q=${encodeURIComponent(queryString.trim())}`;
    console.log(`[gmailService] fetchGmailMessages: User query string provided for Gmail API: "${queryString.trim()}"`);
  } else {
    console.log('[gmailService] fetchGmailMessages: No user query string provided, fetching recent messages.');
  }
  console.log(`[gmailService] fetchGmailMessages: Constructed Gmail API URL: ${apiUrl}`);

  try {
    const listResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`[gmailService] fetchGmailMessages: Gmail API list messages call - Status: ${listResponse.status}`);
    if (!listResponse.ok) {
      const errorData = await listResponse.json().catch(() => ({ message: listResponse.statusText }));
      console.error(`[gmailService] fetchGmailMessages: Gmail API error (list messages) - Status: ${listResponse.status}, Response:`, JSON.stringify(errorData));
      throw new Error(`Failed to list Gmail messages: ${errorData?.error?.message || listResponse.statusText}`);
    }

    const listResult = await listResponse.json();
    const numMessagesFound = listResult.messages ? listResult.messages.length : 0;
    console.log(`[gmailService] fetchGmailMessages: Gmail API list call returned ${numMessagesFound} message ID(s) initially.`);
    
    if (!listResult.messages || listResult.messages.length === 0) {
      console.log('[gmailService] fetchGmailMessages: No message IDs returned by Gmail API list call for the query. Returning empty array.');
      return [];
    }

    const fetchedEmails: FetchedEmailData[] = [];
    console.log(`[gmailService] fetchGmailMessages: Attempting to fetch details for ${Math.min(numMessagesFound, maxResults)} message ID(s)...`);

    for (const messageInfo of listResult.messages.slice(0, maxResults)) {
      const messageId = messageInfo.id;
      // Using format=METADATA to get subject, from, date, and snippet efficiently
      const messageUrl = `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`;
      
      console.log(`[gmailService] fetchGmailMessages: Fetching metadata for message ID ${messageId}`);
      const messageResponse = await fetch(messageUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(`[gmailService] fetchGmailMessages: Gmail API get message metadata call for ID ${messageId} - Status: ${messageResponse.status}`);
      if (!messageResponse.ok) {
        const errorData = await messageResponse.json().catch(() => ({ message: messageResponse.statusText }));
        console.warn(`[gmailService] fetchGmailMessages: Failed to fetch details for message ID ${messageId} - Status: ${messageResponse.status}, Response:`, JSON.stringify(errorData));
        continue; 
      }

      const messageData: GmailMessage = await messageResponse.json();
      
      const emailEntry: FetchedEmailData = {
        id: messageData.id,
        sender: getHeaderValue(messageData.payload.headers, 'From'),
        subject: getHeaderValue(messageData.payload.headers, 'Subject'),
        snippet: messageData.snippet, // snippet is directly available with format=metadata
        timestamp: parseInt(messageData.internalDate, 10),
      };
      fetchedEmails.push(emailEntry);
      console.log(`[gmailService] fetchGmailMessages: Successfully processed message ID ${messageId}. Subject: "${emailEntry.subject}"`);
    }
    console.log(`[gmailService] fetchGmailMessages: Successfully fetched and processed details for ${fetchedEmails.length} email(s).`);
    if (fetchedEmails.length > 0) {
        console.log('[gmailService] fetchGmailMessages: First fetched email data (sample):', JSON.stringify(fetchedEmails[0]));
    }
    console.log(`[gmailService] fetchGmailMessages: END. Returning ${fetchedEmails.length} emails.`);
    return fetchedEmails;
  } catch (error) {
    console.error('[gmailService] fetchGmailMessages: Error during processing:', error);
    if (error instanceof Error) {
        // Log the full error object which might contain more details like stack trace
        console.error('[gmailService] fetchGmailMessages: Full error object:', error);
        throw new Error(`Could not fetch Gmail messages: ${error.message}`);
    }
    throw new Error('An unknown error occurred while fetching Gmail messages.');
  }
}


export async function fetchGmailMessageBody(accessToken: string, messageId: string): Promise<string> {
  if (!accessToken) {
    console.error('[gmailService] fetchGmailMessageBody: Access token is required.');
    throw new Error('Access token is required to fetch Gmail message body.');
  }
  const messageUrl = `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;
  console.log(`[gmailService] fetchGmailMessageBody: Fetching full body for message ID ${messageId}`);
  
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
      console.error(`[gmailService] fetchGmailMessageBody: Gmail API error (get message) - Status: ${response.status}, Response:`, JSON.stringify(errorData));
      throw new Error(`Failed to fetch email body for ${messageId}: ${errorData?.error?.message || response.statusText}`);
    }
    const message: GmailMessage = await response.json();

    let bodyContent = "";
    if (message.payload) {
      if (message.payload.mimeType === 'text/plain' && message.payload.body.data) {
        bodyContent = decodeBase64Url(message.payload.body.data);
      } else if (message.payload.mimeType === 'text/html' && message.payload.body.data) {
        // Prefer text/plain if available, but use text/html as fallback.
        // For display, HTML might be better, but for AI processing, plain text is often preferred.
        // Here, we're just getting content. The EmailView component can handle HTML.
        bodyContent = decodeBase64Url(message.payload.body.data); 
      } else if (message.payload.parts) {
        // Recursive function to find the first text/plain or text/html part
        const findBodyInParts = (parts: GmailMessagePart[]): string | null => {
          let plainText: string | null = null;
          let htmlText: string | null = null;

          for (const part of parts) {
            if (part.mimeType === 'text/plain' && part.body.data) {
              plainText = decodeBase64Url(part.body.data);
              break; // Prefer plain text, so break if found
            }
            if (part.mimeType === 'text/html' && part.body.data) {
              htmlText = decodeBase64Url(part.body.data);
            }
            if (part.parts) {
              const nestedBody = findBodyInParts(part.parts);
              // If nested search found plain text, prioritize it
              if (nestedBody && (!plainText || (part.parts.some(p => p.mimeType === 'text/plain') && nestedBody) ) ) {
                 // This logic is a bit complex, simplify to just take first available or preferred one.
                 // Let's just take the first text/plain or text/html we find.
                 return nestedBody; 
              }
            }
          }
          return plainText || htmlText; // Return plain text if found, otherwise html text, otherwise null
        };
        
        const foundBody = findBodyInParts(message.payload.parts);
        if (foundBody) {
          bodyContent = foundBody;
        }
      }
    }
    console.log(`[gmailService] fetchGmailMessageBody: Successfully decoded body for message ID ${messageId}. Length: ${bodyContent.length}. Preview (first 100 chars): ${bodyContent.substring(0,100)}`);
    return bodyContent || message.snippet || "Email body could not be extracted.";
  } catch (error) {
    console.error(`[gmailService] fetchGmailMessageBody: Error fetching/processing body for message ${messageId}:`, error);
    if (error instanceof Error) {
         console.error('[gmailService] fetchGmailMessageBody: Full error object:', error);
         throw error;
    }
    throw new Error('An unknown error occurred while fetching email body.');
  }
}

