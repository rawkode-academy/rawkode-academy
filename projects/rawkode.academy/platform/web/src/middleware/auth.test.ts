import { jwtVerify } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionFromCookie } from "../utils/sessionCookie.ts";
import { onRequest } from "./index.ts";

vi.mock("jose");
vi.mock("../utils/sessionCookie.ts");

describe("Auth Middleware", () => {
  let context: any;
  let next: any;

  beforeEach(() => {
    context = {
      locals: {},
      cookies: {
        delete: vi.fn(),
        get: vi.fn(),
        set: vi.fn(),
      },
      redirect: vi.fn(),
      request: {
        url: "https://example.com",
      },
    };
    next = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("shouldn't use middleware for prerendered pages", async () => {
    await onRequest(context, next);

    expect(getSessionFromCookie).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it("should continue if there is no access token in session", async () => {
    context.locals.runtime = true;

    vi.mocked(getSessionFromCookie).mockResolvedValue({});

    await onRequest(context, next);

    expect(getSessionFromCookie).toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it("should continue if JWT is valid", async () => {
    context.locals.runtime = true;

    vi.mocked(getSessionFromCookie).mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: "user",
    });

    vi.mocked(jwtVerify).mockResolvedValue({
      key: new Uint8Array(2),
      payload: {},
      protectedHeader: { alg: "" },
    });

    await onRequest(context, next);

    expect(getSessionFromCookie).toHaveBeenCalled();
    expect(jwtVerify).toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
    expect(context.locals.user).toEqual("user");
  });
});
