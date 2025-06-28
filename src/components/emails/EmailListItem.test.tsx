import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmailListItem from './EmailListItem';
import type { Email } from '@/types';

// We no longer need to mock `useRouter` as the component doesn't use it directly.
// The `next/link` behavior is trusted, and its dependencies are mocked by Next/Jest.
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  ArrowRight: () => <svg data-testid="arrow-right-icon" />,
  CalendarDays: () => <svg data-testid="calendar-icon" />,
  UserCircle: () => <svg data-testid="user-icon" />,
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('EmailListItem', () => {
  const mockEmail: Email = {
    id: '123',
    sender: 'test@example.com',
    subject: 'Important Update',
    body: 'This is the body of the email.',
    summary: 'This is a summary.',
    timestamp: 1672531200000, // Jan 1, 2023
    isRead: false,
  };

  beforeEach(() => {
    // Clear mocks before each test
    localStorageMock.clear();
    jest.spyOn(window.localStorage, 'setItem').mockClear(); // Also clear the spy's call history
  });

  it('renders email details correctly', () => {
    render(<EmailListItem email={mockEmail} />);

    expect(screen.getByText('Important Update')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText(/January 1, 2023/i)).toBeInTheDocument();
    expect(screen.getByText(/This is a summary./)).toBeInTheDocument();
  });

  it('shows a "New" badge for unread emails', () => {
    render(<EmailListItem email={mockEmail} />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('does not show a "New" badge for read emails', () => {
    render(<EmailListItem email={{ ...mockEmail, isRead: true }} />);
    expect(screen.queryByText('New')).not.toBeInTheDocument();
  });

  it('saves to localStorage on click and has correct href', () => {
    render(<EmailListItem email={mockEmail} />);

    const item = screen.getByRole('link');
    
    // Verify the link is pointing to the correct URL
    expect(item).toHaveAttribute('href', `/dashboard/email/${mockEmail.id}`);

    // Simulate a user click
    fireEvent.click(item);

    // Check that our specific logic (saving to localStorage) was executed exactly once
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      `email-${mockEmail.id}`,
      JSON.stringify(mockEmail)
    );
    expect(window.localStorage.setItem).toHaveBeenCalledTimes(1);
  });
});
