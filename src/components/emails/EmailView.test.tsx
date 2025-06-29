
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmailView from './EmailView';
import type { Email } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { summarizeEmail } from '@/ai/flows/summarize-email';
import { draftReply } from '@/ai/flows/draft-reply';
import { extractActionItems } from '@/ai/flows/extract-action-items';

// --- Mocks ---

// Mocking the useToast hook
jest.mock('@/hooks/use-toast');
const mockedUseToast = useToast as jest.Mock;
const mockToast = jest.fn();

// Mocking the server actions
jest.mock('@/ai/flows/summarize-email', () => ({
  summarizeEmail: jest.fn(),
}));
const mockedSummarizeEmail = summarizeEmail as jest.Mock;

jest.mock('@/ai/flows/draft-reply', () => ({
  draftReply: jest.fn(),
  ReplyToneSchema: { options: ['polite', 'formal', 'casual', 'direct', 'friendly'] },
}));
const mockedDraftReply = draftReply as jest.Mock;

jest.mock('@/ai/flows/extract-action-items', () => ({
    extractActionItems: jest.fn(),
}));
const mockedExtractActionItems = extractActionItems as jest.Mock;

// Mocking lucide-react icons. This MUST include all icons used by EmailView AND its children (like Select).
jest.mock('lucide-react', () => ({
  Loader2: () => <svg data-testid="loader-icon" />,
  FileText: () => <svg data-testid="file-text-icon" />,
  MessageSquareText: () => <svg data-testid="message-square-text-icon" />,
  CalendarDays: () => <svg data-testid="calendar-icon" />,
  UserCircle: () => <svg data-testid="user-icon" />,
  Sparkles: () => <svg data-testid="sparkles-icon" />,
  PenSquare: () => <svg data-testid="pen-square-icon" />,
  ClipboardCopy: () => <svg data-testid="clipboard-copy-icon" />,
  ListTodo: () => <svg data-testid="list-todo-icon" />,
  // Icons used by the Select component must also be mocked
  ChevronDown: () => <svg data-testid="chevron-down-icon" />,
  ChevronUp: () => <svg data-testid="chevron-up-icon" />,
  Check: () => <svg data-testid="check-icon" />,
}));


