import type { CSSProperties, ReactNode } from "react";
import apiServer from "../../public/games/secret-of-kubernetes-island/scenes/scene-api-server.webp?url";
import controlPlane from "../../public/games/secret-of-kubernetes-island/scenes/scene-control-plane.webp?url";
import serviceMesh from "../../public/games/secret-of-kubernetes-island/scenes/scene-service-mesh.webp?url";

// Specimen layout shared by the design-system stories. Product styles live
// in design-system recipes; nothing here ships to the site.

/** Real Academy artwork, so a still in a story is a still. */
export const stills = { apiServer, controlPlane, serviceMesh };

export const canvas: CSSProperties = {
	display: "grid",
	gap: "3rem",
	padding: "3rem clamp(20px, 4vw, 48px)",
	background: "var(--colors-academy-canvas)",
	color: "var(--colors-academy-text)",
	fontFamily: "var(--fonts-academy-text)",
};

const caption: CSSProperties = {
	margin: 0,
	color: "var(--colors-academy-text-muted)",
	fontFamily: "var(--fonts-academy-mono)",
	fontSize: "0.75rem",
};

export const Specimen = ({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) => (
	<div style={{ display: "grid", gap: "1rem", minWidth: 0 }}>
		<p style={caption}>{label}</p>
		{children}
	</div>
);
