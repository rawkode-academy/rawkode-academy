import { afterEach, describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import ReviewApp from "../components/ReviewApp.vue";
import ReviewPanel from "../components/ReviewPanel.vue";
import StaffUploadPanel from "../components/StaffUploadPanel.vue";
import type { Review } from "../types";
const cut = "00000000-0000-4000-8000-000000000001";
function review(): Review { return { videoId: 10, viewerId: 2, canApprove: true, publicationAvailable: true, currentRevisionId: cut, revisions: [{ id: cut, reviewVersion: 3, durationMs: 60000, state: "ready", createdAt: "2026-10-05", mediaUrl: `/api/review/media?videoId=10&revisionId=${cut}`, metadata: { title: "Customer video", description: "Private cut" } }], comments: [], decisions: [] }; }
const wrappers: ReturnType<typeof mount>[] = [];
afterEach(() => { for (const wrapper of wrappers.splice(0)) wrapper.unmount(); vi.unstubAllGlobals(); });
const user = { id: 2, role: "customer" as const, name: "Reviewer" };
const button = (wrapper: ReturnType<typeof mount>, text: string) => wrapper.findAll("button").find(item => item.text() === text)!;

describe("review actions", () => {
  it("renders comment bodies as text and allows only own resolution controls", () => {
    const value = review(); value.comments = [{ id: "c", revisionId: cut, authorId: 3, startMs: 1000, endMs: null, body: '<img src=x onerror="alert(1)">', resolved: 0, resolvedAt: null }];
    const wrapper = mount(ReviewPanel, { props: { review: value, user } }); wrappers.push(wrapper);
    expect(wrapper.find(".comment-body").text()).toBe(value.comments[0]!.body);
    expect(wrapper.find(".comment-body img").exists()).toBe(false);
    expect(button(wrapper, "Resolve comment")).toBeUndefined();
  });
  it("requires confirmation and sends approval for the exact version with a command UUID", async () => {
    const value = review(); const fetch = vi.fn(async (_url: string, _init?: RequestInit) => Response.json(value)); vi.stubGlobal("fetch", fetch);
    const wrapper = mount(ReviewPanel, { props: { review: value, user } }); wrappers.push(wrapper);
    await button(wrapper, "Approve this revision").trigger("click"); expect(fetch).not.toHaveBeenCalled();
    await button(wrapper, "Confirm approval").trigger("click"); await flushPromises();
    const command = JSON.parse(String(fetch.mock.calls[0]![1]?.body));
    expect(command).toMatchObject({ action: "decide", videoId: 10, revisionId: cut, expectedReviewVersion: 3, decision: "approved" });
    expect(command.commandId).toMatch(/^[a-f0-9-]{36}$/);
  });
  it("refetches a stale revision and requires a new decision after 409", async () => {
    const value = review(); const fresh = review(); fresh.revisions[0]!.reviewVersion = 4;
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ error: "Changed" }, { status: 409 })).mockResolvedValueOnce(Response.json(fresh)); vi.stubGlobal("fetch", fetch);
    const wrapper = mount(ReviewPanel, { props: { review: value, user } }); wrappers.push(wrapper);
    await button(wrapper, "Approve this revision").trigger("click"); await button(wrapper, "Confirm approval").trigger("click"); await flushPromises();
    expect(wrapper.emitted("updated")?.[0]?.[0]).toEqual(fresh);
    expect(wrapper.text()).toContain("This review changed");
    expect(button(wrapper, "Confirm approval")).toBeUndefined();
    expect(fetch.mock.calls[1]![0]).toBe("/api/review?videoId=10");
  });
  it("retries an ambiguous result with the same command ID and body", async () => {
    const value = review(); const fetch = vi.fn().mockRejectedValueOnce(new TypeError("Network lost")).mockResolvedValueOnce(Response.json({ ok: true })).mockResolvedValueOnce(Response.json(value)); vi.stubGlobal("fetch", fetch);
    const wrapper = mount(ReviewPanel, { props: { review: value, user } }); wrappers.push(wrapper);
    await wrapper.find("#comment-body").setValue("Fix this frame"); await wrapper.find("form").trigger("submit"); await flushPromises();
    await button(wrapper, "Retry last action").trigger("click"); await flushPromises();
    expect(fetch.mock.calls[0]![1].body).toBe(fetch.mock.calls[1]![1].body);
  });
  it("shows the remote publication gate and never lets a customer publish", () => {
    const value = review(); value.revisions[0]!.state = "approved"; value.publicationAvailable = false;
    const wrapper = mount(ReviewPanel, { props: { review: value, user: { id: 1, role: "staff" } } }); wrappers.push(wrapper);
    expect(wrapper.text()).toContain("trusted media verification");
    expect(button(wrapper, "Publish approved revision").attributes("disabled")).toBeDefined();
    const customer = mount(ReviewPanel, { props: { review: value, user } }); wrappers.push(customer);
    expect(button(customer, "Publish approved revision")).toBeUndefined();
    expect(button(customer, "Approve this revision")).toBeUndefined();
  });
});

