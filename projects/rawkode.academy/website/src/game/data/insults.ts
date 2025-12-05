import type { Insult, Comeback } from "./types";

export const insults: Insult[] = [
	// Kubectl and deployment insults
	{
		id: "mass-delete-pods",
		text: "I'll mass-delete your pods before you know what hit you!",
		layer: "app-namespace",
	},
	{
		id: "fast-deployments",
		text: "My deployments are so fast, you'll never catch up!",
		layer: "app-namespace",
	},
	{
		id: "deploy-no-fear",
		text: "I deploy straight to production without fear!",
		layer: "app-namespace",
	},
	{
		id: "deploy-20-times",
		text: "I deploy to production 20 times a day!",
		layer: "app-namespace",
	},
	{
		id: "never-rollback",
		text: "I've never needed to rollback a single deployment!",
		layer: "app-namespace",
	},

	// Scaling and cluster insults
	{
		id: "scaled-clusters",
		text: "I've scaled clusters bigger than your entire career!",
		layer: "control-plane",
	},
	{
		id: "million-requests",
		text: "My cluster can handle 1 million requests per second!",
		layer: "control-plane",
	},
	{
		id: "replicas-excuses",
		text: "I run more replicas than you have excuses!",
		layer: "control-plane",
	},
	{
		id: "cluster-perfection",
		text: "Every cluster I touch becomes perfection!",
		layer: "control-plane",
	},

	// YAML and configuration insults
	{
		id: "panic-yaml",
		text: "People panic when they see my YAML coming!",
		layer: "generic",
	},
	{
		id: "complex-yaml",
		text: "My YAML is so complex, mere mortals weep trying to read it!",
		layer: "generic",
	},

	// Experience and expertise insults
	{
		id: "forgotten-kubernetes",
		text: "I've forgotten more about Kubernetes than you'll ever learn!",
		layer: "generic",
	},
	{
		id: "containerizing-school",
		text: "I was containerizing apps while you were still in school!",
		layer: "generic",
	},
	{
		id: "devops-yaml-spell",
		text: "I've been doing DevOps since before you could spell YAML!",
		layer: "generic",
	},
	{
		id: "kubectl-legendary",
		text: "My kubectl skills are legendary across the seven clouds!",
		layer: "generic",
	},
	{
		id: "debug-blindfolded",
		text: "I can debug any system blindfolded!",
		layer: "generic",
	},

	// Networking and security insults
	{
		id: "drain-nodes",
		text: "I will drain every node you've ever touched!",
		layer: "host",
	},
	{
		id: "network-policies",
		text: "Nobody's ever escaped my network policies!",
		layer: "service-mesh",
	},
	{
		id: "hardened-containers",
		text: "My containers are so hardened, nothing gets through!",
		layer: "app-namespace",
	},
	{
		id: "ingress-impenetrable",
		text: "My ingress rules are impenetrable!",
		layer: "external-web",
	},
	{
		id: "gateway-api",
		text: "We just migrated to Gateway API!",
		layer: "external-web",
	},
	{
		id: "mtls-free",
		text: "I give everyone mTLS for free!",
		layer: "service-mesh",
	},
	{
		id: "namespaces-control",
		text: "I control more namespaces than you have brain cells!",
		layer: "api-server",
	},
	{
		id: "security-posture-wifi",
		text: "I've seen better security posture on conference WiFi!",
		layer: "generic",
	},

	// Architecture and microservices insults
	{
		id: "microservices-decoupled",
		text: "My microservices are so decoupled, they don't even know each other exist!",
		layer: "service-mesh",
	},
	{
		id: "4000-microservices",
		text: "We just deployed our 4000th micro-service!",
		layer: "service-mesh",
	},
	{
		id: "service-mesh-symphony",
		text: "My service mesh handles traffic like a symphony conductor!",
		layer: "service-mesh",
	},
	{
		id: "multi-cloud",
		text: "My production is multi-cloud!",
		layer: "control-plane",
	},

	// CI/CD and operations insults
	{
		id: "cicd-fast",
		text: "My CI/CD pipeline runs faster than you can blink!",
		layer: "generic",
	},
	{
		id: "gitops-smooth",
		text: "My GitOps workflow is smoother than silk!",
		layer: "generic",
	},
	{
		id: "services-uptime",
		text: "My services haven't gone down in months!",
		layer: "generic",
	},
	{
		id: "response-times",
		text: "My response times are faster than your reflexes!",
		layer: "generic",
	},
	{
		id: "observability-best",
		text: "My observability is second to none!",
		layer: "generic",
	},
	{
		id: "seven-nines",
		text: "I have 7 9's of reliability!",
		layer: "generic",
	},

	// Code quality insults
	{
		id: "messy-code",
		text: "Your code is so messy, even the garbage-collector refuses to touch it!",
		layer: "app-namespace",
	},

	// Production disaster insults
	{
		id: "mass-evicted",
		text: "I once mass-evicted every pod in production during a mighty struggle!",
		layer: "control-plane",
	},

	// Team and reputation insults
	{
		id: "sres-competent",
		text: "I've spoken with SREs more competent than you!",
		layer: "generic",
	},
	{
		id: "engineers-flee",
		text: "Engineers flee when I join their standup!",
		layer: "generic",
	},
	{
		id: "reputation-precedes",
		text: "My reputation precedes me in every cluster!",
		layer: "generic",
	},
	{
		id: "engineers-ship",
		text: "I've worked with engineers who actually ship!",
		layer: "generic",
	},
	{
		id: "monkeys-manifests",
		text: "I've seen monkeys write better manifests!",
		layer: "generic",
	},

	// Resource consumption insults
	{
		id: "consume-resources",
		text: "I'll consume every resource in your namespace!",
		layer: "app-namespace",
	},
	{
		id: "processes-eat",
		text: "My processes will eat your cluster alive!",
		layer: "control-plane",
	},
];

