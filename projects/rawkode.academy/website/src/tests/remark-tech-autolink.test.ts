import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkMdx from "remark-mdx";
import {
	remarkTechAutolink,
	type AutolinkOptions,
} from "@/lib/remark-tech-autolink";

type TestAutolinkOptions = Omit<AutolinkOptions, "lookup">;

const lookup = new Map<string, string>([
	["kubernetes", "kubernetes"],
	["apko", "apko"],
	["melange", "melange"],
	["kube-vip", "kube-vip"],
	["cert-manager", "cert-manager"],
	["go", "go"],
]);

function createProcessor(options: TestAutolinkOptions = {}) {
	return unified()
		.use(remarkParse)
		.use(remarkMdx)
		.use(remarkTechAutolink({ lookup, ...options }))
		.use(remarkStringify);
}

async function processSource(
	source: string,
	options?: TestAutolinkOptions,
): Promise<string> {
	const file = await createProcessor(options).process(source);
	return String(file);
}

async function processFile(value: string, path: string): Promise<string> {
	const file = await createProcessor().process({ value, path });
	return String(file);
}

const expectNoTechnologyLink = (output: string): void => {
	expect(output).not.toContain("/technology/");
};

describe("remarkTechAutolink text matching", () => {
	it("links the first plain-text mention of a tracked technology", async () => {
		const out = await processSource(
			"This article is about Kubernetes and how it works.\n",
		);
		expect(out).toContain("[Kubernetes](/technology/kubernetes)");
	});

	it("leaves subsequent mentions of the same technology as plain text", async () => {
		const out = await processSource(
			"Kubernetes is great. We use Kubernetes everywhere. Kubernetes ships.\n",
		);
		const matches = out.match(/\[Kubernetes\]\(\/technology\/kubernetes\)/g);
		expect(matches?.length).toBe(1);
		expect(out).toMatch(/\.\s+We use Kubernetes everywhere/);
	});

	it("preserves the original case of the matched text", async () => {
		const out = await processSource("kubernetes is lowercased here.\n");
		expect(out).toContain("[kubernetes](/technology/kubernetes)");
	});

	it("supports hyphenated names with custom alnum boundaries", async () => {
		const out = await processSource(
			"For bare-metal HA, kube-vip is the right tool.\n",
		);
		expect(out).toContain("[kube-vip](/technology/kube-vip)");
	});

	it("links across multiple distinct technologies in the same paragraph", async () => {
		const out = await processSource(
			"apko pairs with melange to build distroless images.\n",
		);
		expect(out).toContain("[apko](/technology/apko)");
		expect(out).toContain("[melange](/technology/melange)");
	});
});

describe("remarkTechAutolink ignored content", () => {
	it("does not link inside inline code", async () => {
		const out = await processSource("Run `apko build` to produce an image.\n");
		expect(out).not.toContain("[apko]");
		expect(out).toContain("`apko build`");
	});

	it("does not link inside fenced code blocks", async () => {
		const out = await processSource(
			"```sh\napko build config.yaml image.tar\n```\n",
		);
		expect(out).not.toContain("[apko]");
	});

	it("does not link inside headings or existing links", async () => {
		const heading = await processSource("## Using apko in production\n\n");
		const link = await processSource(
			"See [our Kubernetes guide](https://example.com).\n",
		);

		expect(heading).toContain("## Using apko in production");
		expect(heading).not.toContain("[apko]");
		expect(link).not.toContain("/technology/kubernetes");
		expect(link).toContain("[our Kubernetes guide](https://example.com)");
	});

	it("honors the default skip list", async () => {
		const out = await processSource(
			"This service is written in Go. Go is fast.\n",
		);
		expect(out).not.toContain("/technology/go");
	});

	it("honors the no-autolink MDX comment opt-out", async () => {
		const out = await processSource(
			"{/* no-autolink */}\nThis is about Kubernetes and apko.\n",
		);
		expectNoTechnologyLink(out);
	});
});

describe("remarkTechAutolink boundaries and options", () => {
	it("does not match a tech name as a substring of a longer identifier", async () => {
		const out = await processSource("My favorite framework is apkoplasty.\n");
		expectNoTechnologyLink(out);
	});

	it("does not link a tech name inside hyphenated identifiers", async () => {
		const prefixed = await processSource(
			"The apko-style approach to images deserves attention.\n",
		);
		const surrounded = await processSource("Try the x-apko-y experiment.\n");

		expectNoTechnologyLink(prefixed);
		expectNoTechnologyLink(surrounded);
	});

	it("respects an explicit per-call skipNames override", async () => {
		const out = await processSource("Try apko for distroless builds.\n", {
			skipNames: ["apko"],
		});
		expectNoTechnologyLink(out);
	});

	it("skips technology profile pages without suppressing article pages", async () => {
		const profile = await processFile(
			"apko is a tool from Chainguard.\n",
			"/repo/content/technologies/apko/index.mdx",
		);
		const article = await processFile(
			"apko is a tool from Chainguard.\n",
			"/repo/content/articles/some-post/index.mdx",
		);

		expectNoTechnologyLink(profile);
		expect(article).toContain("[apko](/technology/apko)");
	});
});

describe("remarkTechAutolink MDX support", () => {
	it("links plain paragraphs adjacent to MDX components", async () => {
		const out = await processSource(
			'<Note>This Kubernetes tip is inside an MDX component.</Note>\n\nKubernetes is also mentioned in plain prose.\n',
		);
		expect(out).toContain("[Kubernetes](/technology/kubernetes)");
	});

	it("handles a document with mdxjsEsm imports at the top", async () => {
		const source = [
			"import Aside from '@/components/Aside.astro';",
			"",
			"<Aside>Hello.</Aside>",
			"",
			"This paragraph mentions Kubernetes once.",
			"",
		].join("\n");
		const out = await processSource(source);
		expect(out).toContain("[Kubernetes](/technology/kubernetes)");
	});
});
