export const MAX_GUESSES = 6;
export type Mark = "correct" | "present" | "absent";
export interface Answer { name: string; kind: string; description: string; url: string }
// Frozen v1 schedule: never reorder. Introduce a new version/epoch to expand.
export const ANSWERS: Answer[] = [
	{ name: "Helm", kind: "CNCF project", description: "The package manager for Kubernetes.", url: "https://helm.sh" },
	{ name: "Ingress", kind: "Cloud native term", description: "Routes external HTTP traffic to services in a cluster.", url: "https://kubernetes.io/docs/concepts/services-networking/ingress/" },
	{ name: "Clusternet", kind: "CNCF Sandbox project", description: "Manages applications across multiple Kubernetes clusters.", url: "https://clusternet.io" },
	{ name: "Cilium", kind: "CNCF project", description: "Networking, security, and observability powered by eBPF.", url: "https://cilium.io" },
	{ name: "Sidecar", kind: "Cloud native term", description: "A helper container running alongside an application in a Pod.", url: "https://kubernetes.io/docs/concepts/workloads/pods/sidecar-containers/" },
	{ name: "KubeStellar", kind: "CNCF Sandbox project", description: "Distributes Kubernetes resources across clusters.", url: "https://kubestellar.io" },
	{ name: "Kyverno", kind: "CNCF project", description: "A Kubernetes policy engine for validation, mutation, and generation.", url: "https://kyverno.io" },
	{ name: "Namespace", kind: "Cloud native term", description: "Scopes names and organizes resources within a cluster.", url: "https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/" },
	{ name: "Microcks", kind: "CNCF Incubating project", description: "Mocks and tests APIs and event-driven services.", url: "https://microcks.io" },
	{ name: "Prometheus", kind: "CNCF project", description: "Collects metrics and evaluates queries and alerting rules.", url: "https://prometheus.io" },
	{ name: "Service Mesh", kind: "Cloud native term", description: "An infrastructure layer managing communication between services.", url: "https://glossary.cncf.io/service-mesh/" },
	{ name: "Inspektor Gadget", kind: "CNCF Sandbox project", description: "eBPF tools for inspecting Linux and Kubernetes workloads.", url: "https://inspektor-gadget.io" },
	{ name: "Envoy", kind: "CNCF project", description: "A high-performance proxy for cloud native networking.", url: "https://envoyproxy.io" },
	{ name: "Deployment", kind: "Cloud native term", description: "Manages declarative updates and replicas for stateless workloads.", url: "https://kubernetes.io/docs/concepts/workloads/controllers/deployment/" },
	{ name: "KubeArmor", kind: "CNCF Sandbox project", description: "Enforces runtime security policies for workloads.", url: "https://kubearmor.io" },
	{ name: "Linkerd", kind: "CNCF project", description: "A service mesh providing security, reliability, and observability.", url: "https://linkerd.io" },
	{ name: "GitOps", kind: "Cloud native term", description: "Uses version-controlled desired state and automated reconciliation.", url: "https://glossary.cncf.io/gitops/" },
	{ name: "Paralus", kind: "CNCF Sandbox project", description: "Manages secure access to Kubernetes clusters.", url: "https://paralus.io" },
];
export const normalize = (value: string) => value.toUpperCase().replace(/[^A-Z]/g, "");
// Cut raw input after its `length`th letter, keeping the player's spaces and punctuation.
export function clampGuess(value: string, length: number) {
	let letters = 0;
	for (let i = 0; i < value.length; i++) {
		if (!/[a-z]/i.test(value[i]!)) continue;
		if (letters === length) return value.slice(0, i);
		letters++;
	}
	return value;
}
export const dayKey =(date = new Date()) => date.toISOString().slice(0, 10);
export function dailyPuzzle(date = new Date()) {
	const day = Math.floor((Date.parse(`${dayKey(date)}T00:00:00Z`) - Date.UTC(2026, 9, 13)) / 86400000);
	return { date: dayKey(date), answer: ANSWERS[((day % 18) + 18) % 18]! };
}
export function markGuess(guess: string, answer: string): Mark[] {
	const letters = normalize(guess), target = normalize(answer);
	if (letters.length !== target.length) throw new Error("Guess must match answer length.");
	const marks: Mark[] = Array(letters.length).fill("absent");
	const remaining = target.split("");
	for (let i = 0; i < letters.length; i++) if (letters[i] === target[i]) { marks[i] = "correct"; remaining[i] = ""; }
	for (let i = 0; i < letters.length; i++) {
		if (marks[i] === "correct") continue;
		const index = remaining.indexOf(letters[i]!);
		if (index !== -1) { marks[i] = "present"; remaining[index] = ""; }
	}
	return marks;
}
export function restoreGuesses(raw: string | null, answer: string): string[] {
	try {
		const parsed: unknown = JSON.parse(raw ?? "null");
		if (!Array.isArray(parsed) || parsed.length > MAX_GUESSES) return [];
		const target = normalize(answer), guesses: string[] = [];
		for (const value of parsed) {
			if (typeof value !== "string" || !/^[A-Z]+$/.test(value) || value.length !== target.length || guesses.includes(value) || guesses.includes(target)) return [];
			guesses.push(value);
		}
		return guesses;
	} catch { return []; }
}
export function shareResult(date: string, guesses: string[], answer: string) {
	const icons = { correct: "🟩", present: "🟨", absent: "⬛" };
	return `Kubele ${date} ${guesses.includes(normalize(answer)) ? guesses.length : "X"}/${MAX_GUESSES}\n${guesses.map(guess => markGuess(guess, answer).map(mark => icons[mark]).join("")).join("\n")}\nhttps://rawkode.academy/games/kubele`;
}
