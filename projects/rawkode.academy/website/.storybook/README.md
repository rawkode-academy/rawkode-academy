# Storybook Setup for Rawkode Academy

This Storybook setup supports both React and Vue components used in the Astro
project.

## Running Storybook

```bash
bun run storybook
```

## Building Storybook

```bash
bun run build-storybook
```

## Creating Stories

### React Components

Create a `.stories.tsx` file next to your component:

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import MyComponent from "./MyComponent";

const meta = {
  title: "Category/ComponentName",
  component: MyComponent,
  tags: ["autodocs"],
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    // Your props here
  },
};
```

### Vue Components

Create a `.stories.ts` file next to your component:

```ts
import type { Meta, StoryObj } from "@storybook/vue3";
import MyComponent from "./MyComponent.vue";

const meta = {
  title: "Category/ComponentName",
  component: MyComponent,
  tags: ["autodocs"],
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    // Your props here
  },
};
```

## Component Organization

- **Components/Hero**: Hero sections and landing page components
- **Components/Stats**: Statistics display components
- **Components/Video**: Video player and related components
- **Components/Auth**: Authentication related components
- **Components/Articles**: Article cards and lists
- **Components/Courses**: Course-related components

## Astro Components

For Astro components (`.astro` files), create a React or Vue wrapper component
that mimics the same props and behavior. See `AsideWrapper.tsx` as an example.
