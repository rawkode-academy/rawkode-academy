// Operations for AI: the first paid, live cohort. Everything the sales page,
// the checkout endpoint and the invoice-request action need lives here, so a
// schedule or price change is a one-file edit.
//
// This module has no imports so tests can load it directly.

export interface CohortSchedule {
	/** ISO date of the first live session, or null until it is confirmed. */
	startDate: string | null;
	/** Shown while startDate is null. */
	startLabel: string;
	/** e.g. "Thursdays, 17:00–19:00 UK time". null until confirmed. */
	sessionSlot: string | null;
	weeks: number;
}

export interface CurriculumWeek {
	week: number;
	title: string;
	summary: string;
	topics: string[];
	lab: string;
}

export interface Faq {
	question: string;
	answer: string;
}

export const COHORT_ID = "operations-for-ai";
export const COHORT_PATH = `/courses/${COHORT_ID}`;
export const COHORT_EMAIL = "david@rawkode.academy";

// Six Tuesday sessions from 12 January 2027. 17:00 UK time (GMT in Jan/Feb)
// is evening in Europe, 12:00 in New York and 09:00 in San Francisco.
// The page says "dates confirmed by …" while startDate or sessionSlot is null.
export const schedule: CohortSchedule = {
	startDate: "2027-01-12",
	startLabel: "January 2027",
	sessionSlot: "Tuesdays, 17:00–19:00 UK time",
	weeks: 6,
};

/** One live session per curriculum week, 17:00–19:00 UTC (UK time in winter). */
export const sessionDates = [
	"2027-01-12",
	"2027-01-19",
	"2027-01-26",
	"2027-02-02",
	"2027-02-09",
	"2027-02-16",
] as const;
export const SESSION_START_UTC = "17:00";
export const SESSION_LENGTH_MINUTES = 120;

export const SCHEDULE_CONFIRMED_BY = "15 November 2026";

export const offer = {
	title: "Operations for AI",
	// The cohort the next checkout sells; Stripe metadata and Attio deals use it.
	intakeId: "operations-for-ai-2027-01",
	priceUsd: 1500,
	seats: 20,
	maxSeatsPerOrder: 5,
	// "open" sells seats; "sold-out" swaps checkout for the waitlist.
	status: "open" as "open" | "sold-out",
} as const;

// The two-sentence abstract David approved on 18 Sep 2026.
export const abstract =
	"Run AI workloads on Kubernetes end to end: schedule GPUs, execute distributed training jobs, serve models as production inference services, and instrument all of it with the observability to know what a GPU is costing you per token.";
export const audience =
	"For platform engineers who already run Kubernetes and now have to run it for AI.";

export const outcome =
	"After six weeks you can run training and inference on Kubernetes the way you run everything else: GPU-scheduled, autoscaled, observable, and costed per token, on any cluster, with no proprietary tooling on the critical path.";

export const curriculum: CurriculumWeek[] = [
	{
		week: 1,
		title: "GPUs as a Kubernetes resource",
		summary:
			"Make GPUs schedulable, shareable and accountable before any model touches them.",
		topics: [
			"Device plugin, GPU Operator and node feature discovery",
			"MIG and time-slicing: when to partition and what it costs you",
			"Taints, quotas and priority classes for GPU node pools",
		],
		lab: "Turn a bare GPU node pool into a shared, quota-controlled platform.",
	},
	{
		week: 2,
		title: "Training jobs that survive production",
		summary:
			"Run distributed training as a batch workload you can queue, preempt and resume.",
		topics: [
			"Distributed PyTorch jobs with JobSet and the Kubeflow Trainer",
			"Gang scheduling and fair sharing with Kueue",
			"Checkpointing to object storage, preemption and resume",
		],
		lab: "Fine-tune an open-weights model, kill a node mid-run and resume from checkpoint.",
	},
	{
		week: 3,
		title: "Serving models",
		summary:
			"Take the model you trained to an inference service with real traffic.",
		topics: [
			"vLLM-class serving runtimes and KServe",
			"Loading weights fast: storage patterns, caching and image strategy",
			"Rollouts, canaries and rollback for model versions",
		],
		lab: "Serve your fine-tuned model behind a production endpoint.",
	},
	{
		week: 4,
		title: "Scaling inference",
		summary: "Scale on the signals that matter for LLMs, not CPU.",
		topics: [
			"Request- and queue-based autoscaling with KEDA",
			"Cold starts, scale to zero and when it stops paying",
			"Batching, concurrency limits and load shedding",
		],
		lab: "Load-test your endpoint and tune it until it holds its latency target.",
	},
	{
		week: 5,
		title: "Observability for AI workloads",
		summary:
			"Know what your GPUs and models are doing, and when they're about to stop.",
		topics: [
			"GPU telemetry with DCGM and Prometheus",
			"Latency and throughput SLOs: time to first token, tokens per second",
			"Tracing a request through the serving stack; training job telemetry",
		],
		lab: "Build the dashboards and alerts you'd want on call for this platform.",
	},
	{
		week: 6,
		title: "Cost, and the capstone",
		summary: "Put a number on every token and prove the platform holds up.",
		topics: [
			"A per-token cost model you build from your own metrics",
			"Utilisation, right-sizing and the idle GPU problem",
			"Capstone: a production deployment reviewed against a written rubric",
		],
		lab: "Ship the capstone and defend your cost model.",
	},
];

