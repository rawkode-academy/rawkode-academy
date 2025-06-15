<template>
  <div :class="['flex items-center space-x-2', className]">
    <svg
      v-if="showIcon"
      xmlns="http://www.w3.org/2000/svg"
      class="h-4 w-4 text-purple-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
    <time
      :datetime="date.toISOString()"
      class="text-xs font-normal text-gray-500 dark:text-gray-400"
    >
      {{ formattedDate }}
    </time>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
	date: Date;
	format?: "short" | "long" | "full";
	showIcon?: boolean;
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	format: "short",
	showIcon: false,
	class: "",
});

const formatOptions: Record<
	"short" | "long" | "full",
	Intl.DateTimeFormatOptions
> = {
	short: {
		year: "numeric",
		month: "short",
		day: "numeric",
	},
	long: {
		year: "numeric",
		month: "long",
		day: "numeric",
	},
	full: {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	},
};

const formattedDate = computed(() => {
	return new Intl.DateTimeFormat("en-US", formatOptions[props.format]).format(
		props.date,
	);
});

const className = props.class;
</script>