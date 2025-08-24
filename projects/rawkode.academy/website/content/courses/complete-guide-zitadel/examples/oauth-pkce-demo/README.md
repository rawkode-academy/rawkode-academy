# OAuth PKCE Demo

A simple interactive demonstration of the OAuth 2.0 PKCE (Proof Key for Code
Exchange) flow with Zitadel.

## Features

- Interactive OAuth PKCE flow demonstration
- JWT token introspection and claims display
- Role extraction from various token formats
- Support for Zitadel and other OIDC providers

## Setup

To install dependencies:

```bash
bun install
```

To run the development server:

```bash
bun run dev
```

Or to run in production:

```bash
bun run start
```

The application will be available at `http://localhost:3000`.

## Usage

1. Click the "Login" button
2. Enter your Zitadel instance's OpenID well-known configuration URL (e.g.,
   `https://your-instance.zitadel.cloud/.well-known/openid-configuration`)
3. Enter your OAuth Client ID from your Zitadel application configuration
4. Complete the authentication flow
5. View the decoded JWT claims and user roles

## Configuration Requirements

Make sure your Zitadel application is configured with:

- Redirect URI: `http://localhost:3000`
- Response Type: `Code` (PKCE flow)
- Grant Types: `Authorization Code`

This project was created using `bun init` and uses [Bun](https://bun.sh) as the
JavaScript runtime.
