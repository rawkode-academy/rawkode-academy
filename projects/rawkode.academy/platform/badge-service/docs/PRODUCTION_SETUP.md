# Production Setup

## RSA Key Generation

Badge credentials are signed with RSA-2048 keys. Generate once per environment.

### Generate Keys

```bash
bun run scripts/generate-rsa-keys.ts
```

For local development, this creates `http/.dev.vars` with the keys automatically.

### Required Environment Variables

- `BADGE_ISSUER_RSA_PRIVATE_KEY` - PEM-encoded private key (newlines escaped as \n)
- `BADGE_ISSUER_RSA_PUBLIC_KEY` - PEM-encoded public key (newlines escaped as \n)
- `BADGE_ISSUER_URL` - Base URL for badge verification

### Security Notes

- Never commit private keys
- Keys are long-lived - only rotate if compromised
- Rotating keys invalidates all previously issued badges
