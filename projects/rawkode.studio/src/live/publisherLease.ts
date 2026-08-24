export interface PublisherLeaseHeartbeat {
  start(): void;
  stop(): void;
}

interface PublisherLeaseHeartbeatOptions {
  intervalMs?: number;
  isLeaseLost(error: unknown): boolean;
  maxFailures?: number;
  onLeaseLost(error: unknown): Promise<void> | void;
  renew(): Promise<void>;
}

export function createPublisherLeaseHeartbeat(
  options: PublisherLeaseHeartbeatOptions,
): PublisherLeaseHeartbeat {
  const intervalMs = Math.max(1, options.intervalMs ?? 5_000);
  const maxFailures = Math.max(1, options.maxFailures ?? 3);
  let consecutiveFailures = 0;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function schedule(): void {
    timer = setTimeout(() => {
      timer = undefined;
      void renew();
    }, intervalMs);
  }

  async function renew(): Promise<void> {
    if (!running) return;

    try {
      await options.renew();
      consecutiveFailures = 0;
    } catch (error) {
      consecutiveFailures += 1;
      if (options.isLeaseLost(error) || consecutiveFailures >= maxFailures) {
        running = false;
        await options.onLeaseLost(error);
        return;
      }
    }

    if (running) schedule();
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      consecutiveFailures = 0;
      schedule();
    },
    stop(): void {
      running = false;
      consecutiveFailures = 0;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
  };
}
