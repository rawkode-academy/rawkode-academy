# Email Service

A private RPC Worker for sending emails from the Rawkode Academy platform.

## Overview

This service provides a unified interface for sending emails with proper envelope handling for different email categories:

- **Service Emails**: Account-related emails (password resets, verification, etc.)
- **Marketing Emails**: Newsletters, promotions, and updates (includes unsubscribe links)
- **Transactional Emails**: Event registrations, order confirmations, etc.

## Features

- RFC 5322 compliant email message construction
- Automatic envelope decoration based on email type
- List-Unsubscribe header support for marketing emails (RFC 8058)
- HTML and plain text multipart messages
- Integration with Cloudflare Email Workers
- Email preferences service integration

## RPC Methods

### `sendServiceEmail(options: EmailOptions): Promise<SendEmailResult>`

Send a service email (account-related, password resets, etc.). These emails have minimal envelope decoration and are always sent.

### `sendMarketingEmail(options: EmailOptions): Promise<SendEmailResult>`

Send a marketing email (newsletters, promotions, etc.). These emails include full unsubscribe links and respect email preferences.

### `sendTransactionalEmail(options: EmailOptions): Promise<SendEmailResult>`

Send a transactional email (order confirmations, event registrations, etc.). These emails include preference management links.

## Types

```typescript
interface EmailRecipient {
  email: string;
  name?: string;
  userId?: string;
}

interface EmailContent {
  subject: string;
  htmlBody: string;
  textBody: string;
}

interface EmailOptions {
  recipient: EmailRecipient;
  content: EmailContent;
  replyTo?: string;
  unsubscribeUrl?: string;
  preferencesUrl?: string;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
```

## Usage

This service is designed to be consumed via RPC Service Bindings from other Cloudflare Workers:

```typescript
// In another worker's wrangler.jsonc:
// "services": [{ "binding": "EMAIL_SERVICE", "service": "platform-email-service-rpc" }]

// In your worker code:
const result = await env.EMAIL_SERVICE.sendServiceEmail({
  recipient: {
    email: "user@example.com",
    name: "John Doe",
    userId: "user-123",
  },
  content: {
    subject: "Welcome to Rawkode Academy!",
    htmlBody: "<h1>Welcome!</h1><p>Thanks for signing up.</p>",
    textBody: "Welcome! Thanks for signing up.",
  },
});
```

## Development

```bash
# Run locally
cd rpc && bun run wrangler dev

# Deploy
cd rpc && bun run wrangler deploy
```

## Dependencies

- Cloudflare Email Workers (send_email binding)
- Email Preferences Service (for future preference checking)
