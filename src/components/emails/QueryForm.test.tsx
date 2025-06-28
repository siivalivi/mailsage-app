import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import QueryForm from './QueryForm';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { queryEmails } from '@/ai/flows/query-emails';
import type { User } from 'firebase/auth';

// --- Mocks ---

// Mocking 'lucide-react' icons
jest.mock('lucide-react', () => ({
  Search: () => <svg data-testid="search-icon" />,
  Loader2: () => <svg data-testid="loader-icon" />,
}));

// Mocking the useAuth hook
jest.mock('@/contexts/AuthContext');
const mockedUseAuth = useAuth as jest.Mock;

// Mocking the useToast hook
jest.mock('@/hooks/use-toast');
const mockedUseToast = useToast as jest.Mock;
const mockToast = jest.fn();

// Mocking the queryEmails server action
jest.mock('@/ai/flows/query-emails');
const mockedQueryEmails = queryEmails as jest.Mock;


describe('QueryForm', () => {
  const mockOnQuerySubmit = jest.fn();
  const mockSetIsLoading = jest.fn();

  // Mock user object
  const mockUser = {
    displayName: 'Test User',
  } as User;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Default mock implementation for useAuth
    mockedUseAuth.mockReturnValue({
      currentUser: mockUser,
      getGoogleAccessToken: () => 'fake-access-token',
      signInWithGoogle: jest.fn(),
    });

    // Default mock implementation for useToast
    mockedUseToast.mockReturnValue({
      toast: mockToast,
    });
  });

  it('renders the input field and submit button', () => {
    render(<QueryForm onQuerySubmit={mockOnQuerySubmit} setIsLoading={mockSetIsLoading} />);
    
    expect(screen.getByPlaceholderText("e.g., 'invoices from Uber last month'")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ask mailsage \(gmail\)/i })).toBeInTheDocument();
  });

  it('shows a validation message if the query is empty on submit', async () => {
    render(<QueryForm onQuerySubmit={mockOnQuerySubmit} setIsLoading={mockSetIsLoading} />);
    
    const submitButton = screen.getByRole('button', { name: /ask mailsage \(gmail\)/i });
    fireEvent.click(submitButton);

    // react-hook-form validation is async
    const errorMessage = await screen.findByText('Query cannot be empty.');
    expect(errorMessage).toBeInTheDocument();
    expect(mockedQueryEmails).not.toHaveBeenCalled();
  });

  it('calls queryEmails with correct data on successful submission', async () => {
    const queryText = 'find my last flight confirmation';
    const mockEmailResults = {
      emailList: [{ id: '1', sender: 'test@test.com', subject: 'Confirmation', snippet: '...', timestamp: 123, summary: '...' }],
    };
    mockedQueryEmails.mockResolvedValue(mockEmailResults);

    render(<QueryForm onQuerySubmit={mockOnQuerySubmit} setIsLoading={mockSetIsLoading} />);

    const input = screen.getByPlaceholderText("e.g., 'invoices from Uber last month'");
    const submitButton = screen.getByRole('button', { name: /ask mailsage \(gmail\)/i });

    fireEvent.change(input, { target: { value: queryText } });
    fireEvent.click(submitButton);

    // Wait for the async operations to complete
    await waitFor(() => {
      expect(mockedQueryEmails).toHaveBeenCalledWith({
        query: queryText,
        accessToken: 'fake-access-token',
      });
    });

    expect(mockOnQuerySubmit).toHaveBeenCalledWith(mockEmailResults.emailList);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Gmail Query Processed',
    }));
  });

  it('displays a loader and disables the button during submission', async () => {
    // Make the mock promise not resolve immediately
    mockedQueryEmails.mockReturnValue(new Promise(() => {})); 

    render(<QueryForm onQuerySubmit={mockOnQuerySubmit} setIsLoading={mockSetIsLoading} />);

    const input = screen.getByPlaceholderText("e.g., 'invoices from Uber last month'");
    const submitButton = screen.getByRole('button');

    fireEvent.change(input, { target: { value: 'some query' } });
    fireEvent.click(submitButton);

    // The button text is replaced by the loader
    await waitFor(() => {
        expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
        expect(submitButton).toBeDisabled();
    });
  });

  it('shows an error toast if queryEmails call fails', async () => {
    const error = new Error('API Failure');
    mockedQueryEmails.mockRejectedValue(error);

    render(<QueryForm onQuerySubmit={mockOnQuerySubmit} setIsLoading={mockSetIsLoading} />);

    const input = screen.getByPlaceholderText("e.g., 'invoices from Uber last month'");
    const submitButton = screen.getByRole('button');

    fireEvent.change(input, { target: { value: 'a query that fails' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        variant: 'destructive',
        title: 'Gmail Query Failed',
        description: 'API Failure',
      }));
    });
    // Ensure onQuerySubmit is called with an empty array on failure
    expect(mockOnQuerySubmit).toHaveBeenCalledWith([]);
  });

  it('shows an error toast if access token is missing', async () => {
    // Override the useAuth mock for this specific test
    mockedUseAuth.mockReturnValue({
      currentUser: mockUser,
      getGoogleAccessToken: () => null, // No token
    });

    render(<QueryForm onQuerySubmit={mockOnQuerySubmit} setIsLoading={mockSetIsLoading} />);

    const input = screen.getByPlaceholderText("e.g., 'invoices from Uber last month'");
    const submitButton = screen.getByRole('button');

    fireEvent.change(input, { target: { value: 'any query' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        variant: 'destructive',
        title: 'Authentication Error',
      }));
    });

    expect(mockedQueryEmails).not.toHaveBeenCalled();
  });
});
