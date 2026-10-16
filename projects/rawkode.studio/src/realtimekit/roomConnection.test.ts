import { describe, expect, it } from "vitest";
import { getRealtimeKitRoomStatus } from "./roomConnection";

describe("RealtimeKit room status", () => {
  it("keeps a guest in device setup until the SDK reports roomJoined", () => {
    expect(getRealtimeKitRoomStatus("setup", "guest")).toEqual({
      label: "Guest device check open",
      instructions: "Choose your camera and microphone in the panel, then use its Join control.",
    });
  });

  it("does not treat joining the room as producer admission to the programme", () => {
    expect(getRealtimeKitRoomStatus("joined", "guest")).toEqual({
      label: "Joined contributor room",
      instructions: "Your room connection is active. The producer still controls whether a source is on air.",
    });
  });
});
