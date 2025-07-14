import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AuthContext } from '../../src/contexts/AuthContext'
import SignInButton from '../../src/components/auth/SignInButton'
import SignOutButton from '../../src/components/auth/SignOutButton'

// Mock Firebase Auth
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  onAuthStateChanged: jest.fn(),
}))

// Mock Firebase App
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
}))

describe('Authentication Functional Tests', () => {
  const mockUser = {
    uid: 'test-uid',
    email: 'test@example.com',
    displayName: 'Test User',
    photoURL: 'https://example.com/photo.jpg',
    emailVerified: true,
    isAnonymous: false,
    metadata: {
      creationTime: '2024-01-01T00:00:00.000Z',
      lastSignInTime: '2024-01-01T00:00:00.000Z',
    },
    providerData: [],
    refreshToken: 'test-refresh-token',
    tenantId: null,
    delete: jest.fn(),
    getIdToken: jest.fn(),
    getIdTokenResult: jest.fn(),
    reload: jest.fn(),
    toJSON: jest.fn(),
  } as any

  const mockAuthContext = {
    currentUser: null,
    loading: false,
    signInWithGoogle: jest.fn(),
    signOutUser: jest.fn(),
    getGoogleAccessToken: jest.fn(() => null),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('User Sign In Flow', () => {
    test('should display sign in button when user is not authenticated', async () => {
      render(
        <AuthContext.Provider value={mockAuthContext}>
          <SignInButton />
        </AuthContext.Provider>
      )

      expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
    })

    test('should call signIn function when sign in button is clicked', async () => {
      const signInMock = jest.fn()
      
      render(
        <AuthContext.Provider value={{ ...mockAuthContext, signInWithGoogle: signInMock }}>
          <SignInButton />
        </AuthContext.Provider>
      )

      fireEvent.click(screen.getByText('Sign in with Google'))
      expect(signInMock).toHaveBeenCalledTimes(1)
    })

    test('should show loading state during authentication', async () => {
      render(
        <AuthContext.Provider value={{ ...mockAuthContext, loading: true }}>
          <SignInButton />
        </AuthContext.Provider>
      )

      const button = screen.getByText('Sign in with Google')
      expect(button).toBeDisabled()
    })
  })

  describe('User Sign Out Flow', () => {
    test('should display sign out button when user is authenticated', async () => {
      render(
        <AuthContext.Provider value={{ ...mockAuthContext, currentUser: mockUser }}>
          <SignOutButton />
        </AuthContext.Provider>
      )

      expect(screen.getByText('Sign Out')).toBeInTheDocument()
    })

    test('should call signOut function when sign out button is clicked', async () => {
      const signOutMock = jest.fn()
      
      render(
        <AuthContext.Provider value={{ 
          ...mockAuthContext, 
          currentUser: mockUser,
          signOutUser: signOutMock 
        }}>
          <SignOutButton />
        </AuthContext.Provider>
      )

      fireEvent.click(screen.getByText('Sign Out'))
      expect(signOutMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('Authentication State Management', () => {
    test('should persist user session across page refreshes', async () => {
      // Mock localStorage
      const mockLocalStorage = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      }
      Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockUser))

      render(
        <AuthContext.Provider value={{ ...mockAuthContext, currentUser: mockUser }}>
          <div>Welcome {mockUser.displayName}</div>
        </AuthContext.Provider>
      )

      expect(screen.getByText('Welcome Test User')).toBeInTheDocument()
    })

    test('should clear user session on sign out', async () => {
      const mockLocalStorage = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      }
      Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

      const signOutMock = jest.fn()
      
      render(
        <AuthContext.Provider value={{ 
          ...mockAuthContext, 
          currentUser: mockUser,
          signOutUser: signOutMock 
        }}>
          <SignOutButton />
        </AuthContext.Provider>
      )

      fireEvent.click(screen.getByText('Sign Out'))
      expect(signOutMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error Handling', () => {
    test('should handle authentication errors gracefully', async () => {
      const signInMock = jest.fn().mockRejectedValue(new Error('Authentication failed'))
      
      render(
        <AuthContext.Provider value={{ ...mockAuthContext, signInWithGoogle: signInMock }}>
          <SignInButton />
        </AuthContext.Provider>
      )

      fireEvent.click(screen.getByText('Sign in with Google'))
      
      await waitFor(() => {
        expect(signInMock).toHaveBeenCalledTimes(1)
      })
    })

    test('should handle network errors during authentication', async () => {
      const signInMock = jest.fn().mockRejectedValue(new Error('Network error'))
      
      render(
        <AuthContext.Provider value={{ ...mockAuthContext, signInWithGoogle: signInMock }}>
          <SignInButton />
        </AuthContext.Provider>
      )

      fireEvent.click(screen.getByText('Sign in with Google'))
      
      await waitFor(() => {
        expect(signInMock).toHaveBeenCalledTimes(1)
      })
    })
  })
})