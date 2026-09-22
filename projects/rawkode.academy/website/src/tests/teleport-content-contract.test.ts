import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";

const courseId = "teleport-for-kubernetes";
const root = resolve("../../../content/courses");
const read = (file: string) =>
	matter(readFileSync(resolve(root, file), "utf8"));
const overview = read(`${courseId}.mdx`);
const introduction = read(`${courseId}/01-introduction.mdx`);
const deployment = read(`${courseId}/02-deploying-teleport-cluster.mdx`);
const lessons = [
	[
		"01-introduction",
		"qhc6jajwhi2ul563ncovdrg9",
		[
			"https://goteleport.com/docs/",
			"https://github.com/gravitational/teleport",
		],
	],
	[
		"02-deploying-teleport-cluster",
		"bx2e90jd6p1u2pkvgj1wo6b7",
		["https://goteleport.com/docs/deploy-a-cluster/helm-deployments/"],
	],
	[
		"03-identity-based-access-rbac",
		"s7mhnkw81wdgfe5tc4a2ky18",
		["https://goteleport.com/docs/access-controls/sso/github-sso/"],
	],
	[
		"04-two-layer-rbac-boundaries",
		"h1qevuz6tezzpolx3afeo0r2",
		["https://goteleport.com/docs/access-controls/guides/role-templates/"],
	],
	[
		"05-just-in-time-access",
		"c94kkvztdlqc5vvil0c91p95",
		["https://goteleport.com/docs/access-controls/access-requests/"],
	],
	[
		"06-auditing-and-session-recording",
		"twq63ce7cr33d3nn6olb2aa2",
		["https://goteleport.com/docs/reference/audit/"],
	],
] as const;

describe("Teleport video-walkthrough content contract (CS07)", () => {
	it("does not promise supplied runnable scripts anywhere in the overview or six lessons", () => {
		const files = readdirSync(resolve(root, courseId)).filter((name) =>
			name.endsWith(".mdx"),
		);
		expect(files.sort()).toEqual(lessons.map(([slug]) => `${slug}.mdx`));
		for (const source of [
			overview,
			...files.map((file) => read(`${courseId}/${file}`)),
		]) {
			expect(source.content).not.toMatch(
				/runnable demo scripts|every video includes.*scripts|walk through the demo scripts/i,
			);
		}
		expect(overview.content).toContain(
			"video walkthroughs demonstrate the setup on a local Kind cluster",
		);
		expect(deployment.content).toContain(
			"The video walks through these deployment steps:",
		);
	});

	it.each(
		lessons,
	)("preserves %s media, publication and real resource destinations", (slug, videoId, urls) => {
		const { data } = read(`${courseId}/${slug}.mdx`);
		expect(data.course).toBe(courseId);
		expect(data.draft).toBe(false);
		expect(data.order).toBe(Number(slug.slice(0, 2)));
		expect(data.authors).toEqual(["rawkode"]);
		expect(new Date(data.publishedAt).toISOString()).toBe(
			"2026-03-23T00:00:00.000Z",
		);
		expect(data.video).toEqual({
			id: videoId,
			thumbnailUrl: `https://content.rawkode.academy/videos/${videoId}/thumbnail.webp`,
		});
		expect(
			data.resources.map((resource: { url: string }) => resource.url),
		).toEqual(urls);
		expect(
			data.resources.every(
				(resource: { type: string; embedConfig?: unknown }) =>
					resource.type === "url" && resource.embedConfig === undefined,
			),
		).toBe(true);
	});

	it("preserves overview resources, cover and signup configuration without inventing a demo destination", () => {
		expect(
			overview.data.resources.map((resource: { url: string }) => resource.url),
		).toEqual(lessons[0][2]);
		expect(overview.data.cover.image).toBe("./teleport-for-kubernetes.png");
		expect(overview.data.signupConfig).toEqual({
			audienceId: courseId,
			sponsor: "Teleport",
			sponsorAudienceId: "teleport",
			allowSponsorContact: true,
		});
	});

	it("retains the three services, all five deployment instructions and production comparison", () => {
		for (const service of [
			"Auth Service",
			"Proxy Service",
			"Kubernetes Service",
		])
			expect(introduction.content).toContain(`**${service}**`);
		expect(deployment.content.match(/^\d\. /gm)).toHaveLength(5);
		for (const text of [
			"Verify Kind, Helm, and kubectl are installed",
			"simple single control-plane configuration",
			"install cert-manager with CRDs, create a self-signed issuer and root certificate",
			"Standalone chart mode, Multiplex proxy listener, and cert-manager integration",
			"Use `envsubst` for values templating, then `helm upgrade --install`",
			"rawkode.cloud using Flux CD",
			"ACME-managed TLS certificates, Mayastor storage, and Gateway API via Cilium",
		])
			expect(deployment.content).toContain(text);
	});

	it("leaves the existing edition/licensing sentence untouched, without validating that claim", () => {
		expect(overview.content).toContain(
			"Everything is built on the Teleport Community Edition, which is free and open source.",
		);
	});
});
