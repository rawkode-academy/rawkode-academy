export interface Payload {
  format: "png";
  title: string;
  subtitle: string | undefined;
  text: string | undefined;
  template: string;
  image: URL | undefined;
}

export const TEMPLATE_VERSION = "2026-05-24-1";
export const CACHE_SECONDS = 60 * 60 * 24 * 3;

export const DEFAULT_PAYLOAD: Payload = {
  format: "png",
  title: "Hello, World!",
  subtitle:
    "The best way to learn and keep up to date with Cloud Native, Kubernetes, & WebAssembly",
  text: undefined,
  template: "gradient",
  image: undefined,
};

type PayloadInput = Partial<
  Omit<Payload, "image" | "format"> & {
    format: unknown;
    image: string | URL | undefined;
  }
>;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export class PayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayloadError";
  }
}

const encodeBytes = (bytes: Uint8Array): string => {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
};

const decodeBytes = (encoded: string): Uint8Array => {
  const padded = encoded
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(encoded.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
};

const textOrDefault = (
  value: unknown,
  fallback: string | undefined,
): string | undefined => {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const imageUrlOrDefault = (value: unknown): URL | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value instanceof URL) {
    return value;
  }

  if (typeof value !== "string") {
    throw new PayloadError("image must be a URL string");
  }

  try {
    return new URL(value);
  } catch {
    throw new PayloadError("image must be an absolute URL");
  }
};

export const normalizePayload = (input: PayloadInput = {}): Payload => ({
  format: "png",
  title: textOrDefault(input.title, DEFAULT_PAYLOAD.title) ??
    DEFAULT_PAYLOAD.title,
  subtitle: textOrDefault(input.subtitle, DEFAULT_PAYLOAD.subtitle),
  text: textOrDefault(input.text, DEFAULT_PAYLOAD.text),
  template: textOrDefault(input.template, DEFAULT_PAYLOAD.template) ??
    DEFAULT_PAYLOAD.template,
  image: imageUrlOrDefault(input.image),
});

export const canonicalPayloadJson = (payload: Payload): string =>
  JSON.stringify({
    format: payload.format,
    image: payload.image?.href,
    subtitle: payload.subtitle,
    template: payload.template,
    text: payload.text,
    title: payload.title,
  });

export const encodePayload = (payload: Payload): string =>
  encodeBytes(textEncoder.encode(canonicalPayloadJson(payload)));

export const decodePayload = (encoded: string): Payload => {
  try {
    const json = textDecoder.decode(decodeBytes(encoded));
    return normalizePayload(JSON.parse(json));
  } catch (error) {
    if (error instanceof PayloadError) {
      throw error;
    }

    throw new PayloadError("payload must be base64url encoded JSON");
  }
};

export const payloadFromSearchParams = (
  searchParams: URLSearchParams,
): Payload => {
  const payloadFromSearchParams = searchParams.get("payload");

  if (payloadFromSearchParams !== null) {
    return decodePayload(payloadFromSearchParams);
  }

  return DEFAULT_PAYLOAD;
};

export const payloadFromRequest = async (
  request: Request,
): Promise<Payload> => {
  if (request.method === "GET") {
    return payloadFromSearchParams(new URL(request.url).searchParams);
  }

  if (request.method !== "POST") {
    throw new PayloadError("method must be GET or POST");
  }

  const contentType = request.headers.get("Content-Type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new PayloadError("POST /image requires application/json");
  }

  try {
    return normalizePayload(await request.json());
  } catch (error) {
    if (error instanceof PayloadError) {
      throw error;
    }

    throw new PayloadError("request body must be JSON");
  }
};
