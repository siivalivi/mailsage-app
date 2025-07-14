// Optional: configure or set up a testing framework before each test
// if you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { setupTestEnvironment } from './tests/utils/test-utils';

// Set up test environment
setupTestEnvironment();

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  }),
}));

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Firebase
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn(() => []),
  getApp: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  GoogleAuthProvider: jest.fn().mockImplementation(() => ({
    addScope: jest.fn(),
    setCustomParameters: jest.fn(),
    getScopes: jest.fn(() => []),
  })),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
}));

// Mock Gmail API
jest.mock('googleapis', () => ({
  google: {
    gmail: jest.fn(),
    auth: {
      OAuth2: jest.fn(),
    },
  },
}));

// Mock AI/Genkit
jest.mock('genkit', () => ({
  genkit: jest.fn(),
  configureGenkit: jest.fn(),
}));

jest.mock('@genkit-ai/googleai', () => ({
  googleAI: jest.fn(),
}));

// Mock AI flow functions
jest.mock('@/ai/flows/summarize-email', () => ({
  summarizeEmail: jest.fn().mockResolvedValue({
    summary: 'Test email summary',
  }),
}));

jest.mock('@/ai/flows/extract-action-items', () => ({
  extractActionItems: jest.fn().mockResolvedValue({
    actionItems: [
      'Test task',
      'Follow up with team',
      'Review document by Friday',
    ],
  }),
}));

jest.mock('@/ai/flows/draft-reply', () => ({
  draftReply: jest.fn().mockResolvedValue({
    reply: 'Test reply content',
  }),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Chrome: () => null,
  LogOut: () => null,
  Inbox: () => null,
  Loader2: () => null,
  Search: () => null,
  Mail: () => null,
  Clock: () => null,
  User: () => null,
  Calendar: () => null,
  FileText: () => null,
  Send: () => null,
  Archive: () => null,
  Trash: () => null,
  Star: () => null,
  Reply: () => null,
  ReplyAll: () => null,
  Forward: () => null,
  MoreHorizontal: () => null,
  Download: () => null,
  ExternalLink: () => null,
  X: () => null,
  Check: () => null,
  AlertCircle: () => null,
  Info: () => null,
  Plus: () => null,
  Minus: () => null,
  Edit: () => null,
  Save: () => null,
  Settings: () => null,
  Home: () => null,
  Menu: () => null,
  ChevronLeft: () => null,
  ChevronRight: () => null,
  ChevronUp: () => null,
  ChevronDown: () => null,
}));

// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset environment variables
  delete (process.env as any).NODE_ENV;
  (process.env as any).NODE_ENV = 'test';
});

afterEach(() => {
  // Clean up after each test
  jest.clearAllTimers();
});
