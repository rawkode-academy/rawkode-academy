/** The server clock is the only authoritative clock for timed rounds. */
export interface Clock {
	now(): number;
	iso(): string;
}

export const systemClock: Clock = {
	now: () => Date.now(),
	iso: () => new Date().toISOString(),
};

export function deadlineAfter(clock: Clock, milliseconds: number): string {
	return new Date(clock.now() + milliseconds).toISOString();
}
