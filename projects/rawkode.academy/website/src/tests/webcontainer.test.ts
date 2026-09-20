import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { WebContainer } from "@webcontainer/api";
import WebContainerEmbed from "../components/courses/WebContainerEmbed.vue";
vi.mock("@webcontainer/api", () => ({ WebContainer: { boot: vi.fn() } }));
let wrapper: VueWrapper | undefined;
const pending = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
function container() {
 const exit = pending<number>();
 const instance = { fs: { mkdir: vi.fn().mockResolvedValue(undefined), writeFile: vi.fn().mockResolvedValue(undefined) }, spawn: vi.fn().mockResolvedValue({ output: new ReadableStream({ start(c) { c.close(); } }), exit: exit.promise }), on: vi.fn((_event: string, _callback: (port: number, url: string) => void) => vi.fn()), teardown: vi.fn() };
 return { instance, exit };
}
beforeEach(() => vi.clearAllMocks());
afterEach(() => { wrapper?.unmount(); wrapper = undefined; });
const open = () => { wrapper = mount(WebContainerEmbed, { props: { title: "Demo", files: { "index.js": "hello" } } }); };
describe("WebContainer lifecycle", () => {
 it("tears down a boot that completes after the component closes", async () => {
  const boot = pending<Awaited<ReturnType<typeof WebContainer.boot>>>();
  vi.mocked(WebContainer.boot).mockReturnValue(boot.promise);
  open(); wrapper!.unmount(); wrapper = undefined;
  const { instance } = container(); boot.resolve(instance as unknown as WebContainer);
  await flushPromises(); expect(instance.teardown).toHaveBeenCalledOnce(); expect(instance.spawn).not.toHaveBeenCalled();
 });
 it("shows startup failures and enables retry", async () => {
  const { instance } = container(); instance.spawn.mockRejectedValue(new Error("No start script"));
  vi.mocked(WebContainer.boot).mockResolvedValue(instance as unknown as WebContainer);
  open(); await flushPromises();
  expect(wrapper!.find('[role="alert"]').text()).toContain("Container unavailable");
  expect(wrapper!.get('button[aria-label="Restart container"]').attributes('disabled')).toBeUndefined();
 });
 it("subscribes before spawn and clears the preview when the server exits", async () => {
  const { instance, exit } = container();
  instance.spawn.mockImplementation(async () => {
   const callback = instance.on.mock.calls[0]?.[1] as unknown as (port: number, url: string) => void;
   callback(3000, "https://preview.example.com");
   return { output: new ReadableStream({ start(c) { c.close(); } }), exit: exit.promise };
  });
  vi.mocked(WebContainer.boot).mockResolvedValue(instance as unknown as WebContainer);
  open(); await flushPromises(); expect(wrapper!.find('iframe').exists()).toBe(true);
  exit.resolve(0); await flushPromises();
  expect(wrapper!.find('iframe').exists()).toBe(false); expect(wrapper!.find('[role="alert"]').exists()).toBe(true);
 });
});