export const comebacks: Comeback[] = [
	// Direct comebacks (one insult, one comeback)
	{
		id: "kubectl-reckless",
		text: "You run `kubectl` THAT recklessly?",
		effectiveness: ["mass-delete-pods"],
	},
	{
		id: "roll-back-fast",
		text: "Too bad they roll back just as quickly.",
		effectiveness: ["fast-deployments"],
	},
	{
		id: "cloud-bill-finance",
		text: "Is that why your cloud bill needs its own finance team?",
		effectiveness: ["scaled-clusters"],
	},
	{
		id: "parse-yaml",
		text: "Even BEFORE they try to parse it?",
		effectiveness: ["panic-yaml"],
	},
	{
		id: "fight-like-cloud-bill",
		text: "How appropriate. You fight like a cloud bill.",
		effectiveness: ["drain-nodes", "consume-resources", "processes-eat"],
	},
	{
		id: "restrictive-breached",
		text: "You run THAT restrictive and still get breached?",
		effectiveness: ["network-policies"],
	},
	{
		id: "ego-container",
		text: "Too bad your ego couldn't fit inside one.",
		effectiveness: ["hardened-containers"],
	},
	{
		id: "stop-running-root",
		text: "I hope now you've learned to stop running as root.",
		effectiveness: ["mass-evicted"],
	},
	{
		id: "comfortable-chaos",
		text: "I wanted to make sure you'd feel comfortable in chaos.",
		effectiveness: ["cluster-perfection"],
	},
	{
		id: "blameless-postmortem",
		text: "I'm glad to hear you attended your blameless postmortem.",
		effectiveness: ["sres-competent", "engineers-ship", "monkeys-manifests"],
	},
	{
		id: "smell-breath",
		text: "Even BEFORE they smell your breath?",
		effectiveness: ["panic-yaml", "engineers-flee", "reputation-precedes"],
	},
	{
		id: "network-policies-source",
		text: "Is that where you picked up your network policies?",
		effectiveness: ["security-posture-wifi"],
	},
	{
		id: "deprecated-apis",
		text: "That explains your deprecated API calls.",
		effectiveness: ["forgotten-kubernetes"],
	},
	{
		id: "dockerfiles-homework",
		text: "Is that why your Dockerfiles still look like homework?",
		effectiveness: ["containerizing-school"],
	},
	{
		id: "indent-properly",
		text: "And you still can't indent it properly.",
		effectiveness: ["devops-yaml-spell"],
	},
	{
		id: "kubectl-cant-parse",
		text: "Too bad kubectl can't parse it either.",
		effectiveness: ["complex-yaml"],
	},
	{
		id: "broken-service-discovery",
		text: "Is that just your excuse for broken service discovery?",
		effectiveness: ["microservices-decoupled"],
	},
	{
		id: "pooling-connections",
		text: "I hope you're pooling connections to your one database.",
		effectiveness: ["4000-microservices"],
	},
	{
		id: "write-tests",
		text: "Have you ever considered writing some tests?",
		effectiveness: ["cicd-fast"],
	},
	{
		id: "crashloopbackoffs",
		text: "Doesn't count if it's all CrashLoopBackOffs.",
		effectiveness: ["million-requests"],
	},
	{
		id: "why-need-gc",
		text: "Funny, yours is why we need one.",
		effectiveness: ["messy-code"],
	},
	{
		id: "wrote-blindfolded",
		text: "Is that how you wrote it too?",
		effectiveness: ["debug-blindfolded"],
	},
	{
		id: "look-at-manifests",
		text: "I wouldn't want to look at your manifests either.",
		effectiveness: ["debug-blindfolded"],
	},
	{
		id: "stop-deploying",
		text: "Impressive what happens when you stop deploying.",
		effectiveness: ["services-uptime"],
	},
	{
		id: "feature-freeze",
		text: "Congratulations on the feature freeze.",
		effectiveness: ["services-uptime"],
	},
	{
		id: "incident-response",
		text: "Too bad your incident response isn't.",
		effectiveness: ["response-times"],
	},
	{
		id: "quantity-quality",
		text: "Quantity has a quality of its own, I suppose.",
		effectiveness: ["replicas-excuses"],
	},
	{
		id: "share-same-bug",
		text: "And they all share the same bug.",
		effectiveness: ["replicas-excuses"],
	},
	{
		id: "been-warned",
		text: "So I've been warned.",
		effectiveness: ["kubectl-legendary"],
	},
	{
		id: "mutual-trust",
		text: "The 'mutual' part requires someone to trust you.",
		effectiveness: ["mtls-free"],
	},
	{
		id: "renew-certs",
		text: "Shame you forgot to renew your certs.",
		effectiveness: ["mtls-free"],
	},
	{
		id: "one-service-account",
		text: "Shame it's all with one service account.",
		effectiveness: ["namespaces-control"],
	},
	{
		id: "approve-own-prs",
		text: "Easy when you approve your own PRs.",
		effectiveness: ["gitops-smooth"],
	},
	{
		id: "fear-awareness",
		text: "Fear requires awareness.",
		effectiveness: ["deploy-no-fear"],
	},
	{
		id: "worth-returning",
		text: "Rollbacks require something worth returning to.",
		effectiveness: ["never-rollback"],
	},
	{
		id: "block-customers",
		text: "Even to your own customers, apparently.",
		effectiveness: ["ingress-impenetrable"],
	},
	{
		id: "gateway-problems",
		text: "A gateway to more problems, I assume.",
		effectiveness: ["gateway-api"],
	},
	{
		id: "wave-stick",
		text: "Lots of overhead just to wave a stick.",
		effectiveness: ["service-mesh-symphony"],
	},
	{
		id: "dude-wheres-my-car",
		text: "Shame you're watching Dude, Where's My Car?",
		effectiveness: ["observability-best"],
	},
	{
		id: "multiple-failures",
		text: "I assume the 'multi' stands for 'multiple points of failure.'",
		effectiveness: ["multi-cloud"],
	},
	{
		id: "uptime-or-errors",
		text: "Is that uptime or your error rate?",
		effectiveness: ["seven-nines"],
	},
	{
		id: "working-release",
		text: "Wow, did you finally get a working release?",
		effectiveness: ["deploy-20-times"],
	},
	{
		id: "tested-locally",
		text: "Maybe if you tested locally, you wouldn't need the other nineteen.",
		effectiveness: ["deploy-20-times"],
	},
];

export function getEffectiveComebacks(insultId: string): Comeback[] {
	return comebacks.filter((c) => c.effectiveness.includes(insultId));
}

export function getRandomInsult(layer?: string): Insult {
	const filtered = layer
		? insults.filter((i) => i.layer === layer || i.layer === "generic")
		: insults;
	const insult = filtered[Math.floor(Math.random() * filtered.length)];
	if (!insult) {
		return insults[0] as Insult;
	}
	return insult;
}
