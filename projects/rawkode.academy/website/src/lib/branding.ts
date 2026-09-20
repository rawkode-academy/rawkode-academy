/** Export the Academy's three monochrome path-only logos without page-wide CSS. */
export function academyLogoDownload(svg: string, color: "#0c1626" | "#ffffff") {
	const solid = svg
		.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
		.replace(/\s(?:class|fill)=("[^"]*"|'[^']*')/gi, "")
		.replace(/<svg\b/, `<svg fill="${color}"`);
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(solid)}`;
}
