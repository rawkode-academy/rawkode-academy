import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onRequest } from "./index.ts";
import { Zitadel } from "@/lib/zitadel/index.ts";
import type { OidcStandardClaims } from "oidc-client-ts";

vi.mock("jose");

describe("Auth Middleware", () => {
  let context: any;
  let next: any;
  let fetchUser: any;

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
    fetchUser = vi.spyOn(Zitadel.prototype, "fetchUser");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("shouldn't use middleware for prerendered pages", async () => {
    await onRequest(context, next);

    expect(fetchUser).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it("should continue if there is no access token in session", async () => {
    context.locals.runtime = true;
    context.cookies.get.mockImplementationOnce(() => {
      return undefined;
    });

    await onRequest(context, next);

    expect(fetchUser).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it("should continue if JWT is valid", async () => {
    context.locals.runtime = true;

    context.cookies.get.mockImplementationOnce(() => {
      return {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        user: "user",
      };
    });

    const expectedUser: OidcStandardClaims = {
      name: "user",
    };

    fetchUser.mockImplementationOnce(() => {
      return expectedUser;
    });

    await onRequest(context, next);

    expect(fetchUser).toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
    expect(context.locals.user).toEqual(expectedUser);
  });
});
