import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmailListItem from './EmailListItem';
import type { Email } from '@/types';

// Mock next/navigation
const mockRouterPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
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
    mockRouterPush.mockClear();
    localStorageMock.clear();
    jest.spyOn(window.localStorage, 'setItem');
  });

  it('renders email details correctly', () => {
    render(<EmailListItem email={mockEmail} />);

    expect(screen.getByText('Important Update')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    // Check for formatted date - toLocaleDateString is tricky, so let's just check for part of it
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

  it('navigates and saves to localStorage on click', () => {
    render(<EmailListItem email={mockEmail} />);

    const item = screen.getByRole('link');
    fireEvent.click(item);

    // Check localStorage
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      `email-${mockEmail.id}`,
      JSON.stringify(mockEmail)
    );

    // Check router push
    expect(mockRouterPush).toHaveBeenCalledWith(`/dashboard/email/${mockEmail.id}`);
  });

  it('is keyboard accessible', () => {
    render(<EmailListItem email={mockEmail} />);
    
    const item = screen.getByRole('link');
    item.focus();
    
    // Pressing Enter should trigger the click handler
    fireEvent.keyDown(item, { key: 'Enter', code: 'Enter' });

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(window.localStorage.setItem).toHaveBeenCalledTimes(1);

    // Pressing Space should also trigger it
    fireEvent.keyDown(item, { key: ' ', code: 'Space' });
    expect(mockRouterPush).toHaveBeenCalledTimes(2);
    expect(window.localStorage.setItem).toHaveBeenCalledTimes(2);
  });
});
