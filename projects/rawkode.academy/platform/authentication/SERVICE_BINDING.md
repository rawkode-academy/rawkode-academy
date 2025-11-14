# Service Binding & Capnweb RPC Integration

The authentication service uses [capnweb](https://github.com/cloudflare/capnweb), a JavaScript-native RPC system with promise pipelining, for efficient service-to-service communication via Cloudflare Service Bindings.

## Architecture

```
┌─────────────┐     Capnweb RPC (Service Binding)     ┌──────────────────┐
│             │────────────────────────────────────────▶│                  │
│   Website   │                                        │  Authentication  │
│             │◀────────────────────────────────────────│     Service      │
└─────────────┘                                        └──────────────────┘
```

## Why Capnweb?

Capnweb provides:
- **Object-capability RPC** - Pass functions and objects by reference
- **Promise pipelining** - Chain dependent calls in a single round trip
- **Bidirectional calling** - Server can call client callbacks
- **Type-safe** - Full TypeScript support
- **Schema-less** - No IDL files needed, just TypeScript interfaces
- **Human-readable** - JSON-based serialization
- **Tiny** - Under 10kB minified+gzipped

## Service Binding Configuration

The authentication service is bound to the website as `AUTH_SERVICE` in `wrangler.jsonc`:

```jsonc
{
  "services": [
    {
      "binding": "AUTH_SERVICE",
      "service": "platform-authentication-rpc"
    }
  ]
}
```

## RPC Interface

The service exposes an RPC interface via capnweb's `RpcTarget` class:

```typescript
import { RpcTarget } from "capnweb";

export class AuthRpcService extends RpcTarget {
  async verifySession(sessionToken: string): Promise<AuthResponse> { ... }
  async getUser(userId: string): Promise<User | null> { ... }
  async getUserByEmail(email: string): Promise<User | null> { ... }
  async listUserSessions(userId: string): Promise<Session[]> { ... }
  async revokeSession(sessionId: string): Promise<boolean> { ... }
  async validatePasskey(userId: string, credentialId: string): Promise<boolean> { ... }
}
```

## Using the Client

### Import the Client

```typescript
import { createAuthClient } from "@/lib/auth/client";
// or
import { AuthClient } from "@/lib/auth/client"; // backward compatible wrapper
```

### Basic Usage

```typescript
// In middleware or API route
const authService = createAuthClient(context.locals.runtime.env.AUTH_SERVICE);

// Call methods directly - capnweb handles the RPC
const result = await authService.verifySession(sessionToken);
if (result.success) {
  console.log("User:", result.user);
}

// Get user by email
const user = await authService.getUserByEmail("user@example.com");
```

### Promise Pipelining

Capnweb's killer feature - chain dependent calls without waiting:

```typescript
const authService = createAuthClient(env.AUTH_SERVICE);

// Don't await! Make pipelined calls
const userPromise = authService.getUser(userId);
const sessionsPromise = authService.listUserSessions(userId);

// Both calls happen in parallel, single round trip
const [user, sessions] = await Promise.all([userPromise, sessionsPromise]);
```

### Using the Wrapper Class

For backward compatibility, you can use the wrapper class:

```typescript
const authClient = new AuthClient(env.AUTH_SERVICE);
const result = await authClient.verifySession(sessionToken);
```

## Server Implementation

### Capnweb Endpoint

The service exposes a capnweb RPC endpoint at `/rpc`:

```typescript
import { newWorkersRpcResponse, RpcTarget } from "capnweb";
import { AuthRpcService } from "./rpc-service";

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    
    // Capnweb RPC endpoint
    if (url.pathname === "/rpc") {
      return newWorkersRpcResponse(request, new AuthRpcService(env));
    }
    
    // Other endpoints...
  }
}
```

### RpcTarget Implementation

```typescript
import { RpcTarget } from "capnweb";

export class AuthRpcService extends RpcTarget {
  private db;

  constructor(env: Env) {
    super(); // Important: call RpcTarget constructor
    this.db = drizzle(env.DB, { schema: dataSchema });
  }

  // All public async methods are automatically exposed via RPC
  async verifySession(sessionToken: string): Promise<AuthResponse> {
    // Implementation...
  }
}
```

## Middleware Example

```typescript
import { defineMiddleware } from "astro:middleware";
import { createAuthClient } from "@/lib/auth/client";

export const authMiddleware = defineMiddleware(async (context, next) => {
  const authService = createAuthClient(context.locals.runtime.env.AUTH_SERVICE);
  
  // Get session token from cookie
  const sessionToken = context.cookies.get("session")?.value;
  
  if (sessionToken) {
    const result = await authService.verifySession(sessionToken);
    
    if (result.success && result.user) {
      context.locals.user = result.user;
    }
  }
  
  return next();
});
```

## Advanced Features

### Passing Callbacks

Capnweb supports passing functions by reference:

```typescript
// Server can call client callbacks
const authService = createAuthClient(env.AUTH_SERVICE);

await authService.watchSession(sessionId, (event) => {
  console.log("Session event:", event);
});
```

### Bidirectional RPC

Server can call client methods:

```typescript
// Client exposes an RpcTarget
class ClientHandler extends RpcTarget {
  async onSessionExpired() {
    // Handle session expiration
  }
}

const authService = createAuthClient(env.AUTH_SERVICE);
await authService.registerClient(new ClientHandler());
```

## Benefits of Capnweb

1. **Ultra-Low Latency** - Direct Worker-to-Worker communication
2. **Promise Pipelining** - Multiple dependent calls in one round trip
3. **Type Safety** - Full TypeScript support without schemas
4. **No Boilerplate** - No IDL files or code generation needed
5. **Cost Effective** - No egress charges for internal communication
6. **Auto Scaling** - Cloudflare handles scaling automatically
7. **Capability-Based Security** - Fine-grained access control

## Performance

Capnweb service bindings provide:
- **Sub-millisecond** latency for most operations
- **Zero cold starts** between bound services
- **Automatic load balancing** across Worker instances
- **Efficient serialization** with JSON

## Development

### Testing RPC Locally

```bash
# Start auth service
npm run dev:rpc

# Test capnweb RPC endpoint
curl http://localhost:8788/rpc \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "op": "call",
    "target": 0,
    "method": "verifySession",
    "args": ["session_abc123"]
  }'
```

### Adding New RPC Methods

1. Add method to `AuthRpcService` class
2. That's it! Capnweb automatically exposes it

```typescript
export class AuthRpcService extends RpcTarget {
  // Just add the method - no registration needed
  async getSessionStats(userId: string) {
    return await this.db.query.session.count({
      where: (sessions, { eq }) => eq(sessions.userId, userId),
    });
  }
}
```

3. Use it from the client:

```typescript
const stats = await authService.getSessionStats(userId);
```

## Security Considerations

- Service bindings are **internal only** - not exposed to the internet
- Capnweb validates all method calls and parameters
- Session tokens should be **short-lived** and **rotated**
- Always check session expiration before trusting user data
- Use **HTTPS** for any external-facing endpoints

## Comparison: Capnweb vs Manual RPC

**Before (Manual RPC):**
```typescript
// Server: Manual routing
switch (method) {
  case "verifySession":
    return Response.json(await service.verifySession(body.sessionToken));
  case "getUser":
    return Response.json(await service.getUser(body.userId));
  // ... many more cases
}

// Client: Manual fetch calls
const response = await service.fetch(
  new Request("http://auth-service/rpc/verifySession", {
    method: "POST",
    body: JSON.stringify({ sessionToken }),
  })
);
```

**After (Capnweb):**
```typescript
// Server: One line
return newWorkersRpcResponse(request, new AuthRpcService(env));

// Client: Direct method calls
const result = await authService.verifySession(sessionToken);
```

## Monitoring

Monitor RPC calls via:
- Cloudflare Workers Analytics
- Custom metrics in RPC service observability
- Capnweb's built-in trace IDs
- Error rates and latencies in dashboard

## Resources

- [Capnweb GitHub](https://github.com/cloudflare/capnweb)
- [Capnweb npm package](https://www.npmjs.com/package/capnweb)
- [Cloudflare Workers RPC Blog](https://blog.cloudflare.com/javascript-native-rpc/)
- [Cap'n Proto](https://capnproto.org) - Spiritual sibling project
