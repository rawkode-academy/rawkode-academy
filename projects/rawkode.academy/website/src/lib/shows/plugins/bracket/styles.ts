import { academyLayout } from "@rawkodeacademy/design-system";

// Keep the shared Panda recipe in a TypeScript module so Panda's extractor does
// not need to bundle Astro components that are registered dynamically.
export const bracketLayout = academyLayout({ width: "wide" });
