import { ref, type Ref, onMounted, onUnmounted } from "vue";
import { getErrorMessage, logError } from "@/utils/error-handler";

interface UseAsyncDataOptions {
	immediate?: boolean;
	onError?: (error: unknown) => void;
	retryDelay?: number;
	maxRetries?: number;
}

interface UseAsyncDataReturn<T> {
	data: Ref<T | null>;
	loading: Ref<boolean>;
	error: Ref<string | null>;
	execute: () => Promise<void>;
	retry: () => Promise<void>;
}

export function useAsyncData<T>(
	fetcher: () => Promise<T>,
	options: UseAsyncDataOptions = {},
): UseAsyncDataReturn<T> {
	const {
		immediate = true,
		onError,
		retryDelay = 1000,
		maxRetries = 0,
	} = options;

	const data = ref<T | null>(null);
	const loading = ref(false);
	const error = ref<string | null>(null);

	let retryCount = 0;
	let abortController: AbortController | null = null;

	const execute = async (): Promise<void> => {
		// Cancel any pending requests
		if (abortController) {
			abortController.abort();
		}

		loading.value = true;
		error.value = null;
		abortController = new AbortController();

		try {
			const result = await fetcher();

			// Check if request was aborted
			if (abortController.signal.aborted) {
				return;
			}

			data.value = result;
			retryCount = 0; // Reset retry count on success
		} catch (err) {
			// Ignore aborted requests
			if (err instanceof Error && err.name === "AbortError") {
				return;
			}

			const errorMessage = getErrorMessage(err);
			error.value = errorMessage;

			logError(err, {
				component: "useAsyncData",
				retryCount,
				maxRetries,
			});

			if (onError) {
				onError(err);
			}

			// Auto-retry if configured
			if (retryCount < maxRetries) {
				retryCount++;
				setTimeout(() => {
					execute();
				}, retryDelay * retryCount); // Exponential backoff
			}
		} finally {
			if (!abortController?.signal.aborted) {
				loading.value = false;
			}
		}
	};

	const retry = async (): Promise<void> => {
		retryCount = 0;
		await execute();
	};

	if (immediate) {
		onMounted(() => {
			execute();
		});
	}

	onUnmounted(() => {
		// Cancel any pending requests when component unmounts
		if (abortController) {
			abortController.abort();
		}
	});

	return {
		data: data as Ref<T | null>,
		loading,
		error,
		execute,
		retry,
	};
}
