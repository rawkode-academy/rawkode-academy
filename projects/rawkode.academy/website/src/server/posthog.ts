import { POSTHOG_API_KEY, POSTHOG_HOST } from "astro:env/server";

type CaptureOptions = {
  event: string;
  properties?: Record<string, unknown>;
  distinctId?: string;
};

/**
 * Attempt to extract the PostHog anonymous distinct id from cookies.
 * Looks for a cookie named `ph_*_posthog` and parses its JSON value.
 */
export function getAnonDistinctIdFromCookies(req: Request): string | undefined {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return undefined;

  // Find a cookie like ph_<projectKey>_posthog
  const match = cookieHeader.match(/(?:^|;\s*)ph_[^=]+_posthog=([^;]+)/);
  if (!match) return undefined;
  try {
    const decoded = decodeURIComponent(match[1]);
    const payload = JSON.parse(decoded);
    if (payload && typeof payload.distinct_id === "string") {
      return payload.distinct_id as string;
    }
  } catch {
    // ignore
  }
  return undefined;
}

async function posthogCapture(body: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("PostHog capture failed", err);
  }
}

export async function captureServerEvent(
  opts: CaptureOptions,
): Promise<void> {
  const { event, properties = {}, distinctId } = opts;
  if (!POSTHOG_API_KEY) {
    console.warn("POSTHOG_API_KEY not configured; skipping analytics event", event);
    return;
  }

  const body = {
    api_key: POSTHOG_API_KEY,
    event,
    properties,
    distinct_id: distinctId ?? (properties as any)?.distinct_id ?? "anonymous",
  };

  await posthogCapture(body);
}

type IdentifyOptions = {
  distinctId: string; // identified user id
  anonId?: string; // optional anonymous id to merge with
  set?: Record<string, unknown>;
  setOnce?: Record<string, unknown>;
};

/**
 * Associate an anonymous id with an identified user and set person properties.
 */
export async function identifyServerUser(opts: IdentifyOptions): Promise<void> {
  const { distinctId, anonId, set, setOnce } = opts;
  if (!POSTHOG_API_KEY) return;

  const identifyEvent = {
    api_key: POSTHOG_API_KEY,
    event: "$identify",
    distinct_id: distinctId,
    properties: {
      ...(set ? { $set: set } : {}),
      ...(setOnce ? { $set_once: setOnce } : {}),
      ...(anonId ? { $anon_distinct_id: anonId } : {}),
    },
  };

  await posthogCapture(identifyEvent);
}

