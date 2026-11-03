import type { StudioSource } from "../types";

export interface LocalSourceIdentity {
  ownerId: string;
  cameraSourceId: string;
}

export function createLocalSourceIdentity(
  createId: () => string = () => crypto.randomUUID(),
): LocalSourceIdentity {
  const ownerId = createId();
  return { ownerId, cameraSourceId: `source-producer-camera-${ownerId}` };
}

export function getOwnedLocalSourceIds(
  identity: LocalSourceIdentity,
  screenSources: readonly StudioSource[],
): string[] {
  return [...new Set([
    identity.cameraSourceId,
    ...screenSources
      .filter((source) => source.type === "screen" &&
        source.settings?.runtimeSource === "local" &&
        source.settings.runtimeOwnerId === identity.ownerId)
      .map((source) => source.id),
  ])];
}

export function shouldPersistOwnedSourceCleanup(
  pageTransition?: { persisted?: boolean },
): boolean {
  return pageTransition?.persisted !== true;
}
