import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmailView from './EmailView';
import type { Email } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { summarizeEmail } from '@/ai/flows/summarize-email';

// --- Mocks ---

// Mocking the useToast hook
jest.mock('@/hooks/use-toast');
const mockedUseToast = useToast as jest.Mock;
const mockToast = jest.fn();

// Mocking the summarizeEmail server action
jest.mock('@/ai/flows/summarize-email', () => ({
  summarizeEmail: jest.fn(),
}));
const mockedSummarizeEmail = summarizeEmail as jest.Mock;

// Mocking lucide-react icons
jest.mock('lucide-react', () => ({
  Loader2: () => <svg data-testid="loader-icon" />,
  FileText: () => <svg data-testid="file-text-icon" />,
  MessageSquareText: () => <svg data-testid="message-square-text-icon" />,
  CalendarDays: () => <svg data-testid="calendar-icon" />,
  UserCircle: () => <svg data-testid="user-icon" />,
  Sparkles: () => <svg data-testid="sparkles-icon" />,
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

    // Check for loading state
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    expect(summarizeButton).toBeDisabled();

    // Wait for the async actions to complete
    await waitFor(() => {
      expect(mockedSummarizeEmail).toHaveBeenCalledWith({ emailContent: mockEmail.body });
    });

    // Check that the summary is updated on screen
    expect(await screen.findByText(newSummary)).toBeInTheDocument();
    
    // Check that the button is enabled again and text has changed
    expect(screen.getByRole('button', { name: /Re-Summarize/i })).toBeEnabled();
    
    // Check for success toast
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

    // Wait for async actions
    await waitFor(() => {
      expect(mockedSummarizeEmail).toHaveBeenCalled();
    });

    // Check for error toast
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: 'Summarization Failed',
      description: 'AI summarization failed',
    });

    // Ensure the initial state is preserved
    expect(screen.getByText("No summary available. Click 'Summarize' to generate one.")).toBeInTheDocument();
    expect(summarizeButton).toBeEnabled();
  });

  it('disables the summarize button if the email body is empty', () => {
    render(<EmailView email={{ ...mockEmail, body: '' }} />);
    const summarizeButton = screen.getByRole('button', { name: /Summarize/i });
    expect(summarizeButton).toBeDisabled();
  });
});
