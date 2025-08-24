# Progressive Enhancement Guide

This document outlines best practices for implementing progressive enhancement
in our Astro-based website to optimize client-side hydration and improve
performance.

## Astro Client Directive Strategy

### When to Use Each Directive

#### `client:load`

Use sparingly, only for:

- Critical above-the-fold interactive elements
- Components that users immediately interact with
- Authentication-related components
- Video players or critical media controls

#### `client:idle`

Perfect for:

- Components that need to be interactive soon but not immediately
- Navigation menus that aren't immediately visible
- Interactive elements that enhance but don't block core functionality
- Comments sections, reactions, or social features

#### `client:visible`

Ideal for:

- Below-the-fold components
- Testimonials, carousels, or sliders
- Statistics or animated counters
- Footer interactive elements
- Any component not visible on initial page load

#### `client:only`

Use when:

- Component has no server-side rendering benefit
- Complex interactive components that would cause hydration mismatches
- Third-party integrations that require client-side APIs

#### `client:media`

Use for:

- Mobile-specific or desktop-specific interactive features
- Components that should only hydrate on certain screen sizes

## Implementation Guidelines

### 1. Analyze Component Priority

Before adding a client directive, ask:

- Is this component visible on initial page load?
- Does the user need to interact with it immediately?
- Does it enhance or is it critical to the user experience?
- What's the performance cost of hydrating it immediately?

### 2. Progressive Enhancement Pattern

```astro
<!-- Server-rendered fallback -->
<div class="component-wrapper">
  <!-- Static content visible before hydration -->
  <noscript>
    <div class="static-fallback">
      <!-- Fallback content -->
    </div>
  </noscript>
  
  <!-- Interactive component -->
  <InteractiveComponent client:visible />
</div>
```

### 3. Loading States

For components using `client:visible` or `client:idle`, implement skeleton
screens or loading placeholders:

```astro
<div class="testimonial-wrapper min-h-[400px]">
  <!-- Skeleton loader (hidden after hydration) -->
  <div class="skeleton-loader" aria-hidden="true">
    <div class="animate-pulse bg-gray-200 h-full rounded-lg"></div>
  </div>
  
  <!-- Actual component -->
  <TestimonialSlider client:visible />
</div>
```

### 4. Performance Monitoring

Track the impact of hydration strategies:

- First Input Delay (FID)
- Total Blocking Time (TBT)
- Time to Interactive (TTI)
- Cumulative Layout Shift (CLS)

## Current Optimizations

### Completed Optimizations

1. **Testimonial Slider**: Changed from `client:load` to `client:visible`
   - Impact: Defers ~50KB of JavaScript until component is in viewport

2. **Video Reactions & Tabs**: Changed from `client:load` to `client:idle`
   - Impact: Improves initial page load by deferring non-critical interactions

3. **Statistics Component**: Changed from `client:load` to `client:visible`
   - Impact: Prevents unnecessary animation calculations on page load

### Future Optimization Candidates

1. **Sidebar Navigation**: Consider `client:idle` if not immediately needed
2. **Search Components**: Use `client:idle` for better performance
3. **Comment Sections**: Perfect for `client:visible`

## Testing Checklist

Before deploying hydration changes:

- [ ] Test on slow 3G connection
- [ ] Verify no layout shifts occur
- [ ] Ensure fallback content is meaningful
- [ ] Check accessibility with JavaScript disabled
- [ ] Monitor Core Web Vitals in production

## Measuring Success

Use these metrics to validate improvements:

1. **Lighthouse Performance Score**: Target 90+
2. **First Contentful Paint**: < 1.8s
3. **Time to Interactive**: < 3.8s
4. **Total Blocking Time**: < 200ms

## Common Pitfalls to Avoid

1. **Over-optimization**: Don't use `client:visible` for components users expect
   to work immediately
2. **Missing Loading States**: Always provide visual feedback for lazy-loaded
   components
3. **Accessibility**: Ensure the site is usable without JavaScript
4. **SEO Impact**: Verify critical content is server-rendered

## Framework-Specific Considerations

### Vue Components

- Use `<Suspense>` for async components
- Implement proper loading states
- Consider using `defineAsyncComponent` for code splitting

### React Components

- Use `React.lazy()` for component-level code splitting
- Implement error boundaries
- Consider using `startTransition` for non-urgent updates

## Conclusion

Progressive enhancement through strategic hydration is key to delivering fast,
accessible web experiences. Always prioritize user experience over pure
performance metrics, and continuously monitor the impact of optimizations in
production.