export const format = [
	{
		label: "Live sessions",
		detail:
			"One live session each week with David. Every session is recorded for anyone who misses it.",
	},
	{
		label: "GPU labs",
		detail:
			"Hands-on labs on real GPU clusters every week. Lab access is included in the seat price.",
	},
	{
		label: "Small group",
		detail: `At most ${offer.seats} engineers, so every question gets answered and every capstone gets a real review.`,
	},
	{
		label: "Capstone and certificate",
		detail:
			"Your capstone is reviewed against a written production rubric. Pass it and you get a certificate.",
	},
];

export const prerequisites = [
	"You deploy and debug workloads on Kubernetes today: kubectl, Helm, manifests and logs.",
	"You can read Python well enough to follow a training script.",
	"No machine learning background is needed. You operate models here; you don't design them.",
];

export const notFor = [
	"You're new to Kubernetes. Start with the free courses and come back.",
	"You want to learn how to build or train models from scratch. This course is about running them.",
];

export const disclosure =
	"David works as a solutions architect at CoreWeave, a GPU cloud provider. This course is independent of CoreWeave and every other vendor: the labs run on any Kubernetes cluster with NVIDIA GPUs, and no provider has any say over the curriculum.";

// TODO(David): confirm the refund policy before launch. UK consumer
// cancellation rules may apply to individual buyers; check with an adviser.
export const refundPolicy =
	"If the cohort doesn't run, you get a full refund. You can also cancel for a full refund until 29 December 2026, two weeks before the first session.";

export const faqs: Faq[] = [
	{
		question: "Can my employer pay?",
		answer:
			"Yes, most seats are paid this way. Pay by card and the receipt and invoice go straight to your expenses, or request an invoice below and your company pays by bank transfer. There's an approval email you can send to your manager on this page.",
	},
	{
		question: "How much time does it take each week?",
		answer:
			"Plan for about five hours a week: the live session plus the lab. The labs stay open between sessions, so you can do them when it suits you.",
	},
	{
		question: "Do I need my own GPUs?",
		answer:
			"No. GPU lab access is included. Everything you build also runs on your own clusters, because nothing in the course depends on one provider.",
	},
	{
		question: "What if I miss a live session?",
		answer:
			"Every session is recorded and posted the same day, and questions carry over to the next session and the cohort chat.",
	},
	{
		question: "Is this the same as the free content?",
		answer:
			"No. The free videos stay free. The cohort is live teaching, GPU labs, a reviewed capstone and a small group working through the same problems at the same time.",
	},
	{
		question: "Can you run this privately for my team?",
		answer:
			"Yes. Private cohorts run on your schedule and can use your own clusters. Request an invoice below and choose the private cohort option, or email David.",
	},
	{
		question: "What's the refund policy?",
		answer: refundPolicy,
	},
];

// Agentic Operations runs as a waitlist (decided 18 Sep 2026).
export const nextCourse = {
	title: "Agentic Operations",
	abstract:
		"Debug real broken production clusters with an agent as your partner: feed it the right context, make it gather evidence instead of guess, and catch it when it's confident and wrong. For SREs and platform engineers who'll be the human in the loop the next time the pager goes.",
};

export const formatUsd = (amount: number) =>
	new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(amount);

/** "Starts 13 January 2027" once confirmed, otherwise "Starts January 2027". */
export const startsLabel = (value: CohortSchedule = schedule) => {
	if (!value.startDate) return `Starts ${value.startLabel}`;
	const date = new Date(`${value.startDate}T00:00:00Z`);
	return `Starts ${new Intl.DateTimeFormat("en-GB", {
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	}).format(date)}`;
};

export const scheduleConfirmed = (value: CohortSchedule = schedule) =>
	value.startDate !== null && value.sessionSlot !== null;

/** Seats allowed in one checkout, clamped to the per-order cap. */
export const clampSeats = (value: unknown): number => {
	const parsed =
		typeof value === "number" ? value : Number.parseInt(String(value), 10);
	if (!Number.isFinite(parsed) || parsed < 1) return 1;
	return Math.min(Math.trunc(parsed), offer.maxSeatsPerOrder);
};

/** The email a learner sends their manager to get the seat approved. */
export const approvalEmail = {
	subject: `Training request: ${offer.title} (Rawkode Academy)`,
	body: [
		"Hi,",
		"",
		`I'd like to take ${offer.title}, a ${schedule.weeks}-week live cohort from Rawkode Academy that teaches how to run AI training and inference on Kubernetes.`,
		"",
		"What I'll be able to do afterwards:",
		"- Schedule and share GPUs across teams",
		"- Run distributed training jobs that survive preemption",
		"- Serve and autoscale models in production",
		"- Measure GPU cost per token and cut idle spend",
		"",
		`Cost: ${formatUsd(offer.priceUsd)} per seat, including GPU lab access. Rawkode Academy can invoice the company directly.`,
		`Time: about five hours a week for ${schedule.weeks} weeks, ${startsLabel().toLowerCase()}.`,
		"",
		`Details: https://rawkode.academy${COHORT_PATH}`,
		"",
		"Thanks,",
	].join("\n"),
};

export const approvalMailto = `mailto:?subject=${encodeURIComponent(approvalEmail.subject)}&body=${encodeURIComponent(approvalEmail.body)}`;
