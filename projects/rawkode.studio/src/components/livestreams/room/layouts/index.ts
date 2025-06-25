import { layoutRegistry } from "@/lib/layout";
import { GridLayout } from "./GridLayout";
import { InterviewLayout } from "./InterviewLayout";
import { PanelLayout } from "./PanelLayout";
import { PictureInPictureLayout } from "./PictureInPictureLayout";
import { PresentationLayout } from "./PresentationLayout";
import { SideBySideLayout } from "./SideBySideLayout";
import { SingleSpeakerLayout } from "./SingleSpeakerLayout";

// Register all layouts
layoutRegistry.register({
  id: "grid",
  label: "Grid",
  description: "All participants are displayed in an equal-sized grid layout.",
  component: GridLayout,
  supportsScreenShare: false,
});

layoutRegistry.register({
  id: "single-speaker",
  label: "Single Speaker",
  description: "Only the active speaker is shown, perfect for presentations.",
  component: SingleSpeakerLayout,
  supportsScreenShare: true,
  maxParticipants: 1,
});

layoutRegistry.register({
  id: "side-by-side",
  label: "Side by Side",
  description: "Two sources displayed side-by-side, ideal for interviews.",
  component: SideBySideLayout,
  supportsScreenShare: true,
  maxParticipants: 2,
});

layoutRegistry.register({
  id: "picture-in-picture",
  label: "Picture in Picture",
  description: "Main content with small camera overlay in the corner.",
  component: PictureInPictureLayout,
  supportsScreenShare: true,
});

layoutRegistry.register({
  id: "presentation",
  label: "Presentation",
  description:
    "Optimized for presentations with screen sharing and speaker overlays.",
  component: PresentationLayout,
  supportsScreenShare: true,
});

layoutRegistry.register({
  id: "interview",
  label: "Interview",
  description: "Interview-style layout for 2-4 participants in conversation.",
  component: InterviewLayout,
  supportsScreenShare: false,
  minParticipants: 2,
  maxParticipants: 4,
});

layoutRegistry.register({
  id: "panel",
  label: "Panel",
  description: "Panel discussion format with optional screen share.",
  component: PanelLayout,
  supportsScreenShare: true,
});

// Re-export components and types
export { EmptyState } from "./EmptyState";
export { GridLayout } from "./GridLayout";
export { InterviewLayout } from "./InterviewLayout";
export { PanelLayout } from "./PanelLayout";
export { PictureInPictureLayout } from "./PictureInPictureLayout";
export { PresentationLayout } from "./PresentationLayout";
export { SideBySideLayout } from "./SideBySideLayout";
export { SingleSpeakerLayout } from "./SingleSpeakerLayout";
export type { LayoutProps } from "./types";
