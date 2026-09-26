import type { StudioState } from "../types";

export interface StudioControlStateResponse {
  error?: string;
  revision: number;
  state: StudioState | null;
  updatedAt: number | null;
  updatedBy: string | null;
}

export interface StudioControlStateConflict {
  changeSerial: number;
  error: string;
  revision: number;
  savedSerial: number;
  state: StudioState;
}

export type StudioControlSaveOutcome = "conflict" | "error" | "saved";

export function resolveStudioControlStateConflict(
  remote: StudioControlStateResponse,
  changeSerial: number,
): StudioControlStateConflict {
  if (!remote.state) {
    throw new Error("Studio state conflict did not include the authoritative programme.");
  }

  const authoritativeSerial = changeSerial + 1;
  const reason = remote.error ?? "Another producer changed the programme.";
  return {
    changeSerial: authoritativeSerial,
    error: `${reason} Local changes were discarded.`,
    revision: remote.revision,
    savedSerial: authoritativeSerial,
    state: remote.state,
  };
}

export function shouldFlushStudioControlStateAfterSave(
  outcome: StudioControlSaveOutcome,
  changeSerial: number,
  savedSerial: number,
): boolean {
  return outcome === "saved" && changeSerial !== savedSerial;
}
