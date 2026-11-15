import { sva } from "../../styled-system/css";
import { focusRing } from "../styles/focus";

export const dialog = sva({
	slots: [
		"trigger",
		"backdrop",
		"positioner",
		"content",
		"header",
		"title",
		"description",
		"body",
		"footer",
		"closeTrigger",
	],
	base: {
		trigger: {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			gap: "2",
			minHeight: "10",
			paddingInline: "4",
			borderRadius: "md",
			backgroundColor: "academy.accent",
			color: "academy.accentForeground",
			fontSize: "sm",
			fontWeight: "semibold",
			lineHeight: "tight",
			transitionProperty: "colors",
			transitionDuration: "fast",
			_hover: {
				backgroundColor: "academy.accentHover",
			},
			_focusVisible: focusRing,
			_motionReduce: {
				transitionDuration: "none",
			},
		},
		backdrop: {
			position: "fixed",
			inset: "0",
			zIndex: "overlay",
			backgroundColor: "academy.scrim",
		},
		positioner: {
			position: "fixed",
			inset: "0",
			zIndex: "overlay",
			display: "grid",
			alignItems: "start",
			justifyContent: "center",
			overflowY: "auto",
			padding: "4",
		},
		content: {
			width: "full",
			maxWidth: "lg",
			marginBlock: "auto",
			border: "hairline",
			borderColor: "academy.border",
			borderRadius: "md",
			backgroundColor: "academy.panel",
			boxShadow: "dialog",
			color: "academy.text",
		},
		header: {
			display: "flex",
			alignItems: "flex-start",
			justifyContent: "space-between",
			gap: "4",
			padding: "6",
			paddingBottom: "0",
		},
		title: {
			fontSize: "2xl",
			fontWeight: "semibold",
			letterSpacing: "tight",
			lineHeight: "dialog",
		},
		description: {
			marginTop: "2",
			color: "academy.textSoft",
			fontSize: "sm",
			lineHeight: "body",
		},
		body: {
			padding: "6",
			color: "academy.text",
		},
		footer: {
			display: "flex",
			justifyContent: "flex-end",
			gap: "2",
			padding: "6",
			paddingTop: "0",
		},
		closeTrigger: {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			width: "8",
			height: "8",
			borderRadius: "sm",
			color: "academy.textSoft",
			fontSize: "xl",
			lineHeight: "tight",
			transitionProperty: "colors",
			transitionDuration: "fast",
			_hover: {
				backgroundColor: "academy.canvas",
				color: "academy.text",
			},
			_focusVisible: focusRing,
			_motionReduce: {
				transitionDuration: "none",
			},
		},
	},
	variants: {
		// The base is the Academy dialog. `editorial` is the retired default
		// name and renders the base; `academy` adds the display title face
		// and the quieter close control the website modals use.
		tone: {
			editorial: {},
			academy: {
				trigger: {
					_hover: {
						backgroundColor: "academy.accent",
					},
				},
				title: {
					fontFamily: "academy-display",
				},
				closeTrigger: {
					color: "academy.textMuted",
					_hover: {
						backgroundColor: "academy.ground",
						color: "academy.text",
					},
				},
			},
		},
		size: {
			lg: { content: { maxWidth: "6xl" } },
			sm: {
				content: {
					maxWidth: "md",
				},
			},
			md: {
				content: {
					maxWidth: "lg",
				},
			},
		},
	},
	defaultVariants: {
		tone: "editorial",
		size: "md",
	},
});
