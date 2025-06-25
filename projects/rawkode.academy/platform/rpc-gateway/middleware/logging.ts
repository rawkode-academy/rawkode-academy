import type { Context, Next } from "hono";

interface LogEntry {
	timestamp: string;
	method: string;
	path: string;
	service?: string;
	resource?: string;
	status?: number;
	duration?: number;
	error?: unknown;
}

export async function logging(c: Context<{ Bindings: Env }>, next: Next) {
	const start = Date.now();
	const logEntry: LogEntry = {
		timestamp: new Date().toISOString(),
		method: c.req.method,
		path: new URL(c.req.url).pathname,
	};

	try {
		await next();

		const duration = Date.now() - start;
		const rpcRequest = c.get("rpcRequest");

		if (rpcRequest) {
			logEntry.service = rpcRequest.service;
			logEntry.resource = rpcRequest.resource;
		}

		logEntry.status = c.res.status;
		logEntry.duration = duration;

		console.log(JSON.stringify(logEntry));
	} catch (error) {
		logEntry.error = error instanceof Error ? error.message : String(error);
		logEntry.duration = Date.now() - start;
		console.error(JSON.stringify(logEntry));
		throw error;
	}
}