describe("staff upload intake", () => {
  it("reuses the begin command and session after processing fails", async () => {
    sessionStorage.clear();
    const source = new File(["fixture"], "cut.mp4", { type: "video/mp4" });
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/review/upload-targets")) return Response.json({ videos: [{ videoId: 10, legacyId: "one", slug: "one", title: "One", description: "Description", reviewState: "no-review" }] });
      if (url.startsWith("/api/review/reviewers")) return Response.json({ reviewers: [{ userId: 2, name: "Customer", profileEmail: "customer@example.invalid" }] });
      if (url.startsWith("/api/review/uploads?") && !init?.method) return Response.json({ sessionId: "session", state: "uploaded", expiresAt: 9999999999, processingAvailable: true });
      if (url.startsWith("/api/review/uploads?") && init?.method === "PUT") return Response.json({ state: "uploaded" });
      if (url === "/api/review/uploads" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { action: string; commandId?: string };
        if (body.action === "begin") return Response.json({ sessionId: "session" });
        return Response.json({ error: "provider unavailable" }, { status: 503 });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetch);
    const wrapper = mount(StaffUploadPanel); wrappers.push(wrapper); await flushPromises();
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [source] }); await wrapper.find('input[type="file"]').trigger("change");
    await button(wrapper, "Upload and assign review").trigger("click"); await flushPromises();
    await button(wrapper, "Resume upload and assign review").trigger("click"); await flushPromises();
    const begins = fetch.mock.calls.filter(([url, init]) => url === "/api/review/uploads" && init?.method === "POST" && JSON.parse(String(init.body)).action === "begin");
    expect(begins).toHaveLength(1);
    expect(wrapper.text()).toContain("Media processing is not enabled in this preview yet.");
    sessionStorage.clear();
  });
});


describe("session and navigation response ordering", () => {
  function deferred() {
    let resolve!: (value: Response) => void;
    const promise = new Promise<Response>(done => { resolve = done; });
    return { promise, resolve };
  }
  const listing = { items: [{ videoId: 10, title: "Private title", state: "ready", revisionId: cut, reviewVersion: 3 }], nextCursor: null };
  it("does not restore private list data when a pending startup response arrives after sign-out", async () => {
    window.history.replaceState(null, "", "/review");
    const pending = deferred();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url === "/api/auth/session" ? Response.json({ user }) : url === "/api/auth/logout" ? Response.json({ signedOut: true }) : pending.promise));
    const wrapper = mount(ReviewApp); wrappers.push(wrapper); await flushPromises();
    await button(wrapper, "Sign out").trigger("click"); await flushPromises();
    pending.resolve(Response.json(listing)); await flushPromises();
    expect(wrapper.text()).not.toContain("Private title"); expect(button(wrapper, "Sign out")).toBeUndefined();
    expect(wrapper.text()).toContain("Sign in with Academy");
  });
  it("ignores a pending session revalidation after sign-out", async () => {
    window.history.replaceState(null, "", "/review");
    const pending = deferred(); let sessions = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url === "/api/auth/session" ? ++sessions === 1 ? Response.json({ user }) : pending.promise : url === "/api/auth/logout" ? Response.json({ signedOut: true }) : Response.json(listing)));
    const wrapper = mount(ReviewApp); wrappers.push(wrapper); await flushPromises();
    window.dispatchEvent(new Event("focus")); await flushPromises();
    await button(wrapper, "Sign out").trigger("click"); await flushPromises();
    pending.resolve(Response.json({ user })); await flushPromises();
    expect(wrapper.text()).not.toContain("Private title"); expect(button(wrapper, "Sign out")).toBeUndefined();
  });
  it("clears the previous principal before the next principal's list arrives", async () => {
    window.history.replaceState(null, "", "/review");
    const pending = deferred(); let sessions = 0, lists = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url === "/api/auth/session" ? Response.json({ user: ++sessions === 1 ? user : { id: 3, name: "Other client", role: "customer" } }) : ++lists === 1 ? Response.json(listing) : pending.promise));
    const wrapper = mount(ReviewApp); wrappers.push(wrapper); await flushPromises();
    expect(wrapper.text()).toContain("Private title");
    window.dispatchEvent(new Event("focus")); await flushPromises();
    expect(wrapper.text()).not.toContain("Private title");
    pending.resolve(Response.json({ items: [], nextCursor: null })); await flushPromises();
    expect(wrapper.text()).toContain("Other client");
  });
  it("clears the selected review on back navigation and preserves the latest deep link for sign-in", async () => {
    window.history.replaceState(null, "", "/review?videoId=10");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url === "/api/auth/session" ? Response.json({ user }) : url.includes("videoId=") ? Response.json(review()) : Response.json(listing)));
    const wrapper = mount(ReviewApp); wrappers.push(wrapper); await flushPromises();
    expect(wrapper.find("video").exists()).toBe(true);
    window.history.replaceState(null, "", "/review"); window.dispatchEvent(new Event("popstate")); await flushPromises();
    expect(wrapper.find("video").exists()).toBe(false);
    await wrapper.find(".review-video-list button").trigger("click"); await flushPromises();
    await button(wrapper, "Sign out").trigger("click"); await flushPromises();
    expect(wrapper.find('a[href^="/api/auth/login"]').attributes("href")).toContain(encodeURIComponent("/review?videoId=10"));
  });
  it("explains a granted video that has no revision yet", () => {
    const value = review(); value.currentRevisionId = null; value.revisions = [];
    const wrapper = mount(ReviewPanel, { props: { review: value, user } }); wrappers.push(wrapper);
    expect(wrapper.text()).toContain("No revision ready yet");
  });
});
