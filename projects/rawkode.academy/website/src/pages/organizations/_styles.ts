/**
 * Shared PandaCSS style constants for organization pages.
 *
 * Consulting, training, and partnerships pages share nearly identical
 * section, card, typography, and interactive element styles. This module
 * keeps them in one place so changes propagate automatically.
 */
import { css } from "../../../styled-system/css";

/* ------------------------------------------------------------------ */
/*  Section layouts                                                    */
/* ------------------------------------------------------------------ */

export const sectionSep = css({ py: { base: "16", md: "20" } });

export const sectionHighlight = css({
	bg: { base: "gray.50", _dark: "gray.900" },
	position: "relative",
	overflow: "hidden",
});

export const sectionWhite = css({ bg: { base: "white", _dark: "gray.800" } });

/* ------------------------------------------------------------------ */
/*  Typography                                                         */
/* ------------------------------------------------------------------ */

export const heading = css({
	mb: "4",
	fontSize: { base: "3xl", md: "4xl" },
	fontWeight: "bold",
	letterSpacing: "tight",
	color: { base: "gray.900", _dark: "white" },
});

export const headingXl = css({
	mb: "4",
	fontSize: "3xl",
	letterSpacing: "tight",
	fontWeight: "extrabold",
	color: { base: "gray.900", _dark: "white" },
});

export const subText = css({
	fontSize: "lg",
	color: { base: "gray.600", _dark: "gray.400" },
	maxW: "3xl",
	mx: "auto",
});

export const mutedText = css({
	color: { base: "gray.600", _dark: "gray.400" },
});

export const secondaryContent = css({
	color: { base: "gray.700", _dark: "gray.300" },
});

/* ------------------------------------------------------------------ */
/*  Card patterns                                                      */
/* ------------------------------------------------------------------ */

export const serviceCard = css({
	bg: { base: "white", _dark: "gray.800" },
	p: "6",
	rounded: "lg",
	border: "1px solid",
	borderColor: { base: "gray.200", _dark: "gray.700" },
	shadow: "sm",
	transition: "all",
	transitionDuration: "300ms",
	_hover: { shadow: "md" },
});

export const serviceCardPopular = css({
	bg: { base: "white", _dark: "gray.800" },
	p: "6",
	rounded: "lg",
	borderWidth: "2px",
	borderColor: "colorPalette.default",
	shadow: "md",
	transition: "all",
	transitionDuration: "300ms",
	_hover: { shadow: "xl" },
	position: "relative",
});

export const priceCard = css({
	bg: { base: "white", _dark: "gray.800" },
	p: "6",
	rounded: "lg",
	border: "1px solid",
	borderColor: { base: "gray.200", _dark: "gray.700" },
	shadow: "sm",
	transition: "all",
	transitionDuration: "300ms",
	_hover: { shadow: "lg" },
});

export const stepCard = css({
	bg: { base: "white", _dark: "gray.800" },
	p: "6",
	rounded: "lg",
	border: "1px solid",
	borderColor: { base: "gray.200", _dark: "gray.700" },
	shadow: "sm",
	position: "relative",
});

/* ------------------------------------------------------------------ */
/*  Icon / feature-list primitives                                     */
/* ------------------------------------------------------------------ */

export const iconBubble = css({
	flexShrink: "0",
	p: "3",
	rounded: "full",
	mr: "4",
});

export const svgIcon6 = css({ w: "6", h: "6" });

export const serviceTitle = css({
	fontSize: "xl",
	fontWeight: "bold",
	color: { base: "gray.900", _dark: "white" },
});

export const featureList = css({
	display: "flex",
	flexDir: "column",
	gap: "2",
	mb: "4",
});

export const featureItem = css({
	display: "flex",
	alignItems: "flex-start",
});

export const checkIcon5 = css({ w: "5", h: "5", mt: "0.5", mr: "2" });

export const greenCheck = css({
	w: "5",
	h: "5",
	color: "green.500",
	mt: "0.5",
	mr: "2",
});

/* ------------------------------------------------------------------ */
/*  Step / process indicators                                          */
/* ------------------------------------------------------------------ */

export const stepNum = css({
	position: "absolute",
	top: "-4",
	left: "-4",
	w: "10",
	h: "10",
	color: "white",
	rounded: "full",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	fontWeight: "bold",
	fontSize: "lg",
});

export const stepTitle = css({
	fontSize: "lg",
	fontWeight: "bold",
	color: { base: "gray.900", _dark: "white" },
	mb: "3",
	mt: "2",
});

/* ------------------------------------------------------------------ */
/*  Pricing                                                            */
/* ------------------------------------------------------------------ */

export const priceValue = css({
	fontSize: "2xl",
	fontWeight: "bold",
	color: { base: "gray.900", _dark: "white" },
});

export const priceUnit = css({
	color: { base: "gray.600", _dark: "gray.400" },
});

export const bookLink = css({
	display: "block",
	w: "full",
	textAlign: "center",
	py: "2",
	px: "4",
	bg: "colorPalette.default",
	color: "white",
	rounded: "lg",
	transition: "colors",
	transitionDuration: "300ms",
});

export const popularTag = css({
	position: "absolute",
	top: "0",
	right: "0",
	px: "3",
	py: "1",
	bg: "colorPalette.default",
	color: "white",
	fontSize: "xs",
	fontWeight: "semibold",
	roundedBottomLeft: "lg",
	roundedTopRight: "lg",
});

/* ------------------------------------------------------------------ */
/*  CTA links                                                          */
/* ------------------------------------------------------------------ */

export const ctaLink = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	px: "6",
	py: "4",
	fontSize: "base",
	fontWeight: "medium",
	color: "white",
	bg: "colorPalette.default",
	rounded: "lg",
	transition: "all",
	transitionDuration: "300ms",
	shadow: "md",
	_hover: { shadow: "lg" },
});

export const ctaArrow = css({ w: "5", h: "5", ml: "2" });
