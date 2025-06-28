import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SignOutButton from './SignOutButton';
import { useAuth } from '@/contexts/AuthContext';

// Mock the useAuth hook
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  LogOut: () => <svg data-testid="logout-icon" />,
}));

// Type assertion for the mocked hook
const mockedUseAuth = useAuth as jest.Mock;

describe('SignOutButton', () => {
  it('renders the button with the correct text and icon', () => {
    // Arrange
    mockedUseAuth.mockReturnValue({
      signOutUser: jest.fn(),
      loading: false,
    });

    // Act
    render(<SignOutButton />);

    // Assert
    const buttonElement = screen.getByRole('button', { name: /sign out/i });
    expect(buttonElement).toBeInTheDocument();
    expect(screen.getByTestId('logout-icon')).toBeInTheDocument();
  });

  it('is disabled when loading is true', () => {
    // Arrange
    mockedUseAuth.mockReturnValue({
      signOutUser: jest.fn(),
      loading: true,
    });

    // Act
    render(<SignOutButton />);

    // Assert
    const buttonElement = screen.getByRole('button', { name: /sign out/i });
    expect(buttonElement).toBeDisabled();
  });

  it('calls signOutUser on click when not loading', () => {
    // Arrange
    const signOutMock = jest.fn();
    mockedUseAuth.mockReturnValue({
      signOutUser: signOutMock,
      loading: false,
    });

    // Act
    render(<SignOutButton />);
    const buttonElement = screen.getByRole('button', { name: /sign out/i });
    fireEvent.click(buttonElement);

    // Assert
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});
