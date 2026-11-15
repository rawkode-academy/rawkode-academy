# Storybook

Storybook is where Academy primitives and composed specimens are reviewed in
both colour schemes, and what the visual checks run against.

```bash
bun run storybook            # dev server on :6006
bun run build-storybook      # static build in storybook-static/
bun run test:visual          # build, then axe and screenshot checks
bun run test:visual:update   # same, and rewrite the screenshot baselines
```

## Writing a story

The framework is `@storybook/react-vite`, so every story file is a
`.stories.tsx` that returns React. Stories live next to the component, or in
`src/stories/` for design-system specimens.

- **Vue components** render through `VueInReact` from
  `src/components/vue-wrapper`. For slots or several instances, wrap them in a
  `defineComponent` with a render function and pass that. A story that
  returns a Vue `{ components, template }` object does not work here.
- **Astro components** cannot render in Storybook. Build the specimen from the
  same design-system recipe the component uses.
- **Styles** come from design-system recipes. Inline `style` is for specimen
  layout only.
- **Fixtures** are local: no fetch, and images from `public/` or `src/`. The
  visual checks abort any request that leaves the local server and fail the
  story.
- **Theme** comes from the toolbar global. `preview.ts` sets `light` or `dark`
  on `<html>`, which is what switches the Panda semantic tokens.
- **Fonts** are the vendored `@fontsource-variable/red-hat-*` packages, so a
  story renders the same on every machine.

## Visual checks

`visual/` holds a Playwright suite that reads `storybook-static/index.json`
and runs against a local static server. It needs no network.

- `a11y.visual.ts` runs axe (WCAG 2.x A and AA) on every story in light and
  dark. A new story is covered with no extra code. Opt out with
  `tags: ["!a11y"]` and a comment that says why.
- `screenshots.visual.ts` compares stories tagged `visual` with the PNGs in
  `visual/__screenshots__/`, in light and dark at 1280px. Add `visual-mobile`
  for a 390px pass that also fails on sideways scroll. Keep the tagged set
  small: primitives and a few composed specimens.

The comparison is strict (at most 20 differing pixels, colour threshold
0.02), and a story is inspected only after its render and play function have
finished; a play function that throws fails the story.

No CI workflow runs `test:visual` yet. Run it by hand after a recipe, token
or story change, or a failing story and a stale baseline can merge unnoticed.

Baselines are rendered on Linux with the Chromium that matches the pinned
`@playwright/test` version; the screenshot spec skips on other platforms.
After an intended visual change run `bun run test:visual:update`, look at
each changed PNG, and commit them with the change.
