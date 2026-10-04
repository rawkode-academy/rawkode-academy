const sensitiveHeaders = new Set(['authorization', 'cookie', 'proxy-authorization', 'x-api-key', 'x-auth-token'])

export function filterExternalFileHeaders(headers: Record<string, string>, context?: { isSameOrigin: boolean }): Record<string, string> {
  if (context?.isSameOrigin) return { ...headers }
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !sensitiveHeaders.has(name.toLowerCase())))
}
