<template>
	<img
		:src="src"
		:alt="alt"
		:width="width"
		:height="height"
		:loading="loading"
		:decoding="decoding"
		:fetchpriority="fetchpriority"
		:class="className"
		:sizes="computedSizes"
		:srcset="srcset"
		:style="imageStyle"
		@error="handleError"
	/>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

interface Props {
	src: string;
	alt: string;
	width?: number;
	height?: number;
	loading?: "lazy" | "eager";
	decoding?: "async" | "auto" | "sync";
	className?: string;
	sizes?: string;
	widths?: number[];
	formats?: Array<"avif" | "webp" | "png" | "jpg">;
	quality?: number;
	fetchpriority?: "high" | "low" | "auto";
	fallbackSrc?: string;
}

const props = withDefaults(defineProps<Props>(), {
	loading: "lazy",
	decoding: "async",
	className: "",
	widths: () => [320, 640, 768, 1024, 1280, 1536],
	formats: () => ["avif", "webp"],
	quality: 80,
	fetchpriority: "auto",
});

const hasError = ref(false);

const isExternal = computed(() => {
	return props.src.startsWith("http://") || props.src.startsWith("https://");
});

const aspectRatio = computed(() => {
	if (props.width && props.height) {
		return props.width / props.height;
	}
	return undefined;
});

const imageStyle = computed(() => {
	if (aspectRatio.value) {
		return {
			aspectRatio: aspectRatio.value.toString(),
			width: "100%",
			height: "auto",
		};
	}
	return undefined;
});

const computedSizes = computed(() => {
	return (
		props.sizes ||
		"(max-width: 640px) 100vw, (max-width: 768px) 90vw, (max-width: 1024px) 80vw, 1280px"
	);
});

const srcset = computed(() => {
	if (isExternal.value || !props.widths) {
		return undefined;
	}

	// For internal images, generate srcset
	// This is a simplified version - in production you'd want to integrate with your image service
	return props.widths
		.map((width) => {
			const url = generateImageUrl(props.src, width);
			return `${url} ${width}w`;
		})
		.join(", ");
});

function generateImageUrl(src: string, width: number): string {
	// This would integrate with your image transformation service
	// For now, just return the original src
	return src;
}

function handleError() {
	hasError.value = true;
	if (props.fallbackSrc) {
		props.src = props.fallbackSrc; // Update the image source to the fallback
		console.error(`Failed to load image: ${props.src}. Using fallback: ${props.fallbackSrc}`);
	} else {
		console.error(`Failed to load image: ${props.src}. No fallback provided.`);
	}
}
</script>