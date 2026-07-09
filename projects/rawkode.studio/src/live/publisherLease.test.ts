import { afterEach, describe, expect, it, vi } from "vitest";
import { createPublisherLeaseHeartbeat } from "./publisherLease";

afterEach(() => {
  vi.useRealTimers();
});

describe("publisher lease heartbeat", () => {
  it("renews on the configured interval", async () => {
    vi.useFakeTimers();
    const renew = vi.fn(async () => undefined);
    const onLeaseLost = vi.fn();
    const heartbeat = createPublisherLeaseHeartbeat({
      intervalMs: 1_000,
      isLeaseLost: () => false,
      onLeaseLost,
      renew,
    });

    heartbeat.start();
    await vi.advanceTimersByTimeAsync(3_000);

    expect(renew).toHaveBeenCalledTimes(3);
    expect(onLeaseLost).not.toHaveBeenCalled();
    heartbeat.stop();
  });

  it("recovers after transient renewal failures", async () => {
    vi.useFakeTimers();
    const renew = vi.fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(undefined);
    const onLeaseLost = vi.fn();
    const heartbeat = createPublisherLeaseHeartbeat({
      intervalMs: 1_000,
      isLeaseLost: () => false,
      onLeaseLost,
      renew,
    });

    heartbeat.start();
    await vi.advanceTimersByTimeAsync(4_000);

    expect(renew).toHaveBeenCalledTimes(4);
    expect(onLeaseLost).not.toHaveBeenCalled();
    heartbeat.stop();
  });

  it("stops immediately when the server rejects ownership", async () => {
    vi.useFakeTimers();
    const leaseError = new Error("lease lost");
    const renew = vi.fn(async () => Promise.reject(leaseError));
    const onLeaseLost = vi.fn();
    const heartbeat = createPublisherLeaseHeartbeat({
      intervalMs: 1_000,
      isLeaseLost: (error) => error === leaseError,
      onLeaseLost,
      renew,
    });

    heartbeat.start();
    await vi.advanceTimersByTimeAsync(3_000);

    expect(renew).toHaveBeenCalledOnce();
    expect(onLeaseLost).toHaveBeenCalledWith(leaseError);
  });

  it("stops after three consecutive transport failures", async () => {
    vi.useFakeTimers();
    const renew = vi.fn(async () => Promise.reject(new Error("offline")));
    const onLeaseLost = vi.fn();
    const heartbeat = createPublisherLeaseHeartbeat({
      intervalMs: 1_000,
      isLeaseLost: () => false,
      onLeaseLost,
      renew,
    });

    heartbeat.start();
    await vi.advanceTimersByTimeAsync(4_000);

    expect(renew).toHaveBeenCalledTimes(3);
    expect(onLeaseLost).toHaveBeenCalledOnce();
  });
});
