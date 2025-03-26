import * as utf64 from "utf64";

export interface Payload {
  format: "svg" | "png";
	title: string;
	subtitle: string | undefined;
  template: string;
  image: URL | undefined;
}

export const DEFAULT_PAYLOAD: Payload = {
  format: "svg",
	title: "Hello, World!",
	subtitle: "The best way to learn and keep up to date with Cloud Native, Kubernetes, & WebAssembly",
  template: "gradient",
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
			return { ...DEFAULT_PAYLOAD, ...payload };
    } catch (error) {
      return DEFAULT_PAYLOAD;
    }
  }

  return DEFAULT_PAYLOAD;
};
