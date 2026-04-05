import { POST_URL_MAX_LENGTH } from "@/shared/input-limits";
import { RequestError } from "@/server/errors";

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["http:", "https:"]);
const TRACKING_PARAM_NAMES = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "mkt_tok",
  "ref",
  "ref_src",
  "ref_url",
]);

const isTrackingParam = (name: string) => {
  const normalized = name.trim().toLowerCase();
  return normalized.startsWith("utm_") || TRACKING_PARAM_NAMES.has(normalized);
};

const sortSearchEntries = (entries: Array<[string, string]>) =>
  [...entries].sort((left, right) => {
    const keyCompare = left[0].localeCompare(right[0]);
    if (keyCompare !== 0) {
      return keyCompare;
    }
    return left[1].localeCompare(right[1]);
  });

export const normalizeExternalUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new RequestError("URL is required", 400);
  }
  if (trimmed.length > POST_URL_MAX_LENGTH) {
    throw new RequestError(
      `URL must be ${POST_URL_MAX_LENGTH} characters or fewer`,
      400,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new RequestError("URL is invalid", 400);
  }

  if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
    throw new RequestError("URL must use http:// or https://", 400);
  }

  parsed.username = "";
  parsed.password = "";
  parsed.hash = "";

  if (
    (parsed.protocol === "https:" && parsed.port === "443") ||
    (parsed.protocol === "http:" && parsed.port === "80")
  ) {
    parsed.port = "";
  }

  const normalizedEntries = sortSearchEntries(
    Array.from(parsed.searchParams.entries()).filter(([key]) => !isTrackingParam(key)),
  );
  parsed.search = "";

  for (const [key, entryValue] of normalizedEntries) {
    parsed.searchParams.append(key, entryValue);
  }

  if (parsed.pathname !== "/") {
    parsed.pathname = parsed.pathname.replace(/\/+$/u, "") || "/";
  }

  return parsed.toString();
};

export const tryNormalizeExternalUrl = (value: string | null | undefined) => {
  if (!value?.trim()) {
    return null;
  }

  try {
    return normalizeExternalUrl(value);
  } catch {
    return null;
  }
};
