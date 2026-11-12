// Vitest stand-in for `astro:env/server` (tests that need values mock it).
export const GRAPHQL_ENDPOINT = "https://api.rawkode.academy/";
export const getSecret = (_name: string): string | undefined => undefined;
