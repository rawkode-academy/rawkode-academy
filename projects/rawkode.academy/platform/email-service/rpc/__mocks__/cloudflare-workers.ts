export class WorkerEntrypoint<T = unknown> {
	env: T;

	constructor() {
		this.env = {} as T;
	}
}
