import { academyLayout } from "@rawkodeacademy/design-system";

// Keep Panda extraction separate from the dynamic Astro plugin graph reached by
// ShowLayout. The generated class names remain the same at render time.
export const showLayoutStyles = academyLayout({ width: "wide" });
