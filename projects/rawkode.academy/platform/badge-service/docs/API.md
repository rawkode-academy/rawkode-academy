# Badge Service API Documentation

## API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/issue` | Issue badge to user | No (internal) |
| GET | `/issuer` | Get issuer profile with JWK | No |
| GET | `/badge/:id/json` | Get credential JSON-LD | No |
| GET | `/badge/:id/image` | Get badge SVG image | No |
| GET | `/health` | Health check | No |

### GET /badge/:id/json

Returns OpenBadge 3.0 credential in JSON-LD format with JWT proof.

**Response:**
```json
{
  "@context": ["https://www.w3.org/ns/credentials/v2", "https://purl.imsglobal.org/spec/ob/v3p0/context.json"],
  "id": "http://localhost:8787/badge/{id}",
  "type": ["VerifiableCredential", "AchievementCredential"],
  "issuer": { ... },
  "credentialSubject": { ... },
  "validFrom": "2025-01-01T00:00:00Z",
  "proof": {
    "type": "JwtProof2020",
    "jwt": "<signed-jwt-token>"
  }
}
```

**Content-Type:** `application/ld+json`
**Error:** `404` if badge not found

## Badge Verification

### Manual Verification Steps

#### 1. Verify JWT Structure

```bash
BADGE_ID="<your-badge-id>"

# Get the credential
CREDENTIAL=$(curl -s http://localhost:8787/badge/$BADGE_ID/json)

# Decode JWT payload (inspection only, not verification):
echo $CREDENTIAL | jq -r '.proof.jwt' | cut -d. -f2 | base64 -d | jq
```

#### 2. Verify Against OpenBadge 3.0 Schema

- Schema validation uses `lib/openbadges/schemas/achievementcredential.json`
- Check `@context` includes both W3C and IMS Global contexts
- Verify `type` array contains `["VerifiableCredential", "AchievementCredential"]`

#### 3. Verify Cryptographic Signature

External validators can fetch public key from `/issuer` endpoint. Example with Node.js:

```javascript
import { jwtVerify, importSPKI } from 'jose';

const issuerData = await fetch('http://localhost:8787/issuer').then(r => r.json());
const publicKey = await importSPKI(issuerData.publicKey.publicKeyJwk, 'RS256');
const { payload } = await jwtVerify(signedJWT, publicKey);
```

### External Validators

- [1EdTech Badge Validator](https://validator.imsglobal.org/) - Official OpenBadge validator
- [Badgr](https://badgr.com/) - Import and verify badges
- [Credly](https://credly.com/) - Digital credential platform
