import { css, cva } from "../../styled-system/css";

/** Panda v2 owns repeated layout, card, control, score and game-theme variants. */
export const arcadeShell = css({
	maxW: "8xl",
	mx: "auto",
	px: { base: "4", md: "8" },
});
export const arcadeStage = css({
	borderWidth: "1px",
	borderColor: "arcade.line",
	borderRadius: "arcade",
	bg: "arcade.panel",
	color: "arcade.cloud",
});
export const arcadeScore = css({
	fontFamily: "display",
	fontWeight: "bold",
	letterSpacing: "tight",
	color: "arcade.cloud",
});
export const arcadeCard = cva({
	base: {
		borderWidth: "1px",
		borderColor: "arcade.line",
		borderRadius: "arcade",
		bg: "arcade.panel",
	},
	variants: {
		tone: {
			default: {},
			raised: { bg: "arcade.panelRaised" },
			live: { borderColor: "arcade.cyan" },
		},
		padding: { compact: { p: "3" }, comfortable: { p: "5" } },
	},
	defaultVariants: { tone: "default", padding: "comfortable" },
});
export const arcadeControl = cva({
	base: {
		borderRadius: "control",
		fontWeight: "bold",
		transitionDuration: "fast",
		transitionProperty: "colors",
	},
	variants: {
		tone: {
			accent: { bg: "arcade.cyan", color: "arcade.ink" },
			outline: {
				borderWidth: "1px",
				borderColor: "arcade.cyan",
				color: "arcade.cyan",
			},
			quiet: { bg: "arcade.panelRaised", color: "arcade.cloud" },
		},
		size: {
			sm: { px: "3", py: "2", fontSize: "sm" },
			md: { px: "4", py: "3", fontSize: "sm" },
		},
	},
	defaultVariants: { tone: "accent", size: "md" },
});
export const gameTheme = cva({
	base: { borderWidth: "1px" },
	variants: {
		game: {
			"merge-conflict": { borderColor: "arcade.cyan" },
			spinlock: { borderColor: "arcade.violet" },
			"principal-engineer": { borderColor: "arcade.amber" },
			"race-condition": { borderColor: "arcade.coral" },
			"ten-nines": { borderColor: "arcade.lime" },
			"null-pointer": { borderColor: "arcade.pink" },
		},
	},
});
