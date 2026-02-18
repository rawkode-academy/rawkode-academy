import { getDomain } from "tldts";

const stripWww = (host: string) => host.replace(/^www\./i, "");

export function getExternalDomainLabel(url: string): string | null {
  try {
    const parsed = new URL(url);
    const domain = getDomain(parsed.hostname);
    if (domain) {
      return stripWww(domain);
    }
    return stripWww(parsed.hostname);
  } catch {
    return null;
  }
}
