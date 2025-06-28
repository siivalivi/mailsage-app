import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SignInButton from './SignInButton';
import { useAuth } from '@/contexts/AuthContext';

// Mock the useAuth hook
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock lucide-react icons. By providing a complete mock without `jest.requireActual`,
// we prevent Jest from trying to parse the original ESM module, which was causing the error.
jest.mock('lucide-react', () => ({
  Chrome: () => <svg data-testid="chrome-icon" />,
}));


// Type assertion for the mocked hook
const mockedUseAuth = useAuth as jest.Mock;

describe('SignInButton', () => {
  it('renders the button with the correct text', () => {
    // Arrange: Set up the mock return value for this test
    mockedUseAuth.mockReturnValue({
      signInWithGoogle: jest.fn(),
      loading: false,
    });

    // Act: Render the component
    render(<SignInButton />);

    // Assert: Check if the button is in the document and has the correct text
    const buttonElement = screen.getByRole('button', { name: /sign in with google/i });
    expect(buttonElement).toBeInTheDocument();
    expect(screen.getByTestId('chrome-icon')).toBeInTheDocument();
  });

  it('is disabled when loading is true', () => {
    // Arrange
    mockedUseAuth.mockReturnValue({
      signInWithGoogle: jest.fn(),
      loading: true,
    });

    // Act
    render(<SignInButton />);

    // Assert
    const buttonElement = screen.getByRole('button', { name: /sign in with google/i });
    expect(buttonElement).toBeDisabled();
  });

  it('calls signInWithGoogle on click when not loading', () => {
    // Arrange
    const signInMock = jest.fn();
    mockedUseAuth.mockReturnValue({
      signInWithGoogle: signInMock,
      loading: false,
    });

    // Act
    render(<SignInButton />);
    const buttonElement = screen.getByRole('button', { name: /sign in with google/i });
    fireEvent.click(buttonElement);

    // Assert
    expect(signInMock).toHaveBeenCalledTimes(1);
  });
});
