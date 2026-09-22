import { sva } from "../../styled-system/css";

/**
 * Presentation primitives for media-heavy Academy surfaces.
 *
 * This intentionally stops short of owning a player, game, terminal, or
 * explorer interaction. Those applications keep their own state and visual
 * language; this recipe gives their route-level frame the same responsive
 * spacing, contrast, and focus treatment as the shared Academy shell.
 */
export const academyMedia = sva({
	slots: [
		"root",
		"hero",
		"frame",
		"canvas",
		"toolbar",
		"status",
		"body",
		"aside",
		"notice",
	],
	base: {
		root: {
			backgroundColor: "academy.canvas",
			color: "academy.text",
		},
		hero: {
			backgroundColor: "academy.ground",
			borderBottom: "hairline",
			borderColor: "academy.border",
		},
		frame: {
			backgroundColor: "academy.panel",
			border: "hairline",
			borderColor: "academy.border",
			borderRadius: "academy-m",
			overflow: "hidden",
		},
		canvas: {
			backgroundColor: "academyBase.ground",
			color: "academyBase.text",
		},
		toolbar: {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: "3",
			padding: "4",
			backgroundColor: "academy.panel",
			borderBottom: "hairline",
			borderColor: "academy.border",
		},
		status: {
			fontFamily: "academy-mono",
			fontSize: "xs",
			letterSpacing: "wide",
			color: "academy.textMuted",
		},
		body: {
			paddingBlock: "academy-section",
		},
		aside: {
			backgroundColor: "academy.panel",
			border: "hairline",
			borderColor: "academy.border",
			borderRadius: "academy-m",
		},
		notice: {
			border: "hairline",
			borderColor: "academy.border",
			borderRadius: "academy-s",
			backgroundColor: "academy.panel",
			color: "academy.textSoft",
		},
	},
});
