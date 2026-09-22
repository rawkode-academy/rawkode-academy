/** Export the Academy's three monochrome path-only logos without page-wide CSS. */
export function academyLogoDownload(svg: string, color: "#0c1626" | "#ffffff") {
	// Strip until stable so a removal cannot reassemble a new style element.
	let stripped = svg;
	for (;;) {
		const next = stripped.replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "");
		if (next === stripped) break;
		stripped = next;
	}
	const solid = stripped
		.replace(/\s(?:class|fill)=("[^"]*"|'[^']*')/gi, "")
		.replace(/<svg\b/, `<svg fill="${color}"`);
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(solid)}`;
}
