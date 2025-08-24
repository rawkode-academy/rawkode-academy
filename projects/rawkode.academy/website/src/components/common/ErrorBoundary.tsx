import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
	children: ReactNode;
	fallback?: (error: Error, resetError: () => void) => ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		console.error("ErrorBoundary caught an error:", error, errorInfo);

		// Log to monitoring service if available
		if (typeof window !== "undefined" && window.GrafanaFaroWebSdk?.faro) {
			window.GrafanaFaroWebSdk.faro.api.pushError(error, {
				context: {
					componentStack: errorInfo.componentStack,
				},
			});
		}
	}

	resetError = (): void => {
		this.setState({ hasError: false, error: null });
	};

	override render(): ReactNode {
		if (this.state.hasError && this.state.error) {
			if (this.props.fallback) {
				return this.props.fallback(this.state.error, this.resetError);
			}

			return (
				<div className="flex flex-col items-center justify-center min-h-[400px] p-8">
					<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md w-full">
						<h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
							Something went wrong
						</h2>
						<p className="text-sm text-red-700 dark:text-red-300 mb-4">
							{this.state.error.message || "An unexpected error occurred"}
						</p>
						<button
							type="button"
							onClick={this.resetError}
							className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
						>
							Try again
						</button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

// Named export for compatibility
export { ErrorBoundary };
