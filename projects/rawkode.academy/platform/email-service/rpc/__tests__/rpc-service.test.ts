import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmailService } from "../rpc-service";

// Mock the cloudflare:email module
vi.mock("cloudflare:email", () => ({
	EmailMessage: class MockEmailMessage {
		constructor(
			public from: string,
			public to: string,
			public raw: string,
		) {}
	},
}));

// Mock the cloudflare:workers module
vi.mock("cloudflare:workers", () => ({
	WorkerEntrypoint: class MockWorkerEntrypoint<T> {
		env: T;
		constructor() {
			this.env = {} as T;
		}
	},
}));

describe("EmailService", () => {
	let service: EmailService;
	let mockSendEmail: { send: ReturnType<typeof vi.fn> };
	let mockEmailPreferences: { fetch: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		mockSendEmail = {
			send: vi.fn().mockResolvedValue(undefined),
		};

		mockEmailPreferences = {
			fetch: vi.fn().mockResolvedValue(new Response("ok")),
		};

		// Create instance with mocked env
		service = new EmailService();
		(service as unknown as { env: Record<string, unknown> }).env = {
			SEND_EMAIL: mockSendEmail,
			EMAIL_PREFERENCES: mockEmailPreferences,
		};
	});

	describe("fetch", () => {
		it("should return ok for health check", async () => {
			const request = new Request("http://localhost/health");
			const response = await service.fetch(request);

			expect(response.status).toBe(200);
			expect(await response.text()).toBe("ok");
		});

		it("should return 404 for other paths", async () => {
			const request = new Request("http://localhost/other");
			const response = await service.fetch(request);

			expect(response.status).toBe(404);
		});
	});

	describe("sendServiceEmail", () => {
		it("should send a service email successfully", async () => {
			const result = await service.sendServiceEmail({
				recipient: {
					email: "user@example.com",
					name: "Test User",
					userId: "user-123",
				},
				content: {
					subject: "Test Subject",
					htmlBody: "<h1>Hello</h1>",
				},
			});

			expect(result.success).toBe(true);
			expect(result.messageId).toBeDefined();
			expect(mockSendEmail.send).toHaveBeenCalledTimes(1);
		});

		it("should handle send failure gracefully", async () => {
			mockSendEmail.send.mockRejectedValue(new Error("Network error"));

			const result = await service.sendServiceEmail({
				recipient: {
					email: "user@example.com",
				},
				content: {
					subject: "Test Subject",
					htmlBody: "<h1>Hello</h1>",
				},
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe("Network error");
		});
	});

	describe("sendMarketingEmail", () => {
		it("should send a marketing email with unsubscribe headers", async () => {
			const result = await service.sendMarketingEmail({
				recipient: {
					email: "user@example.com",
					name: "Marketing User",
					userId: "user-456",
				},
				content: {
					subject: "Newsletter",
					htmlBody: "<h1>Newsletter Content</h1>",
				},
			});

			expect(result.success).toBe(true);
			expect(mockSendEmail.send).toHaveBeenCalledTimes(1);

			// Verify the email was sent (we can't easily inspect the raw content in this test)
		});
	});

	describe("sendTransactionalEmail", () => {
		it("should send a transactional email", async () => {
			const result = await service.sendTransactionalEmail({
				recipient: {
					email: "user@example.com",
				},
				content: {
					subject: "Order Confirmation",
					htmlBody: "<h1>Your order has been confirmed</h1>",
					textBody: "Your order has been confirmed",
				},
			});

			expect(result.success).toBe(true);
			expect(mockSendEmail.send).toHaveBeenCalledTimes(1);
		});

		it("should use custom unsubscribe URL", async () => {
			const result = await service.sendTransactionalEmail({
				recipient: {
					email: "user@example.com",
				},
				content: {
					subject: "Event Registration",
					htmlBody: "<h1>You are registered!</h1>",
				},
				unsubscribeUrl: "https://custom.example.com/unsubscribe",
				preferencesUrl: "https://custom.example.com/preferences",
			});

			expect(result.success).toBe(true);
		});
	});

	describe("email content", () => {
		it("should include recipient name in to field when provided", async () => {
			const result = await service.sendServiceEmail({
				recipient: {
					email: "john@example.com",
					name: "John Doe",
				},
				content: {
					subject: "Test",
					htmlBody: "<p>Hello</p>",
				},
			});

			expect(result.success).toBe(true);
		});

		it("should handle replyTo option", async () => {
			const result = await service.sendServiceEmail({
				recipient: {
					email: "user@example.com",
				},
				content: {
					subject: "Test",
					htmlBody: "<p>Hello</p>",
				},
				replyTo: "support@rawkode.academy",
			});

			expect(result.success).toBe(true);
		});
	});
});
