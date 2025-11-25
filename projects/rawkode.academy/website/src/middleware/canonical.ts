import type { MiddlewareHandler } from "astro";

/**
 * Canonicalization middleware
 * - Force HTTPS
 * - Force apex domain (no www)
 * - Remove trailing slash on non-root, non-file paths
 * - Strip /index.html suffix
 *
 * Only redirects GET/HEAD to avoid breaking non-idempotent methods.
 */
export const canonicalMiddleware: MiddlewareHandler = async (context, next) => {
	const req = context.request;
	const url = new URL(req.url);

	// Skip canonicalization for local development (localhost, 127.0.0.1, etc.)
	// This check runs at runtime and can't be optimized away during build
	const hostname = url.hostname;
	if (
		hostname === "localhost" ||
		hostname === "127.0.0.1" ||
		hostname.startsWith("192.168.") ||
		hostname.startsWith("10.") ||
		hostname.endsWith(".local")
	) {
		return next();
	}

	// Also skip in DEV mode (astro dev)
	if (import.meta.env.DEV) {
		return next();
	}

	// Only normalize for GET/HEAD to be safe for forms/APIs.
	const isSafeMethod = req.method === "GET" || req.method === "HEAD";
	if (!isSafeMethod) return next();

	const originalHost = url.hostname;
	const desiredHost = "rawkode.academy";
	const prodHosts = new Set([desiredHost, `www.${desiredHost}`]);

	// Skip canonicalization for non-production hosts (local dev, preview domains)
	// Examples: localhost, 127.0.0.1, *.pages.dev, *.workers.dev, any host not our prod apex or www
	if (!prodHosts.has(originalHost)) {
		return next();
	}

	// Determine if path points to a file (contains a dot after last slash)
	const path = url.pathname;
	const isFilePath = /\.[a-zA-Z0-9]+$/.test(path);

	// Compute desired components
	let redirectNeeded = false;
	let newProtocol = url.protocol;
	let newHost = originalHost;
	let newPath = path;

	// 1) Force HTTPS
	if (url.protocol !== "https:") {
		newProtocol = "https:";
		redirectNeeded = true;
	}

	// 2) Force apex (no www)
	if (originalHost === `www.${desiredHost}`) {
		newHost = desiredHost;
		redirectNeeded = true;
	}

	// 3) Strip /index.html
	if (newPath.endsWith("/index.html")) {
		newPath = newPath.replace(/\/index\.html$/, "");
		redirectNeeded = true;
	}

	// 4) Remove trailing slash on non-root, non-file paths
	if (!isFilePath && newPath.length > 1 && newPath.endsWith("/")) {
		newPath = newPath.slice(0, -1);
		redirectNeeded = true;
	}

	if (redirectNeeded) {
		// Preserve port only if present and not default (should not happen on prod)
		const port = url.port ? `:${url.port}` : "";
		const location = `${newProtocol}//${newHost}${port}${newPath}${url.search}`;
		return new Response(null, {
			status: 301,
			headers: { Location: location },
		});
	}

	return next();
};
