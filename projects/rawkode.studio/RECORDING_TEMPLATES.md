# Recording Templates Documentation

## Overview

This system provides custom recording layouts for LiveKit egress that mirror the UI layouts available in the application. Each layout has a corresponding recording template that can be used for composite recording.

## How It Works

1. **Layout Registry**: All layouts are registered in `layoutRegistry` with their recording template paths
2. **Dynamic Routes**: Recording templates are served via dynamic Astro route at `/recording-templates/[layout]`
3. **Automatic Mapping**: When creating a room with composite recording, the layout is automatically mapped to its recording template URL

## Available Layouts

- **grid**: Equal-sized grid for all participants
- **single-speaker**: Single active speaker view
- **side-by-side**: Two sources side-by-side
- **picture-in-picture**: Main content with PiP overlay
- **presentation**: Screen share with speaker overlays
- **interview**: 2-4 participant interview layout
- **panel**: Panel discussion with optional screen share

## Testing with LiveKit CLI

To test recording templates locally:

```bash
# Install LiveKit CLI
brew install livekit-cli

# Test a recording template (replace with your local URL and layout)
livekit-cli test-egress-template \
  --url "http://localhost:4321/recording-templates/grid"

# You can also test with specific dimensions
livekit-cli test-egress-template \
  --url "http://localhost:4321/recording-templates/presentation" \
  --width 1920 \
  --height 1080
```

## Adding a New Layout

1. Create the layout component in `/src/components/livestreams/room/layouts/`
2. Create the recording template in `/src/components/recording-templates/layouts/`
3. Register the layout in `/src/components/livestreams/room/layouts/index.ts`:

```typescript
layoutRegistry.register({
  id: "my-layout",
  label: "My Layout",
  description: "Description of my layout",
  component: MyLayoutComponent,
  recordingTemplatePath: "/recording-templates/my-layout",
  supportsScreenShare: true,
});
```

4. Register the recording template in `/src/components/recording-templates/templateRegistry.ts`:

```typescript
export const recordingTemplates: Record<string, ComponentType> = {
  // ... existing templates
  "my-layout": MyLayoutRecordingTemplate,
};
```

## Recording Template Structure

Each recording template:
- Uses the `BaseRecordingTemplate` wrapper for LiveKit connection
- Implements the same visual layout as the UI component
- Handles participant video/audio tracks
- Supports nameplates and visual indicators

## Dynamic Layout Updates

When the layout is changed during a live stream:
1. The UI layout updates immediately
2. If composite recording is active, the egress layout is also updated
3. This ensures recordings match what viewers see in the UI