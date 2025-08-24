import { type Ref, ref, watch } from "vue";

export function useDebounce<T>(value: Ref<T>, delay = 300): Ref<T> {
	const debouncedValue = ref<T>(value.value) as Ref<T>;
	let timeoutId: NodeJS.Timeout | null = null;

	watch(value, (newValue) => {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}

		timeoutId = setTimeout(() => {
			debouncedValue.value = newValue;
		}, delay);
	});

	return debouncedValue;
}
