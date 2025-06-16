import { ref, onMounted, onUnmounted, type Ref } from "vue";

interface UseIntersectionObserverOptions extends IntersectionObserverInit {
	immediate?: boolean;
}

interface UseIntersectionObserverReturn {
	isIntersecting: Ref<boolean>;
	stop: () => void;
}

export function useIntersectionObserver(
	target: Ref<Element | null>,
	callback?: (entries: IntersectionObserverEntry[]) => void,
	options: UseIntersectionObserverOptions = {},
): UseIntersectionObserverReturn {
	const { immediate = true, ...observerOptions } = options;
	const isIntersecting = ref(false);
	let observer: IntersectionObserver | null = null;

	const stop = (): void => {
		if (observer) {
			observer.disconnect();
			observer = null;
		}
	};

	const start = (): void => {
		stop();

		if (!target.value) return;

		observer = new IntersectionObserver((entries) => {
			isIntersecting.value = entries.some((entry) => entry.isIntersecting);

			if (callback) {
				callback(entries);
			}
		}, observerOptions);

		observer.observe(target.value);
	};

	onMounted(() => {
		if (immediate) {
			start();
		}
	});

	onUnmounted(() => {
		stop();
	});

	return {
		isIntersecting,
		stop,
	};
}
