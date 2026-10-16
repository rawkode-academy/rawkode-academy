/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../App.vue", import.meta.url), "utf8");
const canvasSource = readFileSync(
  new URL("../components/StudioCanvas.vue", import.meta.url),
  "utf8",
);
const machineSource = readFileSync(
  new URL("./useStudioMachine.ts", import.meta.url),
  "utf8",
);

describe("Studio operator status wiring", () => {
  it("keeps discarded-edit conflicts visible until the operator dismisses them", () => {
    const sendStart = machineSource.indexOf("function send(");
    const acknowledgeStart = machineSource.indexOf("function acknowledgeConflict(");
    const sendSource = machineSource.slice(sendStart, acknowledgeStart);

    expect(sendStart).toBeGreaterThan(-1);
    expect(acknowledgeStart).toBeGreaterThan(sendStart);
    expect(sendSource).not.toContain('syncConflictNotice.value = ""');
    expect(appSource).toContain('v-if="syncConflictNotice"');
    expect(appSource).toContain('syncError !== syncConflictNotice');
    expect(appSource).toContain('@click="acknowledgeConflict"');
  });

  it("promotes live recording and stream transitions into the top bar", () => {
    expect(canvasSource).toContain('"recording-status-change": [status: string]');
    expect(canvasSource).toContain('"stream-status-change": [status: string]');
    expect(appSource).toContain('@recording-status-change="setRecordingStatus"');
    expect(appSource).toContain('@stream-status-change="setStreamStatus"');
    expect(appSource).toContain("{{ currentRecordingStatus }}");
    expect(appSource).toContain("{{ currentStreamStatus }}");
  });
});
