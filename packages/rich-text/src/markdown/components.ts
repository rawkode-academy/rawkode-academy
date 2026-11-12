import { INTERACTIVE_COMPONENTS, type InteractiveComponent } from "../types";

export type ComponentName =
	| "Aside"
	| "Diagram"
	| "ZoomableImage"
	| "ThemeAwareImage"
	| "VideoPlayer"
	| InteractiveComponent;

// The website's MDX components, keyed by the import path the content uses.
// toMarkdown({ mdx: true }) writes these imports back.
export const COMPONENT_IMPORTS: Record<string, ComponentName> = {
	"@/components/Aside.astro": "Aside",
	"@/components/articles/Diagram.astro": "Diagram",
	"@/components/image/ZoomableImage.astro": "ZoomableImage",
	"@/components/common/ThemeAwareImage.astro": "ThemeAwareImage",
	"@/components/video/player.vue": "VideoPlayer",
	...Object.fromEntries(
		INTERACTIVE_COMPONENTS.map((name) => [
			`@/components/articles/cgroups/${name}`,
			name,
		]),
	),
};

export const VIDEO_THUMBNAIL_IMPORT = "@/lib/video-thumbnail";

export const COMPONENT_SOURCES = Object.fromEntries(
	Object.entries(COMPONENT_IMPORTS).map(([source, name]) => [name, source]),
) as Record<ComponentName, string>;
