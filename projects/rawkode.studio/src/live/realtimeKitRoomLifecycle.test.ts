import { describe, expect, it, vi } from "vitest";
import {
  getRealtimeKitRoomSetupState,
  observeRealtimeKitRoomLifecycle,
} from "./realtimeKitRoomLifecycle";

describe("RealtimeKit setup-owned room lifecycle", () => {
  it("stays in setup until the UI emits roomJoined", () => {
    const listeners = new Map<string, Set<() => void>>();
    const meeting = {
      self: {
        roomJoined: false,
        addListener(event: string, listener: () => void) {
          const eventListeners = listeners.get(event) ?? new Set();
          eventListeners.add(listener);
          listeners.set(event, eventListeners);
        },
        removeListener(event: string, listener: () => void) {
          listeners.get(event)?.delete(listener);
        },
      },
    };
    const onJoined = vi.fn();
    const onLeft = vi.fn();

    expect(getRealtimeKitRoomSetupState(meeting)).toBe("setup");
    const stop = observeRealtimeKitRoomLifecycle(meeting, { onJoined, onLeft });
    expect(onJoined).not.toHaveBeenCalled();

    listeners.get("roomJoined")?.forEach((listener) => listener());
    expect(onJoined).toHaveBeenCalledOnce();
    expect(onLeft).not.toHaveBeenCalled();

    listeners.get("roomLeft")?.forEach((listener) => listener());
    expect(onLeft).toHaveBeenCalledOnce();

    stop();
    listeners.get("roomJoined")?.forEach((listener) => listener());
    expect(onJoined).toHaveBeenCalledOnce();
  });

  it("recognises a meeting already joined by the setup UI", () => {
    expect(getRealtimeKitRoomSetupState({ self: { roomJoined: true } })).toBe(
      "connected",
    );
  });
});
