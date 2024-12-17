import * as utf64 from "utf64";

export interface Payload {
  format: "svg" | "png";
  text: string;
  template: string;
  image: URL | undefined;
}

export const DEFAULT_PAYLOAD: Payload = {
  format: "svg",
  text: "Hello, World!",
  template: "default",
  image: undefined,
};

// Use https://github.com/more-please/more-stuff/tree/main/utf64 to decode the string
export const getPayloadFromSearchParams = (
  searchParams: URLSearchParams,
): Payload => {
  const payloadFromSearchParams = searchParams.get("payload");

  if (payloadFromSearchParams !== null) {
    const decodedPayload = utf64.decode(payloadFromSearchParams);

    try {
      const payload: Partial<Payload> = JSON.parse(decodedPayload);

      return {
        format: payload.format ?? "svg",
        text: payload.text ?? "Hello, World!",
        template: payload.template ?? "default",
        image: payload.image ? new URL(payload.image) : undefined,
      };
    } catch (error) {
      return DEFAULT_PAYLOAD;
    }
  }

  return DEFAULT_PAYLOAD;
};
