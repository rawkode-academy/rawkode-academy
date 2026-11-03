export type RecordingPersistencePolicy = "local-only" | "persistent";

export function getRecordingPersistencePolicy(
  streamEnvironment: "prod" | "test" | undefined,
  contentBacked: boolean | undefined,
): RecordingPersistencePolicy {
  // Only an explicit standalone session may bypass the persistent prod path.
  // An absent flag keeps the server's content and lease checks in force.
  return streamEnvironment === "prod" && contentBacked !== false
    ? "persistent"
    : "local-only";
}

export function shouldUseLocalRecordingFallback(status: number | undefined): boolean {
  return status === undefined || status >= 500;
}
