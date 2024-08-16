import { jwtVerify } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("jose");
vi.mock(
	"./middleware",
	async (importOriginal) => {
		const mod = await importOriginal<
			typeof import("./middleware")
		>();

		return {
			...mod,
			getSessionFromCookie: vi.fn(),
		};
	},
);


describe("onRequest Middleware", () => {
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
		};
		next = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("shouldn't use middleware for prerendered pages", async () => {
		const { onRequest } = await import("./middleware");

		await onRequest(context, next);
		expect(next).toHaveBeenCalledOnce();
	});

	it("should continue if there is no access token in session", async () => {
		context.locals.runtime = true;

		const { onRequest } = await import("./middleware");

		await onRequest(context, next);

		expect(next).toHaveBeenCalledOnce();
	});

	it("should continue if JWT is valid", async () => {
		context.locals.runtime = true;

		const { getSessionFromCookie, onRequest } = await import("./middleware");

		vi.mocked(getSessionFromCookie).mockResolvedValue({
			accessToken: "access-token",
			refreshToken: "refresh-token",
			user: "user",
		});

		vi.mocked(jwtVerify).mockResolvedValue({
			key: new Uint8Array(2), payload: {}, protectedHeader: { alg: "" },
		});

		await onRequest(context, next);

		expect(next).toHaveBeenCalledOnce();
		expect(context.locals.user).toEqual("user");
	});
});
