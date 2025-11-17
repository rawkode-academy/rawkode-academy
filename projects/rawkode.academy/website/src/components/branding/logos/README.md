Branding assets

Canonical logo assets live in this directory. IMPORTANT:

- Only store the black (monochrome) versions of logos in this repository. The site will theme them with CSS for light/dark and color variants.
- Use inline `?raw` imports when you need to apply `currentColor` coloring in the site code (see `branding/index.astro`).
- Do NOT store duplicate copies in `public/` — this avoids drift. If public URLs are required for external partners, add a script to export assets during a release instead of maintaining a second copy.

Files:
- `RKAcademy_Monogram_Black_RGB.svg` — monogram.
- `RKAcademy_Logo_Black_RGB.svg` — wordmark.
 - `RKAcademy_Icon_Black_RGB.svg` — logo / icon.
