/** Prevent asynchronous renders from publishing media removed during a paint. */
export function createFrameCommitGuard() {
  let revision = 0;
  return {
    invalidate(): void { revision += 1; },
    async render(draw: () => Promise<void>, commit: () => void): Promise<boolean> {
      const startedAt = revision;
      await draw();
      if (startedAt !== revision) return false;
      commit();
      return true;
    },
  };
}
