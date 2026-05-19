import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkMdx from "remark-mdx";
import { remarkTechAutolink } from "@/lib/remark-tech-autolink";

const lookup = new Map<string, string>([
	["kubernetes", "kubernetes"],
	["apko", "apko"],
	["melange", "melange"],
	["kube-vip", "kube-vip"],
	["cert-manager", "cert-manager"],
	["go", "go"], // intentionally in lookup; default skip list excludes it
]);

async function process(source: string): Promise<string> {
	const file = await unified()
		.use(remarkParse)
		.use(remarkMdx)
		.use(remarkTechAutolink({ lookup }))
		.use(remarkStringify)
		.process(source);
	return String(file);
}

describe("remarkTechAutolink", () => {
	it("links the first plain-text mention of a tracked technology", async () => {
		const out = await process(
			"This article is about Kubernetes and how it works.\n",
		);
		expect(out).toContain("[Kubernetes](/technology/kubernetes)");
	});

	it("leaves subsequent mentions of the same technology as plain text", async () => {
		const out = await process(
			"Kubernetes is great. We use Kubernetes everywhere. Kubernetes ships.\n",
		);
		const matches = out.match(/\[Kubernetes\]\(\/technology\/kubernetes\)/g);
		expect(matches?.length).toBe(1);
		// The other two mentions should remain as plain text.
		expect(out).toMatch(/\.\s+We use Kubernetes everywhere/);
	});

	it("preserves the original case of the matched text", async () => {
		const out = await process("kubernetes is lowercased here.\n");
		expect(out).toContain("[kubernetes](/technology/kubernetes)");
	});

	it("supports hyphenated names with custom alnum boundaries", async () => {
		const out = await process(
			"For bare-metal HA, kube-vip is the right tool.\n",
		);
		expect(out).toContain("[kube-vip](/technology/kube-vip)");
	});

	it("does not link inside inline code", async () => {
		const out = await process("Run `apko build` to produce an image.\n");
		expect(out).not.toContain("[apko]");
		expect(out).toContain("`apko build`");
	});

	it("does not link inside fenced code blocks", async () => {
		const out = await process(
			"```sh\napko build config.yaml image.tar\n```\n",
		);
		expect(out).not.toContain("[apko]");
	});

	it("does not link inside headings", async () => {
		const out = await process("## Using apko in production\n\n");
		expect(out).toContain("## Using apko in production");
		expect(out).not.toContain("[apko]");
	});

	it("does not link inside an existing link", async () => {
		const out = await process(
			"See [our Kubernetes guide](https://example.com).\n",
		);
		expect(out).not.toContain("/technology/kubernetes");
		expect(out).toContain("[our Kubernetes guide](https://example.com)");
	});

	it("honors the default skip list (Go is not auto-linked)", async () => {
		const out = await process(
			"This service is written in Go. Go is fast.\n",
		);
		expect(out).not.toContain("/technology/go");
	});

	it("honors the no-autolink HTML comment opt-out", async () => {
		const out = await process(
			"<!-- no-autolink -->\nThis is about Kubernetes and apko.\n",
		);
		expect(out).not.toContain("/technology/");
	});

	it("links across multiple distinct technologies in the same paragraph", async () => {
		const out = await process(
			"apko pairs with melange to build distroless images.\n",
		);
		expect(out).toContain("[apko](/technology/apko)");
		expect(out).toContain("[melange](/technology/melange)");
	});

	it("does not match a tech name as a substring of a longer identifier", async () => {
		const out = await process("My favorite framework is apkoplasty.\n");
		expect(out).not.toContain("/technology/apko");
	});

	it("does not link a tech name flanked by hyphens (compound identifier)", async () => {
		const out = await process(
			"The apko-style approach to images deserves attention.\n",
		);
		expect(out).not.toContain("/technology/apko");
	});

	it("does not link a tech name embedded inside another hyphenated identifier", async () => {
		const out = await process("Try the x-apko-y experiment.\n");
		expect(out).not.toContain("/technology/apko");
	});

	it("respects an explicit per-call skipNames override", async () => {
		const file = await unified()
			.use(remarkParse)
			.use(remarkMdx)
			.use(
				remarkTechAutolink({
					lookup,
					skipNames: ["apko"],
				}),
			)
			.use(remarkStringify)
			.process("Try apko for distroless builds.\n");
		expect(String(file)).not.toContain("/technology/apko");
	});

	it("does not link inside JSX/MDX components", async () => {
		const out = await process(
			'<Note>This Kubernetes tip is inside an MDX component.</Note>\n',
		);
		// The Kubernetes mention inside the JSX should NOT be auto-linked
		// (it would alter the JSX element children unpredictably).
		expect(out).not.toContain("/technology/kubernetes");
	});
});
