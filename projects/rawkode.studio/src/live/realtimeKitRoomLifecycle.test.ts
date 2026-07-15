import { ref, shallowRef } from "vue";
import { describe, expect, it, vi } from "vitest";
import {
  getRealtimeKitRoomSetupState,
  isRealtimeKitUiJoinedState,
  observeRealtimeKitRoomLifecycle,
  type RealtimeKitRoomLifecycleEventMap,
  type RealtimeKitRoomLifecycleListener,
  type RealtimeKitRoomLifecycleMeeting,
  type RealtimeKitRoomLeftState,
} from "./realtimeKitRoomLifecycle";

type AnyRoomLifecycleEvent =
  RealtimeKitRoomLifecycleEventMap[keyof RealtimeKitRoomLifecycleEventMap];

class RealtimeKitSelfFixture {
  roomJoined = false;
  roomState: "init" | "joined" | "waitlisted" | RealtimeKitRoomLeftState =
    "init";

  private readonly listeners = new Map<
    keyof RealtimeKitRoomLifecycleEventMap,
    Set<(payload: AnyRoomLifecycleEvent) => void>
  >();

  addListener<EventName extends keyof RealtimeKitRoomLifecycleEventMap>(
    event: EventName,
    listener: RealtimeKitRoomLifecycleListener<EventName>,
  ): void {
    const eventListeners = this.listeners.get(event) ?? new Set();
    eventListeners.add(listener as (payload: AnyRoomLifecycleEvent) => void);
    this.listeners.set(event, eventListeners);
  }

  removeListener<EventName extends keyof RealtimeKitRoomLifecycleEventMap>(
    event: EventName,
    listener: RealtimeKitRoomLifecycleListener<EventName>,
  ): void {
    this.listeners
      .get(event)
      ?.delete(listener as (payload: AnyRoomLifecycleEvent) => void);
  }

  emit<EventName extends keyof RealtimeKitRoomLifecycleEventMap>(
    event: EventName,
    payload: RealtimeKitRoomLifecycleEventMap[EventName],
  ): void {
    if (event === "roomJoined") {
      this.roomJoined = true;
      this.roomState = "joined";
    } else {
      this.roomJoined = false;
      this.roomState = (
        payload as RealtimeKitRoomLifecycleEventMap["roomLeft"]
      ).state;
    }
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }
}

describe("RealtimeKit setup-owned room lifecycle", () => {
  it("observes the SDK self room events with their real payloads", () => {
    const self = new RealtimeKitSelfFixture();
    const meeting = { self };
    const onJoined = vi.fn();
    const onLeft = vi.fn();
    const joinedPayload = { reconnected: false };
    const leftPayload = { state: "left" as const };

    expect(getRealtimeKitRoomSetupState(meeting)).toBe("setup");
    const stop = observeRealtimeKitRoomLifecycle(meeting, { onJoined, onLeft });

    self.emit("roomJoined", joinedPayload);
    expect(onJoined).toHaveBeenCalledOnce();
    expect(onJoined).toHaveBeenCalledWith(joinedPayload);
    expect(onLeft).not.toHaveBeenCalled();

    self.emit("roomLeft", leftPayload);
    expect(onLeft).toHaveBeenCalledOnce();
    expect(onLeft).toHaveBeenCalledWith(leftPayload);

    stop();
    self.emit("roomJoined", { reconnected: true });
    expect(onJoined).toHaveBeenCalledOnce();
  });

  it("preserves a proxyable SDK meeting identity for lifecycle guards", () => {
    const self = new RealtimeKitSelfFixture();
    const rawMeeting = { self } satisfies RealtimeKitRoomLifecycleMeeting;
    const deepMeeting = ref<RealtimeKitRoomLifecycleMeeting | null>(rawMeeting);
    const currentMeeting = shallowRef<RealtimeKitRoomLifecycleMeeting | null>(rawMeeting);
    let state: "connected" | "setup" = "setup";

    expect(deepMeeting.value).not.toBe(rawMeeting);
    expect(currentMeeting.value).toBe(rawMeeting);

    observeRealtimeKitRoomLifecycle(rawMeeting, {
      onJoined: () => {
        if (currentMeeting.value === rawMeeting) {
          state = "connected";
        }
      },
      onLeft: () => undefined,
    });
    self.emit("roomJoined", { reconnected: false });

    expect(state).toBe("connected");
  });

  it("recognises meetings already joined before listeners attach", () => {
    expect(getRealtimeKitRoomSetupState({ self: { roomJoined: true } })).toBe(
      "connected",
    );
    expect(
      getRealtimeKitRoomSetupState({
        self: { roomJoined: false, roomState: "joined" },
      }),
    ).toBe("connected");
  });

  it("recognises the public RealtimeKit UI joined state event detail", () => {
    const joinedEvent = new CustomEvent("rtkStatesUpdate", {
      detail: { meeting: "joined" as const },
    });

    expect(joinedEvent.type).toBe("rtkStatesUpdate");
    expect(isRealtimeKitUiJoinedState(joinedEvent)).toBe(true);
    expect(
      isRealtimeKitUiJoinedState({ detail: { meeting: "setup" } }),
    ).toBe(false);
    expect(
      isRealtimeKitUiJoinedState({ detail: { meeting: "ended" } }),
    ).toBe(false);
  });
});
