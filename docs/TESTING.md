# Testing Guide for MailSage App

## Overview

This guide covers the comprehensive testing setup for the MailSage email management application, including functional tests, unit tests, integration tests, and CI/CD pipeline configuration.

## Test Structure

```
tests/
├── functional/          # Functional tests for complete workflows
├── unit/               # Unit tests for individual components
├── integration/        # Integration tests for service interactions
├── e2e/               # End-to-end tests
└── utils/             # Test utilities and helpers
```

## Test Scripts

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit
npm run test:functional
npm run test:integration
npm run test:e2e

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## Environment Setup

### Secure Credential Management

#### Development Environment
1. Copy `.env.example` to `.env.local`
2. Fill in your actual credentials (never commit this file)

#### CI/CD Environment
Set up GitHub Secrets for:
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GOOGLE_AI_API_KEY`
- `TEST_USER_EMAIL`
- `TEST_USER_PASSWORD`

### Setting Up Your Gmail Credentials

For email connectivity testing, you'll need to set up Gmail API credentials:

1. **Create a Google Cloud Project:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable the Gmail API

2. **Create OAuth 2.0 Credentials:**
   - Go to APIs & Services > Credentials
   - Create OAuth 2.0 client ID
   - Add your domain to authorized origins

3. **Generate Refresh Token:**
   - Use the OAuth 2.0 playground or create a simple script
   - Get authorization code and exchange for refresh token

4. **Secure Storage:**
   - Store credentials in `.env.local` for development
   - Use GitHub Secrets for CI/CD
   - Never commit credentials to version control

## Test Categories

### 1. Functional Tests

Test complete user workflows and business logic:

#### Authentication Tests (`auth.functional.test.ts`)
- User sign-in flow
- User sign-out flow
- Session persistence
- Error handling

#### Gmail Integration Tests (`gmail.functional.test.ts`)
- Email fetching
- Email filtering and querying
- Email content processing
- API error handling

#### AI Flows Tests (`ai-flows.functional.test.ts`)
- Email summarization
- Action item extraction
- Daily briefing generation
- Reply drafting
- Email querying

### 2. Unit Tests (Future)

Test individual components and functions:
- React components
- Utility functions
- Service methods
- Hook behavior

### 3. Integration Tests (Future)

Test service interactions:
- Firebase authentication
- Gmail API integration
- AI service integration
- Database operations

### 4. End-to-End Tests (Future)

Test complete application workflows:
- User registration and login
- Email management workflows
- AI-powered features
- Cross-browser compatibility

## Mock Strategy

### Service Mocks
- **Firebase**: Authentication, Firestore operations
- **Gmail API**: Email fetching, filtering, content processing
- **AI Services**: Summarization, action extraction, reply generation
- **Next.js**: Router, navigation, server-side functions

### Test Data
- Mock user objects
- Mock email data with various formats
- Mock AI responses
- Mock API responses and errors

## CI/CD Pipeline

### GitHub Actions Workflow

The CI/CD pipeline includes:

1. **Test Stage:**
   - Multiple Node.js versions (18.x, 20.x)
   - Type checking
   - Linting
   - Unit tests with coverage
   - Functional tests
   - Build verification

2. **Deploy Stage:**
   - Runs only on main/master branch
   - Builds application
   - Deploys to Firebase

### Coverage Reporting
- Minimum coverage thresholds
- Coverage reports in CI
- Codecov integration

## Running Tests Locally

### Prerequisites
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials
```

### Running Tests
```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/functional/auth.functional.test.ts

# Run in watch mode
npm run test:watch

# Run functional tests only
npm run test:functional
```

### Debugging Tests
```bash
# Run tests with debugging
npm test -- --no-cache --verbose

# Run single test with debugging
npm test -- --testNamePattern="should display sign in button" --verbose
```

## Test Utilities

### Custom Render Function
```typescript
import { renderWithProviders } from '../tests/utils/test-utils'

// Render component with authentication context
const { getByText } = renderWithProviders(
  <MyComponent />,
  { authContext: { user: mockUser } }
)
```

### Mock Data Generators
```typescript
import { generateMockEmail, generateMockEmails } from '../tests/utils/test-utils'

// Generate single mock email
const email = generateMockEmail({ subject: 'Test Subject' })

// Generate multiple mock emails
const emails = generateMockEmails(5)
```

## Best Practices

### Test Organization
1. Group related tests using `describe` blocks
2. Use clear, descriptive test names
3. Follow AAA pattern (Arrange, Act, Assert)
4. Mock external dependencies
5. Clean up after tests

### Test Data
1. Use realistic test data
2. Test edge cases and error conditions
3. Use data generators for consistency
4. Avoid hardcoded values

### Assertions
1. Use specific assertions
2. Test both positive and negative cases
3. Verify error handling
4. Check loading states

### Performance
1. Mock heavy operations
2. Use `runInBand` for tests that need isolation
3. Clean up resources after tests
4. Use appropriate timeouts

## Troubleshooting

### Common Issues

1. **Test Timeout:**
   ```bash
   # Increase timeout in jest.config.ts
   testTimeout: 30000
   ```

2. **Mock Issues:**
   ```bash
   # Clear mocks between tests
   beforeEach(() => {
     jest.clearAllMocks()
   })
   ```

3. **Environment Variables:**
   ```bash
   # Check .env.test file
   # Verify GitHub Secrets
   ```

4. **Dependencies:**
   ```bash
   # Clear node_modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

## Security Considerations

1. **Never commit credentials** to version control
2. **Use environment variables** for sensitive data
3. **Rotate credentials regularly**
4. **Limit API permissions** to minimum required
5. **Use test-specific accounts** when possible

## Monitoring and Reporting

### Test Results
- View test results in GitHub Actions
- Check coverage reports
- Monitor test execution times

### Alerts
- Set up notifications for test failures
- Monitor coverage drops
- Track flaky tests

## Future Enhancements

1. **Visual Regression Testing**
2. **Performance Testing**
3. **Accessibility Testing**
4. **Cross-browser Testing**
5. **Load Testing**
6. **Security Testing**

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/docs/)
- [Next.js Testing](https://nextjs.org/docs/testing)
- [Firebase Testing](https://firebase.google.com/docs/rules/unit-tests)
- [Gmail API Testing](https://developers.google.com/gmail/api/guides)