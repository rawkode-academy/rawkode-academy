/**
 * Centralized logging utility with environment-aware configuration.
 * Integrates with PostHog for production error tracking.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
	[key: string]: unknown;
}

interface LoggerConfig {
	minLevel: LogLevel;
	enableConsole: boolean;
	enablePostHog: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

function getConfig(): LoggerConfig {
	const isProd =
		typeof import.meta !== "undefined" &&
		(import.meta as { env?: { PROD?: boolean } }).env?.PROD === true;
	const isDev =
		typeof import.meta !== "undefined" &&
		(import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;
	const captureErrors =
		typeof import.meta !== "undefined" &&
		(import.meta as { env?: { PUBLIC_CAPTURE_ERRORS?: string } }).env
			?.PUBLIC_CAPTURE_ERRORS === "true";

	return {
		minLevel: isProd ? "warn" : "debug",
		enableConsole: isDev || typeof window === "undefined",
		enablePostHog: captureErrors,
	};
}

function shouldLog(level: LogLevel, config: LoggerConfig): boolean {
	return LOG_LEVELS[level] >= LOG_LEVELS[config.minLevel];
}

function formatMessage(scope: string | null, message: string): string {
	return scope ? `[${scope}] ${message}` : message;
}

function logToPostHog(
	level: LogLevel,
	message: string,
	error?: unknown,
	context?: LogContext,
): void {
	if (typeof window === "undefined") return;

	const posthog = (window as { posthog?: { capture: Function } }).posthog;
	if (!posthog) return;

	if (level === "error" && error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		posthog.capture("$exception", {
			$exception_message: errorObj.message,
			$exception_stack_trace_raw: errorObj.stack,
			$exception_type: errorObj.name,
			message,
			...context,
		});
	}
}

function createLogFunction(
	level: LogLevel,
	scope: string | null,
): (message: string, contextOrError?: unknown, context?: LogContext) => void {
	return (
		message: string,
		contextOrError?: unknown,
		context?: LogContext,
	): void => {
		const config = getConfig();
		if (!shouldLog(level, config)) return;

		const formattedMessage = formatMessage(scope, message);

		// Determine if second arg is error or context
		let error: unknown;
		let ctx: LogContext | undefined = context;

		if (level === "error") {
			if (
				contextOrError instanceof Error ||
				(contextOrError !== null &&
					typeof contextOrError !== "object") ||
				(typeof contextOrError === "object" &&
					contextOrError !== null &&
					"message" in contextOrError &&
					"stack" in contextOrError)
			) {
				error = contextOrError;
			} else {
				ctx = contextOrError as LogContext | undefined;
			}
		} else {
			ctx = contextOrError as LogContext | undefined;
		}

		if (config.enableConsole) {
			const consoleFn = console[level] || console.log;
			if (error) {
				consoleFn(formattedMessage, error, ctx);
			} else if (ctx) {
				consoleFn(formattedMessage, ctx);
			} else {
				consoleFn(formattedMessage);
			}
		}

		if (config.enablePostHog) {
			logToPostHog(level, formattedMessage, error, ctx);
		}
	};
}

export interface Logger {
	debug: (message: string, context?: LogContext) => void;
	info: (message: string, context?: LogContext) => void;
	warn: (message: string, context?: LogContext) => void;
	error: (
		message: string,
		errorOrContext?: unknown,
		context?: LogContext,
	) => void;
}

/**
 * Create a scoped logger instance.
 * @param scope - The scope/module name to prefix log messages with
 */
export function createLogger(scope: string): Logger {
	return {
		debug: createLogFunction("debug", scope),
		info: createLogFunction("info", scope),
		warn: createLogFunction("warn", scope),
		error: createLogFunction("error", scope),
	};
}

/**
 * Default logger instance without a scope.
 */
export const logger: Logger = {
	debug: createLogFunction("debug", null),
	info: createLogFunction("info", null),
	warn: createLogFunction("warn", null),
	error: createLogFunction("error", null),
};
