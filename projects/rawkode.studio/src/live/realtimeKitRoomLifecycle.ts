export interface RealtimeKitRoomLifecycleMeeting {
  self?: {
    addListener?(event: "roomJoined" | "roomLeft", listener: () => void): void;
    removeListener?(event: "roomJoined" | "roomLeft", listener: () => void): void;
    roomJoined?: boolean;
  };
}

interface RealtimeKitRoomLifecycleHandlers {
  onJoined(): void;
  onLeft(): void;
}

export function getRealtimeKitRoomSetupState(
  meeting: RealtimeKitRoomLifecycleMeeting,
): "connected" | "setup" {
  return meeting.self?.roomJoined === true ? "connected" : "setup";
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
