// @ts-nocheck
import { describe, expect, it, mock, beforeEach } from "bun:test";
import { fetchRandomVideos } from "./steps";

describe("fetchRandomVideos", () => {
  beforeEach(() => {
    // Reset mocks before each test
    mock.restore();
  });

  it("should fetch random videos from GraphQL API", async () => {
    globalThis.fetch = mock(async (url: string, options?: RequestInit) => {
      if (url === "https://api.rawkode.academy/graphql") {
        const requestBody = JSON.parse(options?.body as string);
        if (requestBody.query.includes("getRandomVideos")) {
          return new Response(JSON.stringify({
            data: {
              getRandomVideos: [
                {
                  title: "Test Video",
                  description: "This is a test video",
                  duration: 120,
                  publishedAt: "2023-01-01",
                  thumbnailUrl: "https://example.com/thumbnail.jpg",
                  chapters: [{ title: "Chapter 1" }],
                  technologies: [{ name: "TypeScript" }]
                }
              ]
            }
          }));
        }
      }
      return new Response(null, { status: 404 });
    });

    const videos = await fetchRandomVideos();

    expect(videos).toBeArray();
    expect(videos[0]).toMatchObject({
      title: "Test Video",
      description: "This is a test video",
      duration: 120,
      publishedAt: "2023-01-01",
      thumbnailUrl: "https://example.com/thumbnail.jpg"
    });
    expect(videos[0].chapters[0].title).toBe("Chapter 1");
    expect(videos[0].technologies[0].name).toBe("TypeScript");
  });

  it("should throw error when API request fails", async () => {
    // Mock fetch to return error response
    globalThis.fetch = mock(() => Promise.resolve(new Response(null, { status: 500 })));

    await expect(fetchRandomVideos()).rejects.toThrow("GraphQL API failed with status 500");
  });

  it("should handle network timeouts", async () => {
    // Mock fetch to simulate network timeout
    globalThis.fetch = mock(() => new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Network timeout")), 100)
    ));

    await expect(fetchRandomVideos()).rejects.toThrow("Network timeout");
  });

  it("should validate response schema", async () => {
    // Mock fetch to return malformed response
    globalThis.fetch = mock(() => new Response(JSON.stringify({
      data: {
        getRandomVideos: [
          {
            // Missing required fields
            title: "Invalid Video"
          }
        ]
      }
    })));

    try {
      await fetchRandomVideos();
      // Should not reach here
      expect(true).toBe(false);
    } catch (e) {
      // Zod validation errors include "Required" in the message
      expect(e.message).toContain("Required");
    }
  });
});
