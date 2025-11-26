/**
 * HTTP Header Utilities
 */

/**
 * Standard hop-by-hop headers that should not be forwarded by proxies.
 * RFC 2616 section 13.5.1
 */
export const HOP_BY_HOP_HEADERS = [
	"connection",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
];

/**
 * Headers that are specific to the payload and should not be forwarded
 * when the payload is being reconstructed or modified.
 */
export const PAYLOAD_HEADERS = [
	"content-length",
	"content-type",
	"content-encoding",
	"content-language",
	"content-location",
	"content-md5",
	"content-range",
];

/**
 * Headers that might interfere with routing or security if blindly forwarded.
 */
export const RESTRICTED_HEADERS = ["host", "origin", "referer"];

/**
 * Default headers to exclude when proxying requests or forwarding context.
 */
export const DEFAULT_PROXY_EXCLUDED_HEADERS = [
	...HOP_BY_HOP_HEADERS,
	...PAYLOAD_HEADERS,
	"host",
];

/**
 * Creates a new Headers object containing only safe-to-forward headers from the original.
 *
 * @param originalHeaders - The source headers
 * @param excludedHeaders - Array of header names to exclude (case-insensitive)
 * @returns A new Headers object
 */
export function getProxyableHeaders(
	originalHeaders: Headers | HeadersInit,
	excludedHeaders: string[] = DEFAULT_PROXY_EXCLUDED_HEADERS,
): Headers {
	const result = new Headers();
	const source = new Headers(originalHeaders);
	const lowerCaseExcluded = new Set(excludedHeaders.map((h) => h.toLowerCase()));

	for (const [key, value] of source.entries()) {
		if (!lowerCaseExcluded.has(key.toLowerCase())) {
			result.append(key, value);
		}
	}

	return result;
}
