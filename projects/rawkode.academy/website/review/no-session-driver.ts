type SessionDriver = {
  getItem: (key: string) => Promise<unknown>;
  setItem: (key: string, value: unknown) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

// The review surface authenticates through the Payload/OIDC bridge. This
// driver exists only to make accidental Astro session use fail closed without
// asking the Cloudflare adapter for a KV binding.
export default function noSessionDriver(): SessionDriver {
  return {
    async getItem() { return null; },
    async setItem() { throw new Error("Astro sessions are not available in the review surface"); },
    async removeItem() { return; },
  };
}
