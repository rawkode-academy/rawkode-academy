import { afterEach, describe, expect, it, vi } from "vitest";
import { createPublisherLeaseHeartbeat } from "./publisherLease";

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
} {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

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
    expect(vi.getTimerCount()).toBe(0);
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
    expect(vi.getTimerCount()).toBe(0);
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
    expect(vi.getTimerCount()).toBe(0);
  });

  it("expires a hanging heartbeat independently and ignores its late success", async () => {
    vi.useFakeTimers();
    const pending = deferred();
    const renew = vi.fn(() => pending.promise);
    const onLeaseLost = vi.fn();
    const heartbeat = createPublisherLeaseHeartbeat({
      isLeaseLost: () => false,
      onLeaseLost,
      renew,
    });

    heartbeat.start();
    await vi.advanceTimersByTimeAsync(14_999);
    expect(renew).toHaveBeenCalledOnce();
    expect(onLeaseLost).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onLeaseLost).toHaveBeenCalledOnce();
    expect(onLeaseLost.mock.calls[0]?.[0]).toEqual(
      new Error("Publisher lease expired before a heartbeat was confirmed."),
    );
    expect(vi.getTimerCount()).toBe(0);

    pending.resolve();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(renew).toHaveBeenCalledOnce();
    expect(onLeaseLost).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds an acknowledged lease from request start rather than response arrival", async () => {
    vi.useFakeTimers();
    const first = deferred();
    const second = deferred();
    const renew = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const onLeaseLost = vi.fn();
    const heartbeat = createPublisherLeaseHeartbeat({
      intervalMs: 1_000,
      leaseTimeoutMs: 4_000,
      isLeaseLost: () => false,
      onLeaseLost,
      renew,
    });

    heartbeat.start();
    await vi.advanceTimersByTimeAsync(3_500);
    first.resolve();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(renew).toHaveBeenCalledTimes(2);
    expect(onLeaseLost).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(onLeaseLost).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["success", "failure"] as const)("ignores a stopped generation's late %s after a restart", async (result) => {
    vi.useFakeTimers();
    const pending = deferred();
    const leaseError = new Error("old lease lost");
    const renew = vi.fn()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue(undefined);
    const onLeaseLost = vi.fn();
    const heartbeat = createPublisherLeaseHeartbeat({
      intervalMs: 1_000,
      leaseTimeoutMs: 5_000,
      isLeaseLost: (error) => error === leaseError,
      onLeaseLost,
      renew,
    });

    heartbeat.start();
    await vi.advanceTimersByTimeAsync(1_000);
    heartbeat.stop();
    expect(vi.getTimerCount()).toBe(0);
    heartbeat.start();
    await vi.advanceTimersByTimeAsync(1_000);
    if (result === "success") pending.resolve();
    else pending.reject(leaseError);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(renew).toHaveBeenCalledTimes(3);
    expect(onLeaseLost).not.toHaveBeenCalled();
    heartbeat.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
