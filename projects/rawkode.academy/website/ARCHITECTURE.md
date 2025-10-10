# Architecture Guidelines

## Component Structure

### Directory Organization

```
src/
├── components/         # Reusable UI components
│   ├── common/        # Generic components used across the app
│   ├── articles/      # Article-specific components
│   ├── video/         # Video-specific components
│   └── ...           # Other feature-specific components
├── composables/       # Vue composition API utilities
├── hooks/             # React hooks
├── layouts/           # Page layouts
├── pages/             # Route pages (Astro)
├── types/             # TypeScript type definitions
├── utils/             # Utility functions and helpers
└── styles/            # Global styles
```

### Component Best Practices

1. **Single Responsibility**: Each component should have one clear purpose
2. **Props Interface**: Always define TypeScript interfaces for props
3. **Composition over Inheritance**: Use composition patterns for reusability
4. **Error Boundaries**: Wrap components that might fail with error boundaries
5. **Loading States**: Always handle loading states with skeleton screens
6. **Accessibility**: Include proper ARIA labels and semantic HTML

### Component Naming Conventions

- **PascalCase** for component files: `OptimizedImage.vue`
- **Descriptive names**: `VideoCommentSection` not `Comments`
- **Feature prefixes**: `ArticleCard`, `VideoPlayer`, etc.

## State Management

### Local State

- Use Vue's `ref` and `reactive` for component state
- Use React's `useState` for React components
- Keep state as close to where it's used as possible

### Shared State

- Use props/events for parent-child communication
- Use provide/inject for deeply nested components
- Consider a state management solution for complex state

## Data Fetching

### Best Practices

1. Use the `useAsyncData` composable for consistent error handling
2. Implement proper loading states with skeleton screens
3. Handle errors gracefully with `ErrorState` component
4. Add retry mechanisms for failed requests
5. Cancel requests when components unmount

### API Integration

```typescript
// Use the error handler utility
import { handleApiResponse } from "@/utils/error-handler";

const response = await fetch("/api/endpoint");
const data = await handleApiResponse(response);
```

## TypeScript Guidelines

### Type Safety

1. **No `any` types**: Use `unknown` if type is truly unknown
2. **Explicit return types**: Always declare function return types
3. **Interface over Type**: Prefer interfaces for object shapes
4. **Strict mode**: Keep TypeScript in strict mode

### Type Organization

- Common types in `src/types/common.ts`
- Feature-specific types in their own files
- Import types using `import type` when possible

## Performance Optimization

### Image Optimization

- Use `OptimizedImage` component for all images
- Provide width/height to prevent layout shift
- Use appropriate formats (AVIF, WebP fallbacks)
- Implement lazy loading for below-fold images

### Code Splitting

- Use `client:visible` for components below fold
- Use `client:idle` for non-critical components
- Dynamic imports for heavy dependencies

### Caching Strategy

- Static pages use `export const prerender = true`
- API responses include appropriate cache headers
- Use resource hints for external domains

## Error Handling

### Component Level

- Wrap React components with `ErrorBoundary`
- Use `ErrorState` component for error UI
- Log errors to monitoring service

### API Level

- Use `ApiResponseError` for typed errors
- Implement retry logic for transient failures
- Show user-friendly error messages

## Testing Strategy

### Unit Tests

- Test utility functions and composables
- Test component props and events
- Mock external dependencies

### Integration Tests

- Test API endpoints
- Test component interactions
- Test error scenarios

### Accessibility Tests

- Ensure proper ARIA labels
- Test keyboard navigation
- Verify screen reader compatibility

## Security Best Practices

1. **Input Validation**: Validate all user inputs
2. **XSS Prevention**: Sanitize HTML content
3. **CSRF Protection**: Use proper tokens
4. **Secure Headers**: Implement security headers
5. **API Security**: Validate API responses

## Monitoring and Analytics

- Errors and analytics tracked with PostHog
- Session recordings sampled at ~10% with inputs masked
- Performance (e.g., Web Vitals) can be sent to PostHog
- All tracking runs in web workers via Partytown
