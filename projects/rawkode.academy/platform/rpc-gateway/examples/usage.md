# RPC Gateway Usage Examples

## Authentication Required

All RPC calls require a valid Personal Access Token (PAT) from Zitadel. Requests without authentication will receive a 401 Unauthorized response.

## Creating a Casting Credit (POST)

```bash
# This will fail with 401 Unauthorized
curl -X POST http://localhost:8787/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "service": "casting-credits",
    "params": {
      "personId": "person-123",
      "videoId": "video-456",
      "role": "host"
    }
  }'

# This will work with a valid PAT
curl -X POST http://localhost:8787/rpc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer zitadel_pat_V2_xxxxx" \
  -d '{
    "service": "casting-credits",
    "params": {
      "personId": "person-123",
      "videoId": "video-456",
      "role": "host"
    }
  }'
```

## With Resource Path (Future Enhancement)

When services support resource-based routing:

```bash
# GET a specific resource
curl -X GET http://localhost:8787/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "service": "people",
    "resource": "person-123"
  }'

# UPDATE a resource
curl -X PUT http://localhost:8787/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "service": "people",
    "resource": "person-123",
    "params": {
      "name": "Updated Name"
    }
  }'

# DELETE a resource
curl -X DELETE http://localhost:8787/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "service": "people",
    "resource": "person-123"
  }'
```

## With PAT Authentication

All requests require a Personal Access Token from Zitadel:

```bash
# First, create a PAT in Zitadel UI or via API
# Then use the token in your RPC call
curl -X POST http://localhost:8787/rpc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer zitadel_pat_V2_xxxxx" \
  -d '{
    "service": "casting-credits",
    "params": {
      "personId": "person-789",
      "videoId": "video-012",
      "role": "guest"
    }
  }'
```

## List Available Services

```bash
curl http://localhost:8787/services
```

## Error Examples

### Invalid Service
```bash
curl -X POST http://localhost:8787/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "service": "invalid-service",
    "params": {}
  }'
```

Response:
```json
{
  "success": false,
  "error": {
    "code": "SERVICE_NOT_FOUND",
    "message": "Service 'invalid-service' not found",
    "details": {
      "availableServices": ["casting-credits", "technologies", "people", "shows", "show-hosts"]
    }
  }
}
```

### Method Not Allowed
```bash
curl -X DELETE http://localhost:8787/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "service": "casting-credits",
    "params": {}
  }'
```

Response:
```json
{
  "success": false,
  "error": {
    "code": "METHOD_NOT_ALLOWED",
    "message": "HTTP method 'DELETE' not allowed for service 'casting-credits'",
    "details": {
      "allowedMethods": ["POST"]
    }
  }
}
```

### Invalid or Expired PAT
```bash
curl -X POST http://localhost:8787/rpc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid_token" \
  -d '{
    "service": "casting-credits",
    "params": {}
  }'
```

Response:
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token is inactive or expired"
  }
}
```

## TypeScript Client Example

```typescript
interface RPCClient {
  call<T = any>(
    method: string,
    service: string,
    resource?: string,
    params?: any
  ): Promise<T>;
}

class RawkodeRPCClient implements RPCClient {
  constructor(
    private baseUrl: string,
    private personalAccessToken?: string
  ) {}

  async call<T = any>(
    method: string,
    service: string,
    resource?: string,
    params?: any
  ): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    
    if (this.personalAccessToken) {
      headers["Authorization"] = `Bearer ${this.personalAccessToken}`;
    }

    const body: any = { service };
    if (resource) body.resource = resource;
    if (params) body.params = params;

    const response = await fetch(`${this.baseUrl}/rpc`, {
      method,
      headers,
      body: JSON.stringify(body),
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`RPC Error: ${result.error.code} - ${result.error.message}`);
    }
    
    return result.data;
  }
}

// Usage with PAT authentication (required)
const authenticatedClient = new RawkodeRPCClient(
  "https://rpc-gateway.rawkode.academy",
  process.env.ZITADEL_PAT // e.g., "zitadel_pat_V2_xxxxx"
);

// CREATE
const created = await authenticatedClient.call("POST", "casting-credits", undefined, {
  personId: "person-123",
  videoId: "video-456",
  role: "host"
});

// Future: GET specific resource
const person = await authenticatedClient.call("GET", "people", "person-123");

// Future: UPDATE
const updated = await authenticatedClient.call("PUT", "people", "person-123", {
  name: "Updated Name"
});

// Future: DELETE
await authenticatedClient.call("DELETE", "people", "person-123");
```

## Creating a Personal Access Token (PAT)

To create a PAT in Zitadel:

1. Log in to the Zitadel Console
2. Navigate to your user profile or service account
3. Go to "Personal Access Tokens" section
4. Click "Create New Token"
5. Set an expiration date and optional description
6. Copy the generated token (it won't be shown again)

The token will look like: `zitadel_pat_V2_xxxxx`

## Service Migration Path

As services are enhanced to support more HTTP verbs:

1. **Current State**: All services only support POST for creation
2. **Future State**: Services can support full CRUD operations
   - GET /resource-id - Read specific resource
   - GET / - List resources (with query params)
   - POST / - Create new resource
   - PUT /resource-id - Full update
   - PATCH /resource-id - Partial update
   - DELETE /resource-id - Delete resource

The RPC Gateway will automatically support these operations as services are enhanced.