import type { Insult, Comeback } from "./types";

// External enemies: nginx-ingress, exposed-dashboard, traefik-proxy, load-balancer
// App enemies: frontend-pod, backend-api, redis-cache
// ServiceMesh enemies: istio-sidecar, linkerd-proxy
// KubeSystem enemies: etcd-store, kube-scheduler
// ApiServer enemies: api-server
// Host enemies: kubelet

export const insults: Insult[] = [
	// External layer insults
	{
		id: "ingress-impenetrable",
		text: "My ingress rules are impenetrable!",
		layer: "External",
		enemies: ["nginx-ingress", "traefik-proxy"],
	},
	{
		id: "gateway-api",
		text: "We just migrated to Gateway API!",
		layer: "External",
		enemies: ["nginx-ingress", "traefik-proxy", "load-balancer"],
	},
	{
		id: "tls-everywhere",
		text: "I've got TLS everywhere - you'll never sniff my traffic!",
		layer: "External",
		enemies: ["nginx-ingress", "traefik-proxy", "load-balancer"],
	},
	{
		id: "rate-limiter-dinners",
		text: "My rate limiter has rejected more requests than you've had hot dinners!",
		layer: "External",
		enemies: ["nginx-ingress", "traefik-proxy", "load-balancer"],
	},
	{
		id: "waf-naquadah",
		text: "My WAF blocks bots like a Naquadah Dam holds water!",
		layer: "External",
		enemies: ["load-balancer"],
	},
	{
		id: "cdn-edge-nodes",
		text: "My CDN has edge nodes in more countries than you've heard of!",
		layer: "External",
		enemies: ["nginx-ingress", "traefik-proxy", "load-balancer"],
	},
	{
		id: "dashboard-readonly",
		text: "[TMP] This dashboard is read-only, you can't do anything here!",
		layer: "External",
		enemies: ["exposed-dashboard"],
	},
	{
		id: "dashboard-rbac",
		text: "[TMP] I've locked this dashboard down with proper RBAC!",
		layer: "External",
		enemies: ["exposed-dashboard"],
	},

	// App layer insults
	{
		id: "mass-delete-pods",
		text: "I'll mass-delete your pods before you know what hit you!",
		layer: "App",
		enemies: ["frontend-pod", "backend-api"],
	},
	{
		id: "fast-deployments",
		text: "My deployments are so fast, you'll never catch up!",
		layer: "App",
		enemies: ["frontend-pod", "backend-api"],
	},
	{
		id: "deploy-no-fear",
		text: "I deploy straight to production without fear!",
		layer: "App",
		enemies: ["frontend-pod", "backend-api"],
	},
	{
		id: "deploy-20-times",
		text: "I deploy to production 20 times a day!",
		layer: "App",
		enemies: ["frontend-pod", "backend-api"],
	},
	{
		id: "never-rollback",
		text: "I've never needed to rollback a single deployment!",
		layer: "App",
		enemies: ["frontend-pod", "backend-api"],
	},
	{
		id: "hardened-containers",
		text: "My containers are so hardened, nothing gets through!",
		layer: "App",
		enemies: ["frontend-pod", "backend-api", "redis-cache"],
	},
	{
		id: "messy-code",
		text: "Your code is so messy, even the garbage-collector refuses to touch it!",
		layer: "App",
		enemies: ["frontend-pod", "backend-api"],
	},
	{
		id: "consume-resources",
		text: "I'll consume every resource in your namespace!",
		layer: "App",
		enemies: ["frontend-pod", "backend-api", "redis-cache"],
	},

	// ServiceMesh layer insults
	{
		id: "network-policies",
		text: "Nobody's ever escaped my network policies!",
		layer: "ServiceMesh",
		enemies: ["istio-sidecar", "linkerd-proxy"],
	},
	{
		id: "mtls-free",
		text: "I give everyone mTLS for free!",
		layer: "ServiceMesh",
		enemies: ["istio-sidecar", "linkerd-proxy"],
	},
	{
		id: "microservices-decoupled",
		text: "My microservices are so decoupled, they don't even know each other exist!",
		layer: "ServiceMesh",
		enemies: ["istio-sidecar", "linkerd-proxy"],
	},
	{
		id: "4000-microservices",
		text: "We just deployed our 4000th micro-service!",
		layer: "ServiceMesh",
		enemies: ["istio-sidecar", "linkerd-proxy"],
	},
	{
		id: "service-mesh-symphony",
		text: "My service mesh handles traffic like a symphony conductor!",
		layer: "ServiceMesh",
		enemies: ["istio-sidecar", "linkerd-proxy"],
	},

	// KubeSystem layer insults
	{
		id: "scaled-clusters",
		text: "I've scaled clusters bigger than your entire career!",
		layer: "KubeSystem",
		enemies: ["etcd-store", "kube-scheduler"],
	},
	{
		id: "million-requests",
		text: "My cluster can handle 1 million requests per second!",
		layer: "KubeSystem",
		enemies: ["etcd-store", "kube-scheduler"],
	},
	{
		id: "replicas-excuses",
		text: "I run more replicas than you have excuses!",
		layer: "KubeSystem",
		enemies: ["kube-scheduler"],
	},
	{
		id: "cluster-perfection",
		text: "Every cluster I touch becomes perfection!",
		layer: "KubeSystem",
		enemies: ["etcd-store", "kube-scheduler"],
	},
	{
		id: "multi-cloud",
		text: "My production is multi-cloud!",
		layer: "KubeSystem",
		enemies: ["etcd-store", "kube-scheduler"],
	},
	{
		id: "mass-evicted",
		text: "I once mass-evicted every pod in production during a mighty struggle!",
		layer: "KubeSystem",
		enemies: ["kube-scheduler"],
	},
	{
		id: "processes-eat",
		text: "My processes will eat your cluster alive!",
		layer: "KubeSystem",
		enemies: ["etcd-store", "kube-scheduler"],
	},

	// ApiServer layer insults
	{
		id: "namespaces-control",
		text: "I control more namespaces than you have brain cells!",
		layer: "ApiServer",
		enemies: ["api-server"],
	},
	{
		id: "cluster-admin",
		text: "I've got cluster-admin and I'm not afraid to use it!",
		layer: "ApiServer",
		enemies: ["api-server"],
	},
	{
		id: "admission-controllers",
		text: "My admission controllers reject pods before they even dream of running!",
		layer: "ApiServer",
		enemies: ["api-server"],
	},
	{
		id: "audit-logs",
		text: "My audit logs capture every move you make!",
		layer: "ApiServer",
		enemies: ["api-server"],
	},
	{
		id: "deprecated-more-apis",
		text: "I've deprecated more APIs than you've ever called!",
		layer: "ApiServer",
		enemies: ["api-server"],
	},

	// Host layer insults
	{
		id: "drain-nodes",
		text: "I will drain every node you've ever touched!",
		layer: "Host",
		enemies: ["kubelet"],
	},
	{
		id: "resource-limits-budget",
		text: "I enforce resource limits tighter than your budget!",
		layer: "Host",
		enemies: ["kubelet"],
	},
	{
		id: "privileged-mode",
		text: "I run everything in privileged mode - maximum power!",
		layer: "Host",
		enemies: ["kubelet"],
	},
	{
		id: "image-pulls-curator",
		text: "I've pulled more images than a museum curator!",
		layer: "Host",
		enemies: ["kubelet"],
	},
	{
		id: "cgroups-contained",
		text: "My cgroups have contained threats bigger than you!",
		layer: "Host",
		enemies: ["kubelet"],
	},

	// Generic insults (all enemies can use)
	{
		id: "panic-yaml",
		text: "People panic when they see my YAML coming!",
		layer: "Generic",
		enemies: [],
	},
	{
		id: "complex-yaml",
		text: "My YAML is so complex, mere mortals weep trying to read it!",
		layer: "Generic",
		enemies: [],
	},
	{
		id: "forgotten-kubernetes",
		text: "I've forgotten more about Kubernetes than you'll ever learn!",
		layer: "Generic",
		enemies: [],
	},
	{
		id: "containerizing-school",
		text: "I was containerizing apps while you were still in school!",
		layer: "Generic",
		enemies: [],
	},
	{
		id: "devops-yaml-spell",
		text: "I've been doing DevOps since before you could spell YAML!",
		layer: "Generic",
		enemies: [],
	},
	{
		id: "kubectl-legendary",
		text: "My kubectl skills are legendary across the seven clouds!",
		layer: "Generic",
		enemies: [],
	},
	{
		id: "debug-blindfolded",
		text: "I can debug any system blindfolded!",
		layer: "Generic",
		enemies: [],
	},
	{
		id: "security-posture-wifi",
		text: "I've seen better security posture on conference WiFi!",
		layer: "Generic",
		enemies: [],
	},
	{
		id: "cicd-fast",
		text: "My CI/CD pipeline runs faster than you can blink!",
		layer: "Generic",
		enemies: [],
	},
	{
		id: "gitops-smooth",
		text: "My GitOps workflow is smoother than silk!",
		layer: "Generic",
		enemies: [],
	},
	{
		id: "services-uptime",
		text: "My services haven't gone down in months!",
		layer: "Generic",
		enemies: [],
	},
	{
		id: "response-times",
		text: "My response times are faster than your reflexes!",
		layer: "Generic",
		enemies: [],
	},
	{
		id: "observability-best",
		text: "My observability is second to none!",
		layer: "Generic",
		enemies: [],
	},
	{
		id: "seven-nines",
		text: "I have 7 9's of reliability!",
		layer: "Generic",
		enemies: [],
	},
	{
		id: "sres-competent",
		text: "I've spoken with SREs more competent than you!",
		layer: "Generic",
		enemies: [],
	},
	{
		id: "engineers-flee",
		text: "Engineers flee when I join their standup!",
		layer: "Generic",
		enemies: [],
	},
	{
		id: "reputation-precedes",
		text: "My reputation precedes me in every cluster!",
		layer: "Generic",
		enemies: [],
	},
	{
		id: "engineers-ship",
		text: "I've worked with engineers who actually ship!",
		layer: "Generic",
		enemies: [],
	},
	{
		id: "monkeys-manifests",
		text: "I've seen monkeys write better manifests!",
		layer: "Generic",
		enemies: [],
	},
	{
		id: "ebpf-probes",
		text: "My eBPF probes see everything you do!",
		layer: "Generic",
		enemies: [],
	},
];

