export interface RealtimeKitRoomJoinedEvent {
  reconnected: boolean;
}

export type RealtimeKitRoomLeftState =
  | "connected-meeting"
  | "disconnected"
  | "ended"
  | "failed"
  | "kicked"
  | "left"
  | "rejected"
  | "stageLeft";

export interface RealtimeKitRoomLeftEvent {
  state: RealtimeKitRoomLeftState;
}

export interface RealtimeKitRoomLifecycleEventMap {
  roomJoined: RealtimeKitRoomJoinedEvent;
  roomLeft: RealtimeKitRoomLeftEvent;
}

export type RealtimeKitRoomLifecycleListener<
  EventName extends keyof RealtimeKitRoomLifecycleEventMap,
> = (payload: RealtimeKitRoomLifecycleEventMap[EventName]) => void;

export interface RealtimeKitRoomLifecycleMeeting {
  self?: {
    addListener?<EventName extends keyof RealtimeKitRoomLifecycleEventMap>(
      event: EventName,
      listener: RealtimeKitRoomLifecycleListener<EventName>,
    ): void;
    removeListener?<EventName extends keyof RealtimeKitRoomLifecycleEventMap>(
      event: EventName,
      listener: RealtimeKitRoomLifecycleListener<EventName>,
    ): void;
    roomJoined?: boolean;
    roomState?: "init" | "joined" | "waitlisted" | RealtimeKitRoomLeftState;
  };
}

interface RealtimeKitRoomLifecycleHandlers {
  onJoined(payload: RealtimeKitRoomJoinedEvent): void;
  onLeft(payload: RealtimeKitRoomLeftEvent): void;
}

export interface RealtimeKitUiStatesUpdateEvent {
  detail?: {
    meeting?: "ended" | "idle" | "joined" | "setup" | "waiting";
  };
}

export function getRealtimeKitRoomSetupState(
  meeting: RealtimeKitRoomLifecycleMeeting,
): "connected" | "setup" {
  return meeting.self?.roomJoined === true || meeting.self?.roomState === "joined"
    ? "connected"
    : "setup";
}

export function isRealtimeKitUiJoinedState(
  event: RealtimeKitUiStatesUpdateEvent,
): boolean {
  return event.detail?.meeting === "joined";
}

export function observeRealtimeKitRoomLifecycle(
  meeting: RealtimeKitRoomLifecycleMeeting,
  handlers: RealtimeKitRoomLifecycleHandlers,
): () => void {
  const self = meeting.self;
  if (!self?.addListener) {
    return () => undefined;
  }

  self.addListener("roomJoined", handlers.onJoined);
  self.addListener("roomLeft", handlers.onLeft);
  return () => {
    self.removeListener?.("roomJoined", handlers.onJoined);
    self.removeListener?.("roomLeft", handlers.onLeft);
  };
}
