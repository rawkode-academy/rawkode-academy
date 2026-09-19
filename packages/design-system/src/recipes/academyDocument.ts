import { sva } from "../../styled-system/css";

/** Shared Academy reading, course, show and contributor compositions.
 * Static document structure stays server rendered; interactive islands own behavior.
 */
export const academyDocument = sva({
	"slots": [
		"root",
		"hero",
		"container",
		"reading",
		"body",
		"main",
		"section",
		"panel",
		"stack",
		"stackSmall",
		"row",
		"rowBetween",
		"actions",
		"split",
		"grid",
		"gridTwo",
		"stats",
		"stat",
		"statValue",
		"title",
		"sectionTitle",
		"cardTitle",
		"lede",
		"copy",
		"meta",
		"kicker",
		"link",
		"tag",
		"tagList",
		"button",
		"buttonSecondary",
		"sidebar",
		"rule",
		"list",
		"listItem",
		"step",
		"stepIndex",
		"avatar",
		"avatarInitials",
		"portrait",
		"image",
		"media",
		"mediaColumn",
		"mediaOverlay",
		"mediaCaption",
		"mediaMeta",
		"play",
		"icon",
		"iconSmall",
		"iconLarge",
		"iconButton",
		"spacer",
		"dot",
		"hidden",
		"empty",
		"notice",
		"byline",
		"author",
		"authorMeta",
		"breadcrumb",
		"toc",
		"tocLink",
		"tocText",
		"end",
		"related",
		"relatedCard",
		"moduleFlow",
		"moduleFlowRail",
		"moduleRail",
		"moduleMain",
		"navItem",
		"copyright",
		"flush",
		"personHero",
		"showHero",
		"playOverlay",
		"mediaTitle",
		"adrProse",
		"resourceTarget"
	],
	"base": {
		"root": {
			"background": "academy.canvas",
			"color": "academy.text",
			"minWidth": "0"
		},
		"hero": {
			"background": "academy.ground",
			"borderBottom": "hairline",
			"borderColor": "academy.border",
			"paddingBlock": "12",
			"paddingInline": "academy-gutter",
			"_lg": {
				"paddingBlock": "16"
			}
		},
		"container": {
			"width": "full",
			"maxWidth": "academy-shell",
			"marginInline": "auto",
			"minWidth": "0"
		},
		"reading": {
			"width": "full",
			"maxWidth": "academy-copy",
			"marginInline": "auto",
			"minWidth": "0",
			"paddingBlock": "12",
			"paddingInline": "academy-gutter"
		},
		"body": {
			"display": "grid",
			"gap": "10",
			"width": "full",
			"maxWidth": "academy-shell",
			"marginInline": "auto",
			"paddingBlock": "12",
			"paddingInline": "academy-gutter",
			"_lg": {
				"gridTemplateColumns": "minmax(0, 1fr) 16rem",
				"gap": "16"
			}
		},
		"main": {
			"minWidth": "0",
			"width": "full"
		},
		"section": {
			"paddingBlock": "12",
			"paddingInline": "academy-gutter",
			"width": "full",
			"maxWidth": "academy-shell",
			"marginInline": "auto",
			"minWidth": "0"
		},
		"panel": {
			"minWidth": "0",
			"padding": "6",
			"background": "academy.panel",
			"border": "hairline",
			"borderColor": "academy.border",
			"borderRadius": "academy-m",
			"scrollMarginTop": "24",
			"_lg": {
				"padding": "8"
			}
		},
		"stack": {
			"display": "flex",
			"flexDirection": "column",
			"gap": "6",
			"minWidth": "0"
		},
		"stackSmall": {
			"display": "flex",
			"flexDirection": "column",
			"gap": "2",
			"minWidth": "0"
		},
		"row": {
			"display": "flex",
			"alignItems": "center",
			"gap": "3",
			"minWidth": "0"
		},
		"rowBetween": {
			"display": "flex",
			"flexWrap": "wrap",
			"alignItems": "center",
			"justifyContent": "space-between",
			"gap": "4",
			"minWidth": "0"
		},
		"actions": {
			"display": "flex",
			"flexWrap": "wrap",
			"alignItems": "center",
			"gap": "3"
		},
		"split": {
			"display": "grid",
			"gap": "10",
			"minWidth": "0",
			"_lg": {
				"gridTemplateColumns": "minmax(0, 1fr) 20rem",
				"alignItems": "start",
				"gap": "12"
			}
		},
		"grid": {
			"display": "grid",
			"gap": "6",
			"minWidth": "0",
			"_lg": {
				"gridTemplateColumns": "repeat(3, minmax(0, 1fr))"
			},
			"md": {
				"gridTemplateColumns": "repeat(2, minmax(0, 1fr))"
			}
		},
		"gridTwo": {
			"display": "grid",
			"gap": "6",
			"minWidth": "0",
			"md": {
				"gridTemplateColumns": "repeat(2, minmax(0, 1fr))"
			}
		},
		"stats": {
			"display": "grid",
			"gap": "6",
			"paddingBlock": "6",
			"borderBlock": "hairline",
			"borderColor": "academy.border",
			"_lg": {
				"gridTemplateColumns": "repeat(4, minmax(0, 1fr))"
			},
			"sm": {
				"gridTemplateColumns": "repeat(2, minmax(0, 1fr))"
			}
		},
		"stat": {
			"display": "flex",
			"flexDirection": "column",
			"gap": "2",
			"minWidth": "0"
		},
		"statValue": {
			"fontFamily": "academy-display",
			"fontSize": "2xl",
			"fontWeight": "bold",
			"color": "academy.text",
			"lineHeight": "tight"
		},
		"title": {
			"margin": "0",
			"fontFamily": "academy-display",
			"fontSize": "4xl",
			"fontWeight": "extrabold",
			"color": "academy.text",
			"lineHeight": "tight",
			"letterSpacing": "tight",
			"textWrap": "balance",
			"_lg": {
				"fontSize": "5xl"
			}
		},
		"sectionTitle": {
			"margin": "0",
			"fontFamily": "academy-display",
			"fontSize": "2xl",
			"fontWeight": "bold",
			"color": "academy.text",
			"lineHeight": "tight",
			"letterSpacing": "tight",
			"textWrap": "balance",
			"_lg": {
				"fontSize": "3xl"
			}
		},
		"cardTitle": {
			"margin": "0",
			"fontFamily": "academy-display",
			"fontSize": "xl",
			"fontWeight": "bold",
			"color": "academy.text",
			"lineHeight": "tight",
			"textWrap": "balance"
		},
		"lede": {
			"margin": "0",
			"maxWidth": "academy-copy",
			"color": "academy.textSoft",
			"fontSize": "lg",
			"lineHeight": "relaxed",
			"textWrap": "pretty"
		},
		"copy": {
			"margin": "0",
			"color": "academy.textSoft",
			"fontSize": "sm",
			"lineHeight": "relaxed"
		},
		"meta": {
			"display": "inline-flex",
			"flexWrap": "wrap",
			"alignItems": "center",
			"gap": "2",
			"margin": "0",
			"color": "academy.textMuted",
			"fontFamily": "academy-mono",
			"fontSize": "xs",
			"lineHeight": "relaxed"
		},
		"kicker": {
			"margin": "0",
			"color": "academy.accent",
			"fontFamily": "academy-mono",
			"fontSize": "xs",
			"fontWeight": "semibold",
			"letterSpacing": "wider",
			"textTransform": "uppercase"
		},
		"link": {
			"color": "academy.accent",
			"textDecoration": "none",
			"_hover": {
				"textDecoration": "underline",
				"textUnderlineOffset": "3px"
			},
			"_focusVisible": {
				"outline": "focus",
				"outlineColor": "academy.accent",
				"outlineOffset": "focus"
			}
		},
		"tag": {
			"display": "inline-flex",
			"alignItems": "center",
			"gap": "2",
			"paddingInline": "3",
			"paddingBlock": "1",
			"border": "hairline",
			"borderColor": "academy.border",
			"borderRadius": "academy-pill",
			"color": "academy.textSoft",
			"background": "academy.ground",
			"fontFamily": "academy-mono",
			"fontSize": "xs",
			"textDecoration": "none",
			"_hover": {
				"borderColor": "academy.accent",
				"color": "academy.accent"
			}
		},
		"tagList": {
			"display": "flex",
			"flexWrap": "wrap",
			"gap": "2",
			"listStyle": "none",
			"margin": "0",
			"padding": "0"
		},
		"button": {
			"display": "inline-flex",
			"alignItems": "center",
			"justifyContent": "center",
			"gap": "2",
			"minHeight": "11",
			"paddingInline": "5",
			"paddingBlock": "3",
			"background": "academy.accent",
			"color": "academy.accentForeground",
			"border": "academy-button",
			"borderRadius": "academy-s",
			"fontFamily": "academy-text",
			"fontWeight": "semibold",
			"textDecoration": "none",
			"cursor": "pointer",
			"_focusVisible": {
				"outline": "focus",
				"outlineColor": "academy.accent",
				"outlineOffset": "focus"
			},
			"_hover": {
				"opacity": "0.9"
			}
		},
		"buttonSecondary": {
			"display": "inline-flex",
			"alignItems": "center",
			"justifyContent": "center",
			"gap": "2",
			"minHeight": "11",
			"paddingInline": "5",
			"paddingBlock": "3",
			"background": "academy.panel",
			"color": "academy.text",
			"border": "hairline",
			"borderColor": "academy.inputBorder",
			"borderRadius": "academy-s",
			"fontFamily": "academy-text",
			"fontWeight": "semibold",
			"textDecoration": "none",
			"cursor": "pointer",
			"_focusVisible": {
				"outline": "focus",
				"outlineColor": "academy.accent",
				"outlineOffset": "focus"
			},
			"_hover": {
				"borderColor": "academy.accent",
				"color": "academy.accent"
			}
		},
		"sidebar": {
			"display": "flex",
			"flexDirection": "column",
			"gap": "6",
			"minWidth": "0",
			"alignSelf": "start",
			"_lg": {
				"position": "sticky",
				"top": "24"
			}
		},
		"rule": {
			"borderTop": "hairline",
			"borderColor": "academy.border",
			"paddingTop": "6",
			"marginTop": "6"
		},
		"list": {
			"listStyle": "none",
			"padding": "0",
			"margin": "0",
			"display": "flex",
			"flexDirection": "column",
			"gap": "0"
		},
		"listItem": {
			"paddingBlock": "5",
			"borderBottom": "hairline",
			"borderColor": "academy.border",
			"minWidth": "0"
		},
		"step": {
			"display": "grid",
			"gridTemplateColumns": "2.75rem minmax(0, 1fr)",
			"gap": "4",
			"paddingBlock": "4",
			"alignItems": "start",
			"borderBottom": "hairline",
			"borderColor": "academy.border"
		},
		"stepIndex": {
			"display": "grid",
			"placeItems": "center",
			"width": "11",
			"height": "11",
			"borderRadius": "academy-pill",
			"border": "hairline",
			"borderColor": "academy.border",
			"background": "academy.ground",
			"color": "academy.accent",
			"fontFamily": "academy-mono",
			"fontWeight": "semibold",
			"fontSize": "sm",
			"flexShrink": "0"
		},
		"avatar": {
			"width": "11",
			"height": "11",
			"borderRadius": "academy-pill",
			"objectFit": "cover",
			"flexShrink": "0",
			"border": "hairline",
			"borderColor": "academy.border"
		},
		"avatarInitials": {
			"display": "grid",
			"placeItems": "center",
			"width": "11",
			"height": "11",
			"borderRadius": "academy-pill",
			"background": "academy.accent",
			"color": "academy.accentForeground",
			"fontFamily": "academy-display",
			"fontWeight": "bold",
			"flexShrink": "0"
		},
		"portrait": {
			"width": "40",
			"height": "40",
			"borderRadius": "academy-pill",
			"overflow": "hidden",
			"border": "hairline",
			"borderColor": "academy.border",
			"flexShrink": "0",
			"marginInline": "auto",
			"md": {
				"marginInline": "0",
				"width": "48",
				"height": "48"
			}
		},
		"image": {
			"display": "block",
			"width": "full",
			"height": "full",
			"objectFit": "cover"
		},
		"media": {
			"position": "relative",
			"overflow": "hidden",
			"border": "hairline",
			"borderColor": "academy.border",
			"borderRadius": "academy-m",
			"background": "academy.ground",
			"aspectRatio": "academy-video",
			"& img": {
				"width": "full",
				"height": "full",
				"objectFit": "cover"
			}
		},
		"mediaColumn": {
			"width": "full",
			"minWidth": "0",
			"alignSelf": "center"
		},
		"mediaOverlay": {
			"position": "absolute",
			"inset": "0",
			"background": "linear-gradient(transparent, rgba(0, 0, 0, 0.8))",
			"pointerEvents": "none"
		},
		"mediaCaption": {
			"position": "absolute",
			"insetInline": "0",
			"bottom": "0",
			"padding": "4",
			"display": "flex",
			"flexDirection": "column",
			"gap": "2",
			"color": "white",
			"& p": {
				"margin": "0",
				"color": "inherit"
			}
		},
		"mediaMeta": {
			"color": "white",
			"fontFamily": "academy-mono",
			"fontSize": "xs",
			"display": "flex",
			"flexWrap": "wrap",
			"gap": "3"
		},
		"play": {
			"display": "grid",
			"placeItems": "center",
			"width": "16",
			"height": "16",
			"borderRadius": "academy-pill",
			"background": "academy.accent",
			"color": "academy.accentForeground"
		},
		"icon": {
			"width": "5",
			"height": "5",
			"flexShrink": "0"
		},
		"iconSmall": {
			"width": "4",
			"height": "4",
			"flexShrink": "0"
		},
		"iconLarge": {
			"width": "6",
			"height": "6",
			"flexShrink": "0"
		},
		"iconButton": {
			"display": "inline-flex",
			"alignItems": "center",
			"justifyContent": "center",
			"width": "11",
			"height": "11",
			"border": "hairline",
			"borderColor": "academy.border",
			"borderRadius": "academy-s",
			"background": "academy.panel",
			"color": "academy.textSoft",
			"_hover": {
				"color": "academy.accent",
				"borderColor": "academy.accent"
			},
			"_focusVisible": {
				"outline": "focus",
				"outlineColor": "academy.accent",
				"outlineOffset": "focus"
			}
		},
		"spacer": {
			"flex": "1",
			"minWidth": "0"
		},
		"dot": {
			"width": "1.5",
			"height": "1.5",
			"borderRadius": "academy-pill",
			"background": "academy.accent",
			"flexShrink": "0"
		},
		"hidden": {
			"display": "none"
		},
		"empty": {
			"textAlign": "center",
			"padding": "12",
			"border": "hairline",
			"borderColor": "academy.border",
			"borderRadius": "academy-m",
			"background": "academy.panel",
			"color": "academy.textSoft",
			"display": "flex",
			"flexDirection": "column",
			"alignItems": "center",
			"gap": "4"
		},
		"notice": {
			"padding": "4",
			"border": "hairline",
			"borderColor": "academy.border",
			"borderRadius": "academy-s",
			"background": "academy.ground",
			"color": "academy.textSoft",
			"marginBottom": "6",
			"fontSize": "sm"
		},
		"byline": {
			"display": "flex",
			"flexWrap": "wrap",
			"alignItems": "center",
			"gap": "5",
			"paddingTop": "6",
			"borderTop": "hairline",
			"borderColor": "academy.border"
		},
		"author": {
			"display": "inline-flex",
			"alignItems": "center",
			"gap": "3",
			"color": "academy.text",
			"textDecoration": "none"
		},
		"authorMeta": {
			"display": "flex",
			"flexDirection": "column",
			"gap": "1",
			"fontSize": "sm",
			"fontWeight": "medium"
		},
		"breadcrumb": {
			"display": "flex",
			"flexWrap": "wrap",
			"gap": "3",
			"alignItems": "center",
			"maxWidth": "academy-shell",
			"marginInline": "auto",
			"paddingInline": "academy-gutter",
			"paddingBlock": "4",
			"color": "academy.textMuted",
			"fontFamily": "academy-mono",
			"fontSize": "xs"
		},
		"toc": {
			"display": "flex",
			"flexDirection": "column",
			"gap": "4",
			"alignSelf": "start",
			"_lg": {
				"position": "sticky",
				"top": "24"
			}
		},
		"tocLink": {
			"display": "block",
			"paddingBlock": "3",
			"borderBottom": "hairline",
			"borderColor": "academy.border",
			"textDecoration": "none",
			"color": "academy.textSoft",
			"fontSize": "sm",
			"lineHeight": "relaxed",
			"_hover": {
				"color": "academy.accent"
			},
			"&[aria-current=\"location\"]": {
				"color": "academy.accent",
				"fontWeight": "semibold"
			}
		},
		"tocText": {
			"color": "inherit"
		},
		"end": {
			"display": "flex",
			"flexWrap": "wrap",
			"alignItems": "center",
			"justifyContent": "space-between",
			"gap": "4",
			"borderTop": "hairline",
			"borderColor": "academy.border",
			"paddingBlock": "6",
			"marginTop": "12"
		},
		"related": {
			"background": "academy.ground",
			"borderTop": "hairline",
			"borderColor": "academy.border",
			"paddingInline": "academy-gutter",
			"paddingBlock": "12",
			"marginTop": "12"
		},
		"relatedCard": {
			"display": "flex",
			"flexDirection": "column",
			"gap": "3",
			"padding": "6",
			"border": "hairline",
			"borderColor": "academy.border",
			"borderRadius": "academy-m",
			"background": "academy.panel",
			"color": "academy.text",
			"textDecoration": "none",
			"_hover": {
				"borderColor": "academy.accent"
			}
		},
		"moduleFlow": {
			"display": "grid",
			"gap": "10",
			"minWidth": "0"
		},
		"moduleFlowRail": {
			"_lg": {
				"gridTemplateColumns": "minmax(0, 1fr) 20rem",
				"columnGap": "12",
				"alignItems": "start"
			}
		},
		"moduleRail": {
			"minWidth": "0",
			"_lg": {
				"gridColumn": "2",
				"gridRow": "1 / span 3",
				"position": "sticky",
				"top": "24",
				"alignSelf": "start"
			}
		},
		"moduleMain": {
			"display": "flex",
			"flexDirection": "column",
			"gap": "6",
			"minWidth": "0",
			"_lg": {
				"gridColumn": "1"
			}
		},
		"navItem": {
			"display": "flex",
			"flexDirection": "column",
			"gap": "3",
			"paddingBlock": "5",
			"borderBottom": "hairline",
			"borderColor": "academy.border",
			"color": "academy.text",
			"textDecoration": "none",
			"_hover": {
				"color": "academy.accent"
			}
		},
		"copyright": {
			"fontSize": "xs",
			"color": "academy.textMuted"
		},
		"flush": {
			"margin": "0",
			"padding": "0"
		},
		"personHero": {
			"display": "grid",
			"gap": "8",
			"alignItems": "start",
			"md": {
				"gridTemplateColumns": "12rem minmax(0, 1fr)",
				"gap": "12"
			}
		},
		"showHero": {
			"display": "grid",
			"gap": "8",
			"alignItems": "center",
			"_lg": {
				"gridTemplateColumns": "minmax(0, 1.2fr) minmax(0, 0.8fr)",
				"gap": "12"
			}
		},
		"playOverlay": {
			"position": "absolute",
			"inset": "0",
			"display": "grid",
			"placeItems": "center",
			"pointerEvents": "none"
		},
		"mediaTitle": {
			"fontFamily": "academy-display",
			"fontSize": "lg",
			"fontWeight": "bold",
			"lineHeight": "tight",
			"color": "white"
		},
		"adrProse": {
			"& > h1:first-child": {
				"display": "none"
			}
		},
		"resourceTarget": {
			"scrollMarginTop": "24",
			"&:target > a": {
				"outline": "focus",
				"outlineColor": "academy.accent",
				"outlineOffset": "focus"
			}
		}
	}
});