export const comebacks: Comeback[] = [
	// External layer comebacks
	{
		id: "block-customers",
		text: "Even to your own customers, apparently.",
		effectiveness: ["ingress-impenetrable"],
		layer: "External",
	},
	{
		id: "gateway-problems",
		text: "A gateway to more problems, I assume.",
		effectiveness: ["gateway-api"],
		layer: "External",
	},
	{
		id: "expired-certs",
		text: "Too bad your certs expired last month.",
		effectiveness: ["tls-everywhere", "mtls-free"],
		layer: "External",
	},
	{
		id: "reject-cooking",
		text: "If I cooked like you code, I'd reject them too.",
		effectiveness: ["rate-limiter-dinners"],
		layer: "External",
	},
	{
		id: "no-gdo",
		text: "Shame your customers don't have a GDO.",
		effectiveness: ["waf-naquadah"],
		layer: "External",
	},
	{
		id: "cache-yolo",
		text: "Too bad your cache-control headers are set to 'yolo'.",
		effectiveness: ["cdn-edge-nodes"],
		layer: "External",
	},
	{
		id: "dashboard-admin-token",
		text: "[TMP] Good thing I found the admin token in your ConfigMap.",
		effectiveness: ["dashboard-readonly", "dashboard-rbac"],
		layer: "External",
	},

	// App layer comebacks
	{
		id: "kubectl-reckless",
		text: "You run `kubectl` THAT recklessly?",
		effectiveness: ["mass-delete-pods"],
		layer: "App",
	},
	{
		id: "roll-back-fast",
		text: "Too bad they roll back just as quickly.",
		effectiveness: ["fast-deployments"],
		layer: "App",
	},
	{
		id: "fear-awareness",
		text: "Fear requires awareness.",
		effectiveness: ["deploy-no-fear"],
		layer: "App",
	},
	{
		id: "working-release",
		text: "Wow, did you finally get a working release?",
		effectiveness: ["deploy-20-times"],
		layer: "App",
	},
	{
		id: "tested-locally",
		text: "Maybe if you tested locally, you wouldn't need the other nineteen.",
		effectiveness: ["deploy-20-times"],
		layer: "App",
	},
	{
		id: "worth-returning",
		text: "Rollbacks require something worth returning to.",
		effectiveness: ["never-rollback"],
		layer: "App",
	},
	{
		id: "ego-container",
		text: "Too bad your ego couldn't fit inside one.",
		effectiveness: ["hardened-containers"],
		layer: "App",
	},
	{
		id: "why-need-gc",
		text: "Funny, yours is why we need one.",
		effectiveness: ["messy-code"],
		layer: "App",
	},

	// ServiceMesh layer comebacks
	{
		id: "restrictive-breached",
		text: "You run THAT restrictive and still get breached?",
		effectiveness: ["network-policies"],
		layer: "ServiceMesh",
	},
	{
		id: "mutual-trust",
		text: "The 'mutual' part requires someone to trust you.",
		effectiveness: ["mtls-free"],
		layer: "ServiceMesh",
	},
	{
		id: "renew-certs",
		text: "Shame you forgot to renew your certs.",
		effectiveness: ["mtls-free", "tls-everywhere"],
		layer: "ServiceMesh",
	},
	{
		id: "broken-service-discovery",
		text: "Is that just your excuse for broken service discovery?",
		effectiveness: ["microservices-decoupled"],
		layer: "ServiceMesh",
	},
	{
		id: "pooling-connections",
		text: "I hope you're pooling connections to your one database.",
		effectiveness: ["4000-microservices"],
		layer: "ServiceMesh",
	},
	{
		id: "wave-stick",
		text: "Lots of overhead just to wave a stick.",
		effectiveness: ["service-mesh-symphony"],
		layer: "ServiceMesh",
	},

	// KubeSystem layer comebacks
	{
		id: "cloud-bill-finance",
		text: "Is that why your cloud bill needs its own finance team?",
		effectiveness: ["scaled-clusters", "cdn-edge-nodes"],
		layer: "KubeSystem",
	},
	{
		id: "crashloopbackoffs",
		text: "Doesn't count if it's all CrashLoopBackOffs.",
		effectiveness: ["million-requests", "replicas-excuses"],
		layer: "KubeSystem",
	},
	{
		id: "quantity-quality",
		text: "Quantity has a quality of its own, I suppose.",
		effectiveness: ["replicas-excuses", "4000-microservices", "deploy-20-times"],
		layer: "KubeSystem",
	},
	{
		id: "share-same-bug",
		text: "And they all share the same bug.",
		effectiveness: ["replicas-excuses", "4000-microservices"],
		layer: "KubeSystem",
	},
	{
		id: "comfortable-chaos",
		text: "I wanted to make sure you'd feel comfortable in chaos.",
		effectiveness: ["cluster-perfection"],
		layer: "KubeSystem",
	},
	{
		id: "multiple-failures",
		text: "I assume the 'multi' stands for 'multiple points of failure.'",
		effectiveness: ["multi-cloud"],
		layer: "KubeSystem",
	},
	{
		id: "stop-running-root",
		text: "I hope now you've learned to stop running as root.",
		effectiveness: ["mass-evicted"],
		layer: "KubeSystem",
	},

	// ApiServer layer comebacks
	{
		id: "one-service-account",
		text: "Shame it's all with one service account.",
		effectiveness: ["namespaces-control"],
		layer: "ApiServer",
	},
	{
		id: "elevated-resume",
		text: "I hope your resume is as elevated as your privileges.",
		effectiveness: ["cluster-admin", "privileged-mode"],
		layer: "ApiServer",
	},
	{
		id: "default-namespace-nightmare",
		text: "The nightmare comes true when they wake up in your default namespace.",
		effectiveness: ["admission-controllers"],
		layer: "ApiServer",
	},
	{
		id: "record-competence",
		text: "Then you finally have a record of what competence looks like.",
		effectiveness: ["audit-logs", "ebpf-probes"],
		layer: "ApiServer",
	},
	{
		id: "customers-stopped-calling",
		text: "Is that why your customers stopped calling?",
		effectiveness: ["deprecated-more-apis"],
		layer: "ApiServer",
	},

	// Host layer comebacks
	{
		id: "fight-like-cloud-bill",
		text: "How appropriate. You fight like a cloud bill.",
		effectiveness: ["drain-nodes", "consume-resources", "processes-eat"],
		layer: "Host",
	},
	{
		id: "oomkilled-uptime",
		text: "Explains why your OOMKilled count is higher than your uptime.",
		effectiveness: ["resource-limits-budget"],
		layer: "Host",
	},
	{
		id: "resource-denial",
		text: "With limits that tight, your only resource is denial.",
		effectiveness: ["resource-limits-budget"],
		layer: "Host",
	},
	{
		id: "privilege-mine-now",
		text: "The privilege is all mine... now.",
		effectiveness: ["privileged-mode"],
		layer: "Host",
	},
	{
		id: "storage-modern-art",
		text: "No wonder your storage bill looks like modern art—abstract and horrifying.",
		effectiveness: ["image-pulls-curator"],
		layer: "Host",
	},
	{
		id: "boundaries-rbac",
		text: "Must be nice to have boundaries, because your RBAC doesn't.",
		effectiveness: ["cgroups-contained", "network-policies", "hardened-containers"],
		layer: "Host",
	},

	// Generic layer comebacks
	{
		id: "parse-yaml",
		text: "Even BEFORE they try to parse it?",
		effectiveness: ["panic-yaml"],
		layer: "Generic",
	},
	{
		id: "smell-breath",
		text: "Even BEFORE they smell your breath?",
		effectiveness: ["panic-yaml", "engineers-flee", "reputation-precedes"],
		layer: "Generic",
	},
	{
		id: "kubectl-cant-parse",
		text: "Too bad kubectl can't parse it either.",
		effectiveness: ["complex-yaml"],
		layer: "Generic",
	},
	{
		id: "deprecated-apis",
		text: "That explains your deprecated API calls.",
		effectiveness: ["forgotten-kubernetes"],
		layer: "Generic",
	},
	{
		id: "dockerfiles-homework",
		text: "Is that why your Dockerfiles still look like homework?",
		effectiveness: ["containerizing-school"],
		layer: "Generic",
	},
	{
		id: "indent-properly",
		text: "And you still can't indent it properly.",
		effectiveness: ["devops-yaml-spell"],
		layer: "Generic",
	},
	{
		id: "been-warned",
		text: "So I've been warned.",
		effectiveness: ["kubectl-legendary"],
		layer: "Generic",
	},
	{
		id: "wrote-blindfolded",
		text: "Is that how you wrote it too?",
		effectiveness: ["debug-blindfolded"],
		layer: "Generic",
	},
	{
		id: "look-at-manifests",
		text: "I wouldn't want to look at your manifests either.",
		effectiveness: ["debug-blindfolded"],
		layer: "Generic",
	},
	{
		id: "network-policies-source",
		text: "Is that where you picked up your network policies?",
		effectiveness: ["security-posture-wifi"],
		layer: "Generic",
	},
	{
		id: "write-tests",
		text: "Have you ever considered writing some tests?",
		effectiveness: ["cicd-fast", "fast-deployments", "deploy-20-times"],
		layer: "Generic",
	},
	{
		id: "approve-own-prs",
		text: "Easy when you approve your own PRs.",
		effectiveness: ["gitops-smooth"],
		layer: "Generic",
	},
	{
		id: "stop-deploying",
		text: "Impressive what happens when you stop deploying.",
		effectiveness: ["services-uptime"],
		layer: "Generic",
	},
	{
		id: "feature-freeze",
		text: "Congratulations on the feature freeze.",
		effectiveness: ["services-uptime"],
		layer: "Generic",
	},
	{
		id: "incident-response",
		text: "Too bad your incident response isn't.",
		effectiveness: ["response-times"],
		layer: "Generic",
	},
	{
		id: "dude-wheres-my-car",
		text: "Shame you're watching Dude, Where's My Car?",
		effectiveness: ["observability-best"],
		layer: "Generic",
	},
	{
		id: "uptime-or-errors",
		text: "Is that uptime or your error rate?",
		effectiveness: ["seven-nines"],
		layer: "Generic",
	},
	{
		id: "blameless-postmortem",
		text: "I'm glad to hear you attended your blameless postmortem.",
		effectiveness: ["sres-competent", "engineers-ship", "monkeys-manifests"],
		layer: "Generic",
	},
	{
		id: "trace-career",
		text: "Too bad they can't trace where your career went wrong.",
		effectiveness: ["ebpf-probes", "audit-logs", "observability-best"],
		layer: "Generic",
	},
];

export function getEffectiveComebacks(insultId: string): Comeback[] {
	return comebacks.filter((c) => c.effectiveness.includes(insultId));
}

export function getRandomInsult(enemyId: string): Insult {
	const filtered = insults.filter(
		(i) => i.enemies.includes(enemyId) || i.layer === "Generic",
	);
	const insult = filtered[Math.floor(Math.random() * filtered.length)];
	if (!insult) {
		return insults[0] as Insult;
	}
	return insult;
}
