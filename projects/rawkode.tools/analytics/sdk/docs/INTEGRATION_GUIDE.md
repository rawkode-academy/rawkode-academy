# Integration Guide

This guide covers common integration scenarios for the Analytics SDK.

## Table of Contents

- [React Integration](#react-integration)
- [Vue.js Integration](#vuejs-integration)
- [Next.js Integration](#nextjs-integration)
- [Vanilla JavaScript](#vanilla-javascript)
- [TypeScript Configuration](#typescript-configuration)
- [Content Security Policy](#content-security-policy)
- [Server-Side Rendering](#server-side-rendering)

## React Integration

### Basic Setup

```tsx
// analytics.ts
import { AnalyticsClient } from '@rawkode-tools/analytics-sdk';

export const analytics = new AnalyticsClient({
  endpoint: process.env.REACT_APP_ANALYTICS_ENDPOINT,
  debug: process.env.NODE_ENV === 'development'
});

// Initialize on app start
analytics.initialize();
```

### React Hook

```tsx
// useAnalytics.ts
import { useEffect, useCallback } from 'react';
import { analytics } from './analytics';
import type { TrackingEvent } from '@rawkode-tools/analytics-sdk';

export function useAnalytics() {
  const track = useCallback(async (event: TrackingEvent) => {
    try {
      await analytics.track(event);
    } catch (error) {
      console.error('Analytics error:', error);
    }
  }, []);

  const setUser = useCallback((userId: string) => {
    analytics.setUserId(userId);
  }, []);

  useEffect(() => {
    // Flush events on unmount
    return () => {
      analytics.flush().catch(console.error);
    };
  }, []);

  return { track, setUser };
}
```

### Component Example

```tsx
function ProductPage({ product }: { product: Product }) {
  const { track } = useAnalytics();

  useEffect(() => {
    track({
      type: 'product.viewed',
      subject: product.id,
      data: {
        name: product.name,
        price: product.price,
        category: product.category
      }
    });
  }, [product, track]);

  const handleAddToCart = async () => {
    await track({
      type: 'cart.item_added',
      data: {
        productId: product.id,
        quantity: 1
      }
    });
    // Add to cart logic...
  };

  return (
    <div>
      <h1>{product.name}</h1>
      <button onClick={handleAddToCart}>Add to Cart</button>
    </div>
  );
}
```

## Vue.js Integration

### Plugin Setup

```ts
// analytics-plugin.ts
import { App } from 'vue';
import { AnalyticsClient } from '@rawkode-tools/analytics-sdk';

export const analyticsPlugin = {
  install(app: App, options: AnalyticsConfig) {
    const analytics = new AnalyticsClient(options);
    analytics.initialize();

    app.config.globalProperties.$analytics = analytics;
    app.provide('analytics', analytics);
  }
};

// main.ts
import { createApp } from 'vue';
import { analyticsPlugin } from './analytics-plugin';

const app = createApp(App);
app.use(analyticsPlugin, {
  endpoint: import.meta.env.VITE_ANALYTICS_ENDPOINT,
  debug: import.meta.env.DEV
});
```

### Composition API

```vue
<script setup lang="ts">
import { inject, onMounted, onUnmounted } from 'vue';
import type { AnalyticsClient, TrackingEvent } from '@rawkode-tools/analytics-sdk';

const analytics = inject<AnalyticsClient>('analytics')!;

const track = async (event: TrackingEvent) => {
  try {
    await analytics.track(event);
  } catch (error) {
    console.error('Analytics error:', error);
  }
};

onMounted(() => {
  track({
    type: 'component.mounted',
    data: { component: 'ProductList' }
  });
});

onUnmounted(() => {
  analytics.flush();
});

// Use in component
const handleClick = (productId: string) => {
  track({
    type: 'product.clicked',
    subject: productId,
    data: { source: 'product-list' }
  });
};
</script>
```

## Next.js Integration

### App Directory Setup

```tsx
// app/analytics-provider.tsx
'use client';

import { createContext, useContext, useEffect } from 'react';
import { AnalyticsClient } from '@rawkode-tools/analytics-sdk';

const AnalyticsContext = createContext<AnalyticsClient | null>(null);

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const analytics = new AnalyticsClient({
    endpoint: process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT,
    trackPageViews: true
  });

  useEffect(() => {
    analytics.initialize();
    
    return () => {
      analytics.destroy();
    };
  }, []);

  return (
    <AnalyticsContext.Provider value={analytics}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const analytics = useContext(AnalyticsContext);
  if (!analytics) {
    throw new Error('useAnalytics must be used within AnalyticsProvider');
  }
  return analytics;
}
```

### Route Change Tracking

```tsx
// app/layout.tsx
import { AnalyticsProvider } from './analytics-provider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AnalyticsProvider>
          {children}
        </AnalyticsProvider>
      </body>
    </html>
  );
}
```

### API Route for Server-Side Events

```ts
// app/api/track/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { CloudEventV1 } from 'cloudevents';

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Create CloudEvent on server
  const event = new CloudEventV1({
    id: crypto.randomUUID(),
    type: body.type,
    source: 'nextjs-api',
    data: body.data,
    time: new Date().toISOString()
  });

  // Forward to analytics endpoint
  const response = await fetch(process.env.ANALYTICS_ENDPOINT!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ANALYTICS_API_KEY}`
    },
    body: JSON.stringify({ events: [event] })
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
```

## Vanilla JavaScript

### Module Script

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import { AnalyticsClient } from 'https://cdn.jsdelivr.net/npm/@rawkode-tools/analytics-sdk/dist/index.js';
    
    window.analytics = new AnalyticsClient({
      endpoint: 'https://api.example.com/analytics/events/batch',
      trackPageViews: true,
      trackClicks: true
    });
    
    window.analytics.initialize().then(() => {
      console.log('Analytics initialized');
    });
  </script>
</head>
<body>
  <button onclick="trackPurchase()">Buy Now</button>
  
  <script>
    function trackPurchase() {
      window.analytics.track({
        type: 'purchase.initiated',
        data: {
          productId: 'abc123',
          price: 29.99
        }
      });
    }
  </script>
</body>
</html>
```

### Classic Script with Bundler

```html
<!-- Include the bundled SDK -->
<script src="/js/analytics-sdk.min.js"></script>

<script>
  // Initialize
  const analytics = new AnalyticsSDK.AnalyticsClient({
    endpoint: '/api/analytics/events'
  });
  
  analytics.initialize().then(() => {
    // Track page view manually
    analytics.track({
      type: 'pageview',
      data: {
        path: window.location.pathname,
        title: document.title
      }
    });
  });
  
  // Set user when they log in
  function onUserLogin(userId) {
    analytics.setUserId(userId);
  }
</script>
```

## TypeScript Configuration

### Strict Type Checking

```typescript
// analytics-wrapper.ts
import { 
  AnalyticsClient, 
  type TrackingEvent,
  type AnalyticsConfig 
} from '@rawkode-tools/analytics-sdk';

// Define your event types
type AppEventType = 
  | 'user.signup'
  | 'user.login'
  | 'purchase.completed'
  | 'page.viewed';

// Type-safe event data
interface AppEventData {
  'user.signup': {
    plan: 'free' | 'pro' | 'enterprise';
    referrer?: string;
  };
  'user.login': {
    method: 'email' | 'social';
    provider?: string;
  };
  'purchase.completed': {
    orderId: string;
    amount: number;
    currency: string;
  };
  'page.viewed': {
    path: string;
    title: string;
  };
}

// Type-safe wrapper
export class TypedAnalytics {
  private client: AnalyticsClient;

  constructor(config: AnalyticsConfig) {
    this.client = new AnalyticsClient(config);
  }

  async initialize(): Promise<void> {
    await this.client.initialize();
  }

  async track<T extends AppEventType>(
    type: T,
    data: AppEventData[T]
  ): Promise<void> {
    await this.client.track({
      type,
      data: data as Record<string, unknown>
    });
  }

  setUserId(userId: string): void {
    this.client.setUserId(userId);
  }

  async flush(): Promise<void> {
    await this.client.flush();
  }
}
```

## Content Security Policy

If using CSP, add these directives:

```http
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  connect-src 'self' https://your-analytics-endpoint.com;
```

For stricter CSP without `unsafe-inline`:

```html
<!-- Use nonce-based CSP -->
<script nonce="GENERATED_NONCE">
  import { AnalyticsClient } from '/sdk/analytics.js';
  // Initialize...
</script>
```

## Server-Side Rendering

### Handling SSR Environments

```typescript
// analytics-ssr.ts
import { AnalyticsClient } from '@rawkode-tools/analytics-sdk';

let analytics: AnalyticsClient | null = null;

export function getAnalytics(): AnalyticsClient | null {
  // Only initialize on client side
  if (typeof window === 'undefined') {
    return null;
  }

  if (!analytics) {
    analytics = new AnalyticsClient({
      endpoint: process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT,
      // Disable features that require DOM
      trackPageViews: false,
      trackClicks: false,
      trackErrors: false
    });
    
    analytics.initialize().catch(console.error);
  }

  return analytics;
}

// Safe track function
export async function trackEvent(event: TrackingEvent): Promise<void> {
  const client = getAnalytics();
  if (client) {
    await client.track(event);
  }
}
```

### Hydration-Safe Component

```tsx
// AnalyticsTracker.tsx
import { useEffect, useState } from 'react';
import { getAnalytics } from './analytics-ssr';

export function AnalyticsTracker({ 
  event 
}: { 
  event: TrackingEvent 
}) {
  const [tracked, setTracked] = useState(false);

  useEffect(() => {
    if (!tracked) {
      const analytics = getAnalytics();
      if (analytics) {
        analytics.track(event)
          .then(() => setTracked(true))
          .catch(console.error);
      }
    }
  }, [event, tracked]);

  return null;
}
```

## Best Practices

1. **Initialize Early**: Initialize the SDK as early as possible in your application lifecycle
2. **Error Boundaries**: Wrap analytics calls in try-catch blocks to prevent tracking errors from breaking your app
3. **User Consent**: Implement user consent checks before tracking
4. **Data Minimization**: Only track necessary data, avoid PII
5. **Testing**: Use debug mode during development to verify events
6. **Performance**: Consider lazy-loading the SDK for better initial page load