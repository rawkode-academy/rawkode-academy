import { sva } from "../../styled-system/css";

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
			backgroundColor: "action.primary",
			color: "action.primaryForeground",
			fontSize: "sm",
			fontWeight: "semibold",
			lineHeight: "tight",
			transitionProperty: "colors",
			transitionDuration: "fast",
			_hover: {
				backgroundColor: "action.interactive",
			},
			_focusVisible: {
				outline: "focus",
				outlineColor: "action.interactive",
				outlineOffset: "focus",
			},
			_motionReduce: {
				transitionDuration: "none",
			},
		},
		backdrop: {
			position: "fixed",
			inset: "0",
			zIndex: "overlay",
			backgroundColor: "editorial.overlay",
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
			borderColor: "border.default",
			borderRadius: "md",
			backgroundColor: "surface.panel",
			boxShadow: "dialog",
			color: "content.primary",
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
			color: "content.muted",
			fontSize: "sm",
			lineHeight: "body",
		},
		body: {
			padding: "6",
			color: "content.primary",
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
			color: "content.muted",
			fontSize: "xl",
			lineHeight: "tight",
			transitionProperty: "colors",
			transitionDuration: "fast",
			_hover: {
				backgroundColor: "surface.canvas",
				color: "content.primary",
			},
			_focusVisible: {
				outline: "focus",
				outlineColor: "action.interactive",
				outlineOffset: "focus",
			},
			_motionReduce: {
				transitionDuration: "none",
			},
		},
	},
	variants: {
		tone: {
			editorial: {},
			academy: {
				trigger: {
					backgroundColor: "academy.accent",
					color: "academy.accentForeground",
					_hover: {
						backgroundColor: "academy.accent",
					},
					_focusVisible: {
						outlineColor: "academy.accent",
					},
				},
				content: {
					borderColor: "academy.border",
					backgroundColor: "academy.panel",
					color: "academy.text",
				},
				title: {
					fontFamily: "academy-display",
				},
				description: {
					color: "academy.textSoft",
				},
				body: {
					color: "academy.text",
				},
				footer: {
					color: "academy.text",
				},
				closeTrigger: {
					color: "academy.textMuted",
					_hover: {
						backgroundColor: "academy.ground",
						color: "academy.text",
					},
					_focusVisible: {
						outlineColor: "academy.accent",
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
