import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmailList from './EmailList';
import type { Email } from '@/types';

// Mock child components and dependencies to isolate the EmailList component
jest.mock('./EmailListItem', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function DummyEmailListItem({ email }: { email: Email; [key: string]: any }) {
    return <div data-testid={`email-item-${email.id}`}>{email.subject}</div>;
  };
});

jest.mock('lucide-react', () => ({
  ...jest.requireActual('lucide-react'), // Import actual lucide-react library
  Inbox: () => <svg data-testid="inbox-icon" />, // Mock the Inbox icon specifically
}));


describe('EmailList', () => {
  const mockEmails: Email[] = [
    { id: '1', subject: 'Test Email 1', sender: 'test1@example.com', body: 'body1', timestamp: Date.now() },
    { id: '2', subject: 'Test Email 2', sender: 'test2@example.com', body: 'body2', timestamp: Date.now() },
  ];

  it('shows skeleton loaders when isLoading is true', () => {
    render(<EmailList emails={[]} isLoading={true} />);
    
    // The component should render 4 skeleton cards, each with multiple skeleton elements
    // We check for the aria-label="loading" we added to the Skeleton component
    const skeletons = screen.getAllByLabelText('loading');
    expect(skeletons.length).toBeGreaterThan(0);

    // Ensure actual content is not rendered
    expect(screen.queryByText('No Emails Found')).not.toBeInTheDocument();
  });

  it('shows "No Emails Found" message when there are no emails and not loading', () => {
    render(<EmailList emails={[]} isLoading={false} />);
    
    expect(screen.getByText('No Emails Found')).toBeInTheDocument();
    expect(screen.getByTestId('inbox-icon')).toBeInTheDocument();

    // Ensure no email items are rendered
    expect(screen.queryByTestId(/email-item-/)).not.toBeInTheDocument();
  });

  it('renders the list of emails when emails are provided and not loading', () => {
    render(<EmailList emails={mockEmails} isLoading={false} />);
    
    // Check that our mock EmailListItem is rendered for each email
    expect(screen.getByText('Test Email 1')).toBeInTheDocument();
    expect(screen.getByTestId('email-item-1')).toBeInTheDocument();
    expect(screen.getByText('Test Email 2')).toBeInTheDocument();
    expect(screen.getByTestId('email-item-2')).toBeInTheDocument();
    
    // Ensure loading and empty states are not present
    expect(screen.queryByText('No Emails Found')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('loading')).not.toBeInTheDocument();
  });
});
