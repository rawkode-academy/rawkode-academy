# Rawkode Studio

An Astro-based website with a custom component library built on Radix UI and Tailwind CSS.

## 🧞 Commands

| Command         | Action                                      |
| :-------------- | :------------------------------------------ |
| `bun install`   | Install dependencies                        |
| `bun dev`       | Start dev server at `localhost:4321`        |
| `bun build`     | Build for production to `./dist/`           |
| `bun preview`   | Preview production build                    |

## 🎨 Component Library

Built with:
- **Radix UI** - Unstyled, accessible component primitives
- **Tailwind CSS v4** - Utility-first CSS with CSS variables
- **TypeScript** - Type safety
- **CVA** - Component variant management

### Using Components

```tsx
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

// Components use design tokens from global.css
<Button variant="primary" size="lg">
  Click me
</Button>
```

## 📁 Import Aliases

The project uses `@/` as an alias for the `src/` directory:

```tsx
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
```

## 🎙️ Local Recording + Descript (New)

This app supports local, high‑quality recording with trickle upload to Cloudflare R2 and one‑click “Edit in Descript”. It prefers MP4/H.264 with audio when the browser supports it; otherwise it uses a WebCodecs H.264 path (video‑only) so you still get 4K video on Chrome/Edge.

### Environment

Add to `.env` (see `.env.example`):

- `R2_ACCOUNT_ID` — Cloudflare account ID
- `R2_BUCKET` — R2 bucket name
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` — S3‑compatible keys
- `R2_PUBLIC_HOST` — optional public host (e.g. https://media.rawkode.studio)
- `DESCRIPT_PARTNER_DRIVE_ID` — provided by Descript
- `DESCRIPT_API_TOKEN` — personal token for Descript API

These are declared in `astro.config.ts` and available on the server at runtime.

### APIs

- `POST /api/uploads/:session/:track/init` — start R2 multipart upload
- `GET  /api/uploads/:session/:track/part?uploadId&partNumber&key` — sign part PUT
- `POST /api/uploads/:session/:track/complete` — complete multipart upload
- `POST /api/descript/import-url` — create a Descript Import URL from file keys

### Usage

In the meeting room, use the bottom‑right overlay to Start/Pause/Resume/Stop a local recording and open “Edit in Descript”. Recording requests 4K (3840×2160) when available and uploads 4‑second chunks during capture. Uploads are bandwidth‑capped (~500 kbps) while recording to stay network‑friendly; after Stop, final chunks are flushed at full speed.

Notes:
- Recorder prefers `video/mp4` (H.264/AAC) when supported (Safari and some Chromium builds). Otherwise uses Mediabunny (WebCodecs) to encode H.264 into fragmented MP4 on Chrome/Edge with AAC/FLAC audio when available.
- Files are stored as `sessions/{sessionId}/{trackId}/recording.mp4`.
- Generate the Descript import link after uploads finish. Links expire after 3 hours.
 - If you need cross‑browser audio alongside WebCodecs video, the next step is adding an AudioWorklet FLAC path (Descript supports FLAC) — reach out if you want that shipped next.

### Libraries Used
- Mediabunny — WebCodecs helpers + MP4 muxing for robust, fast 4K pipelines.
- aws4fetch — SigV4 signing for R2 multipart uploads in Workers.
- (Optional) Uppy — packages are installed for future resumable upload UI (`@uppy/core`, `@uppy/aws-s3`, `@uppy/golden-retriever`).
