import type { StudioSource } from "../types";

export function selectProgrammeAudioStreams(
  streams: ReadonlyMap<string, MediaStream>,
  sources: readonly StudioSource[],
  activeScreenShareSourceId: string,
): Map<string, MediaStream> {
  const selected = new Map<string, MediaStream>();
  const sourcesById = new Map(sources.map((source) => [source.id, source]));

  for (const [sourceId, stream] of streams) {
    const source = sourcesById.get(sourceId);
    if (
      source?.type === "camera" ||
      (source?.type === "screen" && sourceId === activeScreenShareSourceId)
    ) {
      selected.set(sourceId, stream);
    }
  }

  return selected;
}
