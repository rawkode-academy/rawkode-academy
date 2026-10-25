// Vitest stand-in for the `cloudflare:workers` module. Tests inject bindings
// with setContentEnv() instead of relying on this empty env.
export const env: Record<string, unknown> = {};
export const cache = {
	purge: async (_options: { tags?: string[] }) => ({ success: true }),
};
export function waitUntil(promise: Promise<unknown>): void {
	void promise;
}
