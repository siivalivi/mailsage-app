
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
  console.log(`[gmailService] fetchGmailMessages: Called with queryString="${queryString}", maxResults=${maxResults}`);

  let apiUrl = `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`;
  if (queryString && queryString.trim() !== "") {
    apiUrl += `&q=${encodeURIComponent(queryString.trim())}`;
    console.log(`[gmailService] fetchGmailMessages: Query string provided: "${queryString.trim()}"`);
  } else {
    console.log('[gmailService] fetchGmailMessages: No query string provided, fetching recent messages.');
    // Default Gmail API behavior is to list recent messages if 'q' is omitted.
  }
  console.log(`[gmailService] fetchGmailMessages: Constructed API URL: ${apiUrl}`);

  try {
    const listResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!listResponse.ok) {
      const errorData = await listResponse.json().catch(() => ({ message: listResponse.statusText }));
      console.error(`[gmailService] fetchGmailMessages: Gmail API error (list messages) - Status: ${listResponse.status}, Response:`, errorData);
      throw new Error(`Failed to list Gmail messages: ${errorData?.error?.message || listResponse.statusText}`);
    }

    const listResult = await listResponse.json();
    const numMessagesFound = listResult.messages ? listResult.messages.length : 0;
    console.log(`[gmailService] fetchGmailMessages: Gmail API list call found ${numMessagesFound} message(s) initially.`);
    
    if (!listResult.messages || listResult.messages.length === 0) {
      console.log('[gmailService] fetchGmailMessages: No messages returned by Gmail API list call.');
      return [];
    }

    const fetchedEmails: FetchedEmailData[] = [];

    for (const messageInfo of listResult.messages.slice(0, maxResults)) {
      const messageId = messageInfo.id;
      // Requesting metadata format gives us headers and snippet directly.
      const messageUrl = `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`;
      
      const messageResponse = await fetch(messageUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!messageResponse.ok) {
        const errorData = await messageResponse.json().catch(() => ({ message: messageResponse.statusText }));
        console.warn(`[gmailService] fetchGmailMessages: Failed to fetch details for message ID ${messageId} - Status: ${messageResponse.status}, Response:`, errorData);
        continue; 
      }

      const messageData: GmailMessage = await messageResponse.json();
      
      fetchedEmails.push({
        id: messageData.id,
        sender: getHeaderValue(messageData.payload.headers, 'From'),
        subject: getHeaderValue(messageData.payload.headers, 'Subject'),
        snippet: messageData.snippet,
        timestamp: parseInt(messageData.internalDate, 10),
      });
    }
    console.log(`[gmailService] fetchGmailMessages: Successfully fetched details for ${fetchedEmails.length} email(s). Returning:`, fetchedEmails.map(e => ({id: e.id, subject: e.subject})));
    return fetchedEmails;
  } catch (error) {
    console.error('[gmailService] fetchGmailMessages: Error during processing:', error);
    if (error instanceof Error) {
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
      console.error(`[gmailService] fetchGmailMessageBody: Gmail API error (get message) - Status: ${response.status}, Response:`, errorData);
      throw new Error(`Failed to fetch email body for ${messageId}: ${errorData?.error?.message || response.statusText}`);
    }
    const message: GmailMessage = await response.json();

    // Complex logic to find the most appropriate body part
    let bodyContent = "";
    if (message.payload) {
      if (message.payload.mimeType === 'text/plain' && message.payload.body.data) {
        bodyContent = decodeBase64Url(message.payload.body.data);
      } else if (message.payload.mimeType === 'text/html' && message.payload.body.data) {
        bodyContent = decodeBase64Url(message.payload.body.data); // Return HTML, EmailView will need to handle/sanitize
      } else if (message.payload.parts) {
        // Prefer text/plain, then text/html from parts
        let textPart = message.payload.parts.find(part => part.mimeType === 'text/plain');
        if (textPart && textPart.body.data) {
          bodyContent = decodeBase64Url(textPart.body.data);
        } else {
          let htmlPart = message.payload.parts.find(part => part.mimeType === 'text/html');
          if (htmlPart && htmlPart.body.data) {
            bodyContent = decodeBase64Url(htmlPart.body.data); // Return HTML
          } else {
            // Look deeper for nested parts (e.g., multipart/alternative)
            const findBodyInParts = (parts: GmailMessagePart[]): string | null => {
              for (const part of parts) {
                if (part.mimeType === 'text/plain' && part.body.data) return decodeBase64Url(part.body.data);
                if (part.mimeType === 'text/html' && part.body.data) return decodeBase64Url(part.body.data); // Storing HTML
                if (part.parts) {
                  const nestedBody = findBodyInParts(part.parts);
                  if (nestedBody) return nestedBody;
                }
              }
              return null;
            };
            const foundBody = findBodyInParts(message.payload.parts);
            if (foundBody) bodyContent = foundBody;
          }
        }
      }
    }
    console.log(`[gmailService] fetchGmailMessageBody: Successfully decoded body for message ID ${messageId}. Length: ${bodyContent.length}`);
    return bodyContent || message.snippet || "Email body could not be extracted."; // Fallback to snippet
  } catch (error) {
    console.error(`[gmailService] fetchGmailMessageBody: Error fetching/processing body for message ${messageId}:`, error);
    if (error instanceof Error) throw error;
    throw new Error('An unknown error occurred while fetching email body.');
  }
}
