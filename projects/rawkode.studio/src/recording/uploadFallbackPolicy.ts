export type RecordingPersistencePolicy = "local-only" | "persistent";

export function getRecordingPersistencePolicy(
  streamEnvironment: "prod" | "test" | undefined,
): RecordingPersistencePolicy {
  return streamEnvironment === "prod" ? "persistent" : "local-only";
}

export function shouldUseLocalRecordingFallback(status: number | undefined): boolean {
  return status === undefined || status >= 500;
}