describe('EmailView', () => {
  const mockEmail: Email = {
    id: '123',
    sender: 'sender@example.com',
    subject: 'Email Subject',
    body: '<p>This is the email body.</p>',
    timestamp: 1672531200000, // Jan 1, 2023
  };

  const mockEmailWithSummary: Email = {
    ...mockEmail,
    summary: 'Initial summary.',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseToast.mockReturnValue({ toast: mockToast });
  });

  describe('Core Display and Summarization', () => {
    it('renders email details correctly', () => {
      render(<EmailView email={mockEmail} />);
      
      expect(screen.getByText('Email Subject')).toBeInTheDocument();
      expect(screen.getByText(/From: sender@example.com/)).toBeInTheDocument();
      expect(screen.getByText(/Date: January 1, 2023/)).toBeInTheDocument();
      expect(screen.getByText('This is the email body.')).toBeInTheDocument();
    });

    it('shows a placeholder when no summary is present', () => {
      render(<EmailView email={mockEmail} />);
      expect(screen.getByText("No summary available. Click 'Summarize' to generate one.")).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Summarize/i })).toBeInTheDocument();
    });

    it('displays an existing summary and shows "Re-Summarize"', () => {
      render(<EmailView email={mockEmailWithSummary} />);
      expect(screen.getByText('Initial summary.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Re-Summarize/i })).toBeInTheDocument();
    });

    it('calls summarizeEmail flow, shows loading state, and updates the summary on click', async () => {
      const newSummary = 'This is the new AI summary.';
      mockedSummarizeEmail.mockResolvedValue({ summary: newSummary });

      render(<EmailView email={mockEmail} />);
      
      const summarizeButton = screen.getByRole('button', { name: /Summarize/i });
      fireEvent.click(summarizeButton);

      expect(summarizeButton).toBeDisabled();
      expect(screen.getAllByTestId('loader-icon').length).toBeGreaterThan(0);

      await waitFor(() => {
        expect(mockedSummarizeEmail).toHaveBeenCalledWith({ emailContent: mockEmail.body });
      });

      expect(await screen.findByText(newSummary)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Re-Summarize/i })).toBeEnabled();
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Email Summarized',
        description: 'The summary has been generated successfully.',
      });
    });

    it('handles summarization failure and shows an error toast', async () => {
      const error = new Error('AI summarization failed');
      mockedSummarizeEmail.mockRejectedValue(error);

      render(<EmailView email={mockEmail} />);
      
      const summarizeButton = screen.getByRole('button', { name: /Summarize/i });
      fireEvent.click(summarizeButton);

      await waitFor(() => {
        expect(mockedSummarizeEmail).toHaveBeenCalled();
      });

      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: 'Summarization Failed',
        description: 'AI summarization failed',
      });
      expect(screen.getByText("No summary available. Click 'Summarize' to generate one.")).toBeInTheDocument();
      expect(summarizeButton).toBeEnabled();
    });

    it('disables the summarize button if the email body is empty', () => {
      render(<EmailView email={{ ...mockEmail, body: '' }} />);
      const summarizeButton = screen.getByRole('button', { name: /Summarize/i });
      expect(summarizeButton).toBeDisabled();
    });
  });

  describe('Reply Generation', () => {
    it('renders the reply generation card with correct icons', () => {
      render(<EmailView email={mockEmail} />);
      expect(screen.getByText('Generate Reply')).toBeInTheDocument();
      expect(screen.getByTestId('pen-square-icon')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument(); // The select trigger for tone
      expect(screen.getByRole('button', { name: /Generate Draft/i })).toBeInTheDocument();
    });

    it('calls draftReply on button click, shows loading, and updates UI', async () => {
      const draftText = 'This is a polite draft reply.';
      mockedDraftReply.mockResolvedValue({ reply: draftText });

      render(<EmailView email={mockEmail} />);

      const generateButton = screen.getByRole('button', { name: /Generate Draft/i });
      fireEvent.click(generateButton);

      // Check for loading state
      expect(generateButton).toBeDisabled();
      // Check for the "Generating draft..." placeholder in the textarea
      expect(screen.getByDisplayValue('Generating draft...')).toBeInTheDocument();
      // Check for the loader icon in the button
      expect(generateButton.querySelector('[data-testid="loader-icon"]')).toBeInTheDocument();

      // Wait for async actions
      await waitFor(() => {
        expect(mockedDraftReply).toHaveBeenCalledWith({
          emailContent: mockEmail.body,
          replyTone: 'polite', // default tone
        });
      });

      // Check for updated UI
      expect(await screen.findByDisplayValue(draftText)).toBeInTheDocument();
      expect(generateButton).toBeEnabled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Reply Drafted' })
      );
    });

    it('handles draft generation failure and shows an error toast', async () => {
      const error = new Error('AI drafting failed');
      mockedDraftReply.mockRejectedValue(error);

      render(<EmailView email={mockEmail} />);
      const generateButton = screen.getByRole('button', { name: /Generate Draft/i });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: 'Drafting Failed',
          description: 'AI drafting failed',
        });
      });

      // Ensure textarea is not shown
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(generateButton).toBeEnabled();
    });

    it('disables the generate draft button if the email body is empty', () => {
        render(<EmailView email={{ ...mockEmail, body: '' }} />);
        const generateButton = screen.getByRole('button', { name: /Generate Draft/i });
        expect(generateButton).toBeDisabled();
    });
  });

  describe('Action Item Extraction', () => {
    it('renders the action items card and button', () => {
      render(<EmailView email={mockEmail} />);
      expect(screen.getByText('Action Items')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Extract Actions/i })).toBeInTheDocument();
      expect(screen.getByTestId('list-todo-icon')).toBeInTheDocument();
    });

    it('calls extractActionItems on button click, shows loading, and updates UI with results', async () => {
      const actionItems = ['Do this', 'Reply to that'];
      mockedExtractActionItems.mockResolvedValue({ actionItems });

      render(<EmailView email={mockEmail} />);

      const extractButton = screen.getByRole('button', { name: /Extract Actions/i });
      fireEvent.click(extractButton);

      // Check for loading state
      expect(extractButton).toBeDisabled();
      expect(screen.getAllByTestId('loader-icon').length).toBeGreaterThan(0);

      // Wait for async actions
      await waitFor(() => {
        expect(mockedExtractActionItems).toHaveBeenCalledWith({ emailContent: mockEmail.body });
      });

      // Check for updated UI
      expect(await screen.findByText('Do this')).toBeInTheDocument();
      expect(screen.getByText('Reply to that')).toBeInTheDocument();
      expect(extractButton).toBeEnabled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Action Items Extracted' })
      );
    });

    it('displays a message when no action items are found', async () => {
      mockedExtractActionItems.mockResolvedValue({ actionItems: [] });
      render(<EmailView email={mockEmail} />);
      const extractButton = screen.getByRole('button', { name: /Extract Actions/i });
      fireEvent.click(extractButton);

      expect(await screen.findByText('No specific action items were found in this email.')).toBeInTheDocument();
    });

    it('handles extraction failure and shows an error toast', async () => {
      const error = new Error('AI extraction failed');
      mockedExtractActionItems.mockRejectedValue(error);

      render(<EmailView email={mockEmail} />);
      const extractButton = screen.getByRole('button', { name: /Extract Actions/i });
      fireEvent.click(extractButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: 'Extraction Failed',
          description: 'AI extraction failed',
        });
      });

      expect(extractButton).toBeEnabled();
    });
  });
});
