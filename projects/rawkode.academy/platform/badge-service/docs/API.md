# Badge Service API Documentation

## API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/issue` | Issue badge to user | Bearer token |
| GET | `/issuer` | Get issuer profile with JWK | No |
| GET | `/issuer/key-1` | Get issuer public JWK | No |
| GET | `/badge/:id/json` | Get signed VC-JWT credential | No |
| GET | `/badge/:id/image` | Get badge image | No |
| GET | `/health` | Health check | No |

### POST /issue

Issues are internal-only. Callers must provide `Authorization: Bearer <BADGE_ISSUER_TOKEN>` and the recipient email to embed in the credential subject.

**Request:**
```json
{
  "userId": "user_123",
  "recipientEmail": "learner@example.com",
  "achievementType": "course-completion",
  "achievementName": "Kubernetes Basics",
  "achievementDescription": "Completed the Kubernetes Basics course",
  "validUntil": "2027-01-01T00:00:00Z"
}
```

### GET /badge/:id/json

Returns the OpenBadge 3.0 VC-JWT credential as a compact JWS string.

**Response:**
```text
eyJhbGciOiJSUzI1NiIsImtpZCI6Imh0dHBzOi8vYmFkZ2VzLnJhd2tvZGUuYWNhZGVteS9pc3N1ZXIva2V5LTEifQ...
```

**Content-Type:** `text/plain`
**Error:** `404` if badge not found

## Badge Verification

### Manual Verification Steps

#### 1. Verify JWT Structure

```bash
BADGE_ID="<your-badge-id>"

# Get the credential
CREDENTIAL=$(curl -s http://localhost:8787/badge/$BADGE_ID/json)

# Decode JWT payload (inspection only, not verification):
echo "$CREDENTIAL" | cut -d. -f2 | base64 -d | jq
```

#### 2. Verify Against OpenBadge 3.0 Schema

- Schema validation uses `lib/openbadges/schemas/achievementcredential.json`
- Check `@context` includes both W3C and IMS Global contexts
- Verify `type` array contains `["VerifiableCredential", "AchievementCredential"]`

#### 3. Verify Cryptographic Signature

External validators can fetch public key from `/issuer` endpoint. Example with Node.js:

```javascript
import { jwtVerify, importSPKI } from 'jose';

const jwk = await fetch('http://localhost:8787/issuer/key-1').then(r => r.json());
const publicKey = await importJWK(jwk, 'RS256');
const { payload } = await jwtVerify(signedJWT, publicKey);
```

### External Validators

- [1EdTech Badge Validator](https://validator.imsglobal.org/) - Official OpenBadge validator
- [Badgr](https://badgr.com/) - Import and verify badges
- [Credly](https://credly.com/) - Digital credential platform
