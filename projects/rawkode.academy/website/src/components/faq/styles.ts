import { css } from "styled-system/css";

export const sectionStyles = css({
	bg: { base: "white", _dark: "gray.900" },
});

export const containerStyles = css({
	py: "8",
	px: "4",
	mx: "auto",
	maxW: "breakpoint-xl",
	sm: { py: "16" },
	lg: { px: "6" },
});

export const innerStyles = css({
	mx: "auto",
	maxW: "breakpoint-md",
});
