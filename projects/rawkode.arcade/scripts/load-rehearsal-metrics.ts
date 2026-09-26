export interface ProbeTarget {
	id: string;
	promptId: string;
	shardId: string;
	sentAt: number;
}

interface ProbeRecord extends ProbeTarget {
	acceptanceFinished: boolean;
	visibilityFinished: boolean;
}

export interface LatencySummary {
	completed: number;
	timedOut: number;
	lost: number;
	coverage: number;
	timeoutRate: number;
	p50Ms: number | null;
	p95Ms: number | null;
	p99Ms: number | null;
	maxMs: number | null;
	latencyHistogramMs: Record<string, number>;
}

export interface ProbeSummary {
	sent: number;
	rejected: number;
	pending: number;
	acceptance: LatencySummary;
	aggregateCommitVisibility: LatencySummary;
}

interface StageCounters {
	latencies: number[];
	timedOut: number;
}

function percentile(sorted: number[], fraction: number): number | null {
	if (sorted.length === 0) return null;
	return sorted[Math.ceil(sorted.length * fraction) - 1] ?? null;
}

function rounded(value: number | null): number | null {
	return value === null ? null : Math.round(value * 100) / 100;
}

function histogram(values: number[]): Record<string, number> {
	const result: Record<string, number> = {};
	for (const value of values) {
		const bucket = String(Math.max(0, Math.ceil(value)));
		result[bucket] = (result[bucket] ?? 0) + 1;
	}
	return result;
}

function summarizeStage(
	stage: StageCounters,
	sent: number,
	rejected: number,
): LatencySummary {
	const sorted = [...stage.latencies].sort((left, right) => left - right);
	const completed = sorted.length;
	return {
		completed,
		timedOut: stage.timedOut,
		lost: Math.max(0, sent - completed - stage.timedOut - rejected),
		coverage: sent === 0 ? 0 : completed / sent,
		timeoutRate: sent === 0 ? 1 : stage.timedOut / sent,
		p50Ms: rounded(percentile(sorted, 0.5)),
		p95Ms: rounded(percentile(sorted, 0.95)),
		p99Ms: rounded(percentile(sorted, 0.99)),
		maxMs: rounded(sorted.at(-1) ?? null),
		latencyHistogramMs: histogram(stage.latencies),
	};
}

/**
 * Correlates the two observable milestones for a vote without treating either
 * as evidence that every audience socket has received a later public snapshot.
 */
export class ProbeLedger {
	private readonly records = new Map<string, ProbeRecord>();
	private readonly acceptance: StageCounters = { latencies: [], timedOut: 0 };
	private readonly visibility: StageCounters = { latencies: [], timedOut: 0 };
	private sent = 0;
	private rejected = 0;

	register(target: ProbeTarget): void {
		if (this.records.has(target.id)) {
			throw new Error(`probe ${target.id} is already registered`);
		}
		this.sent += 1;
		this.records.set(target.id, {
			...target,
			acceptanceFinished: false,
			visibilityFinished: false,
		});
	}

	recordAccepted(id: string, now: number): boolean {
		const record = this.records.get(id);
		if (!record || record.acceptanceFinished) return false;
		record.acceptanceFinished = true;
		this.acceptance.latencies.push(Math.max(0, now - record.sentAt));
		this.removeFinished(record);
		return true;
	}

	recordAggregateVisible(
		ids: readonly string[],
		promptId: string,
		shardId: string,
		now: number,
	): number {
		let recorded = 0;
		for (const id of ids) {
			const record = this.records.get(id);
			if (
				!record ||
				record.visibilityFinished ||
				record.promptId !== promptId ||
				record.shardId !== shardId
			) {
				continue;
			}
			record.visibilityFinished = true;
			this.visibility.latencies.push(Math.max(0, now - record.sentAt));
			this.removeFinished(record);
			recorded += 1;
		}
		return recorded;
	}

	recordRejected(id: string): boolean {
		const record = this.records.get(id);
		if (!record) return false;
		this.rejected += 1;
		this.records.delete(id);
		return true;
	}

	recordAcceptanceTimeout(id: string): boolean {
		const record = this.records.get(id);
		if (!record || record.acceptanceFinished) return false;
		record.acceptanceFinished = true;
		this.acceptance.timedOut += 1;
		this.removeFinished(record);
		return true;
	}

	recordVisibilityTimeout(id: string): boolean {
		const record = this.records.get(id);
		if (!record || record.visibilityFinished) return false;
		record.visibilityFinished = true;
		this.visibility.timedOut += 1;
		this.removeFinished(record);
		return true;
	}

	hasPending(id: string): boolean {
		return this.records.has(id);
	}

	summary(): ProbeSummary {
		return {
			sent: this.sent,
			rejected: this.rejected,
			pending: this.records.size,
			acceptance: summarizeStage(this.acceptance, this.sent, this.rejected),
			aggregateCommitVisibility: summarizeStage(
				this.visibility,
				this.sent,
				this.rejected,
			),
		};
	}

	private removeFinished(record: ProbeRecord): void {
		if (record.acceptanceFinished && record.visibilityFinished) {
			this.records.delete(record.id);
		}
	}
}
