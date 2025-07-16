// Stub for AI features when building for static export
// Since static export doesn't support Server Actions, we provide no-op implementations

export const ai = {
  // Stub implementation that throws helpful errors
  generate: () => {
    throw new Error('AI features are not available in static export mode. Please deploy with server-side rendering to use AI functionality.');
  }
};

export const summarizeEmailFlow = async () => {
  throw new Error('Email summarization is not available in static export mode.');
};

export const extractActionItemsFlow = async () => {
  throw new Error('Action item extraction is not available in static export mode.');
};

export const draftReplyFlow = async () => {
  throw new Error('Reply drafting is not available in static export mode.');
};

export const queryEmailsFlow = async () => {
  throw new Error('Email querying is not available in static export mode.');
};

export const generateDailyBriefingFlow = async () => {
  throw new Error('Daily briefing generation is not available in static export mode.');
};

export const summarizeQueriedEmailsFlow = async () => {
  throw new Error('Email summarization is not available in static export mode.');
};