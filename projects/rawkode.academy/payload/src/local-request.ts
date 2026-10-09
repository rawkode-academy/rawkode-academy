const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]'])

function hostname(host: string): string {
  return host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0]!
}

/**
 * True only when both the request URL and the Host header name a loopback
 * address. A deployed Worker is reached through its route or workers.dev
 * hostname, so it can never satisfy this check.
 */
export function isLoopbackRequest(request: Request): boolean {
  const host = request.headers.get('host')
  if (!host) return false
  return loopbackHosts.has(new URL(request.url).hostname) && loopbackHosts.has(hostname(host.toLowerCase()))
}
