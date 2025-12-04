import type { Insult, Comeback } from "./types";

export const insults: Insult[] = [
	{
		id: "nginx-1",
		text: "My ingress rules are so complex, you'll never find the right path!",
		layer: "external-web",
	},
	{
		id: "nginx-2",
		text: "I handle millions of requests per second. Your puny attacks mean nothing!",
		layer: "external-web",
	},
	{
		id: "dashboard-1",
		text: "I'm protected by... well, I'm sure someone configured authentication!",
		layer: "external-web",
	},
	{
		id: "dashboard-2",
		text: "You can look, but you can't touch my cluster resources!",
		layer: "external-web",
	},
	{
		id: "traefik-1",
		text: "My middleware chain is impenetrable! 47 layers of security!",
		layer: "external-web",
	},
	{
		id: "lb-1",
		text: "I load balance across 100 pods. Good luck finding the vulnerable one!",
		layer: "external-web",
	},
	{
		id: "pod-1",
		text: "I run as root, but that's just for convenience. Totally secure!",
		layer: "app-namespace",
	},
	{
		id: "api-1",
		text: "My secrets are safely stored in... environment variables!",
		layer: "app-namespace",
	},
	{
		id: "redis-1",
		text: "No password needed - we trust everyone on the internal network!",
		layer: "app-namespace",
	},
	{
		id: "istio-1",
		text: "mTLS everywhere! Your traffic will never reach its destination!",
		layer: "service-mesh",
	},
	{
		id: "etcd-1",
		text: "I encrypt secrets at rest. The key? It's around here somewhere...",
		layer: "control-plane",
	},
	{
		id: "generic-1",
		text: "Security through obscurity has always worked for us!",
		layer: "generic",
	},
	{
		id: "generic-2",
		text: "Our YAML is so complex, even we don't understand it!",
		layer: "generic",
	},
	{
		id: "generic-3",
		text: "We followed a Medium article for our security setup!",
		layer: "generic",
	},
	{
		id: "generic-4",
		text: "CVEs? We'll patch those in the next sprint... maybe.",
		layer: "generic",
	},
];

export const comebacks: Comeback[] = [
	{
		id: "comeback-1",
		text: "Too bad your /metrics endpoint is public and shows all your routes!",
		effectiveness: ["nginx-1", "traefik-1"],
	},
	{
		id: "comeback-2",
		text: "Impressive scale, shame about that default backend with debug mode on!",
		effectiveness: ["nginx-2", "lb-1"],
	},
	{
		id: "comeback-3",
		text: "Skip auth? I love when dashboards trust the 'X-Forwarded-User' header!",
		effectiveness: ["dashboard-1", "dashboard-2"],
	},
	{
		id: "comeback-4",
		text: "Running as root? Thanks for the easy container escape!",
		effectiveness: ["pod-1"],
	},
	{
		id: "comeback-5",
		text: "Environment variables? Let me just exec into the pod real quick...",
		effectiveness: ["api-1"],
	},
	{
		id: "comeback-6",
		text: "Internal network trust? My compromised pod says hello!",
		effectiveness: ["redis-1"],
	},
	{
		id: "comeback-7",
		text: "mTLS is great until someone leaves permissive mode enabled!",
		effectiveness: ["istio-1"],
	},
	{
		id: "comeback-8",
		text: "Encryption at rest means nothing when the API is wide open!",
		effectiveness: ["etcd-1"],
	},
	{
		id: "comeback-9",
		text: "Obscurity? I just ran 'kubectl get secrets' and they're all there!",
		effectiveness: ["generic-1"],
	},
	{
		id: "comeback-10",
		text: "Complex YAML? Perfect for hiding misconfigurations!",
		effectiveness: ["generic-2"],
	},
	{
		id: "comeback-11",
		text: "Medium tutorials and production clusters... what could go wrong?",
		effectiveness: ["generic-3"],
	},
	{
		id: "comeback-12",
		text: "Next sprint? This CVE has a public exploit from 2019!",
		effectiveness: ["generic-4"],
	},
	{
		id: "comeback-13",
		text: "Your annotations expose your internal service names!",
		effectiveness: ["nginx-1", "nginx-2", "traefik-1"],
	},
	{
		id: "comeback-14",
		text: "No network policies? All pods can talk to all pods!",
		effectiveness: ["generic-1", "generic-2", "redis-1"],
	},
	{
		id: "comeback-15",
		text: "I see your pod security policy is... deprecated and ignored!",
		effectiveness: ["pod-1", "generic-3"],
	},
];

export function getEffectiveComebacks(insultId: string): Comeback[] {
	return comebacks.filter((c) => c.effectiveness.includes(insultId));
}

export function getRandomInsult(layer?: string): Insult {
	const filtered = layer ? insults.filter((i) => i.layer === layer || i.layer === "generic") : insults;
	const insult = filtered[Math.floor(Math.random() * filtered.length)];
	if (!insult) {
		return insults[0] as Insult;
	}
	return insult;
}
