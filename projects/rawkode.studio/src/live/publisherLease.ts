export interface PublisherLeaseHeartbeat {
  start(): void;
  stop(): void;
}

interface PublisherLeaseHeartbeatOptions {
  intervalMs?: number;
  isLeaseLost(error: unknown): boolean;
  leaseTimeoutMs?: number;
  maxFailures?: number;
  onLeaseLost(error: unknown): Promise<void> | void;
  renew(): Promise<void>;
}

export function createPublisherLeaseHeartbeat(
  options: PublisherLeaseHeartbeatOptions,
): PublisherLeaseHeartbeat {
  const intervalMs = Math.max(1, options.intervalMs ?? 5_000);
  // Leave a margin before the server's 20-second live publisher lease expires.
  const leaseTimeoutMs = Math.max(1, options.leaseTimeoutMs ?? 15_000);
  const maxFailures = Math.max(1, options.maxFailures ?? 3);
  let consecutiveFailures = 0;
  let running = false;
  let generation = 0;
  let expiresAt = 0;
  let renewalTimer: ReturnType<typeof setTimeout> | undefined;
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;

  function clearTimers(): void {
    if (renewalTimer !== undefined) clearTimeout(renewalTimer);
    if (expiryTimer !== undefined) clearTimeout(expiryTimer);
    renewalTimer = undefined;
    expiryTimer = undefined;
  }

  function isCurrent(expectedGeneration: number): boolean {
    return running && generation === expectedGeneration;
  }

  function loseLease(error: unknown, expectedGeneration: number): void {
    if (!isCurrent(expectedGeneration)) return;
    running = false;
    generation += 1;
    clearTimers();
    try {
      void Promise.resolve(options.onLeaseLost(error)).catch((notificationError: unknown) => {
        console.error("Failed to stop publisher after lease loss", notificationError);
      });
    } catch (notificationError) {
      console.error("Failed to stop publisher after lease loss", notificationError);
    }
  }

  function expirationError(): Error {
    return new Error("Publisher lease expired before a heartbeat was confirmed.");
  }

  function expireLease(expectedGeneration: number): void {
    if (!isCurrent(expectedGeneration)) return;
    const remaining = expiresAt - performance.now();
    if (remaining > 0) {
      expiryTimer = setTimeout(() => expireLease(expectedGeneration), remaining);
      return;
    }
    loseLease(expirationError(), expectedGeneration);
  }

  function scheduleExpiry(expectedGeneration: number): void {
    if (expiryTimer !== undefined) clearTimeout(expiryTimer);
    expiryTimer = setTimeout(() => expireLease(expectedGeneration), Math.max(0, expiresAt - performance.now()));
  }

  function scheduleRenewal(expectedGeneration: number): void {
    renewalTimer = setTimeout(() => {
      renewalTimer = undefined;
      void renew(expectedGeneration);
    }, intervalMs);
  }

  async function renew(expectedGeneration: number): Promise<void> {
    if (!isCurrent(expectedGeneration)) return;
    const startedAt = performance.now();
    if (startedAt >= expiresAt) {
      loseLease(expirationError(), expectedGeneration);
      return;
    }

    try {
      await options.renew();
      if (!isCurrent(expectedGeneration)) return;
      // A delayed response cannot extend a lease that may already have expired.
      const confirmedAt = performance.now();
      if (confirmedAt >= expiresAt || confirmedAt >= startedAt + leaseTimeoutMs) {
        loseLease(expirationError(), expectedGeneration);
        return;
      }
      consecutiveFailures = 0;
      expiresAt = startedAt + leaseTimeoutMs;
      scheduleExpiry(expectedGeneration);
    } catch (error) {
      if (!isCurrent(expectedGeneration)) return;
      if (performance.now() >= expiresAt) {
        loseLease(expirationError(), expectedGeneration);
        return;
      }
      consecutiveFailures += 1;
      if (options.isLeaseLost(error) || consecutiveFailures >= maxFailures) {
        loseLease(error, expectedGeneration);
        return;
      }
    }

    if (isCurrent(expectedGeneration)) scheduleRenewal(expectedGeneration);
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      generation += 1;
      consecutiveFailures = 0;
      expiresAt = performance.now() + leaseTimeoutMs;
      // This is a local fail-stop guard: a frozen tab cannot run timers, so the
      // provider must also fence an expired publisher independently.
      scheduleExpiry(generation);
      scheduleRenewal(generation);
    },
    stop(): void {
      running = false;
      generation += 1;
      consecutiveFailures = 0;
      clearTimers();
    },
  };
}
