export const KUBETRACK_EVENTS = {
	FLIPBOOK_STARTED: "kubetrack_flipbook_started",
	CARD_VIEWED: "kubetrack_card_viewed",
	FLIPBOOK_COMPLETED: "kubetrack_flipbook_completed",
	VIEW_MODE_CHANGED: "kubetrack_view_mode_changed",
	QUIZ_STARTED: "kubetrack_quiz_started",
	QUESTION_ANSWERED: "kubetrack_question_answered",
	QUIZ_COMPLETED: "kubetrack_quiz_completed",
	QUIZ_RETRY: "kubetrack_quiz_retry",
	REVIEW_CARD_CLICKED: "kubetrack_review_card_clicked",
	RESULT_SHARED: "kubetrack_result_shared",
	CTA_CLICKED: "kubetrack_cta_clicked",
} as const;

type KubeTrackEvent = (typeof KUBETRACK_EVENTS)[keyof typeof KUBETRACK_EVENTS];

/** Every KubeTrack event carries the release it happened on. */
type KubeTrackEventProps = { release: string } & Record<string, unknown>;

type Capture = (
	eventName: string,
	properties?: Record<string, unknown>,
) => void;

const capture = (): Capture | undefined =>
	(window as Window & { posthog?: { capture?: Capture } }).posthog?.capture;

// PostHog is created after load and the first interaction or idle callback,
// so events from early in the page wait here until it exists.
const pending: [KubeTrackEvent, KubeTrackEventProps][] = [];
const FLUSH_INTERVAL_MS = 1000;
const FLUSH_ATTEMPTS = 60;
let flushTimer: ReturnType<typeof setInterval> | undefined;

function send(fn: Capture, event: KubeTrackEvent, props: KubeTrackEventProps) {
	try {
		fn(event, props);
	} catch {
		// Ignore tracking errors on the client.
	}
}

function scheduleFlush() {
	if (flushTimer !== undefined) return;
	let attempts = 0;
	flushTimer = setInterval(() => {
		const fn = capture();
		if (fn)
			for (const [event, props] of pending.splice(0)) send(fn, event, props);
		if (fn || ++attempts >= FLUSH_ATTEMPTS) {
			pending.length = 0;
			clearInterval(flushTimer);
			flushTimer = undefined;
		}
	}, FLUSH_INTERVAL_MS);
}

export function track(event: KubeTrackEvent, props: KubeTrackEventProps): void {
	const fn = capture();
	if (fn) {
		send(fn, event, props);
		return;
	}
	pending.push([event, props]);
	scheduleFlush();
}
