import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAccess: vi.fn(async () => undefined),
  getState: vi.fn(async () => ({ revision: 4, state: { onStageSourceIds: [] } })),
}));
vi.mock("cloudflare:workers", () => ({ env: {} }));
vi.mock("../../../server/control-state", () => ({
  getStudioControlState: mocks.getState,
  requireStudioControlAccess: mocks.requireAccess,
  StudioControlStateError: class extends Error {
    constructor(message: string, public status: number) { super(message); }
  },
}));
import { GET } from "./state";

describe("Studio control-state GET", () => {
  it("does not allow authenticated or error responses to be cached", async () => {
    const url = new URL("https://rawkode.studio/api/studio/state?sessionId=session-1");
    const authorized = await GET({ locals: { user: { id: "operator" } }, url } as never);
    expect(authorized.status).toBe(200);
    expect(authorized.headers.get("cache-control")).toBe("no-store");
    expect(await authorized.json()).toMatchObject({ revision: 4 });

    const unauthorized = await GET({ locals: {}, url } as never);
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get("cache-control")).toBe("no-store");
  });
});
