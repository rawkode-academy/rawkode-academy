export function shouldPersistOwnedScreenCleanup(
  pageTransition?: { persisted?: boolean },
): boolean {
  return pageTransition?.persisted !== true;
}
