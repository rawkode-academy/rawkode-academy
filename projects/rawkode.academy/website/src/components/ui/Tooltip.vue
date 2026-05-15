<template>
	<Tooltip.Root :open-delay="openDelay" :close-delay="closeDelay">
		<Tooltip.Trigger as-child>
			<slot name="trigger" />
		</Tooltip.Trigger>
		<Teleport to="body">
			<Tooltip.Positioner :class="classes.positioner">
				<Tooltip.Content :class="classes.content">
					<slot />
				</Tooltip.Content>
			</Tooltip.Positioner>
		</Teleport>
	</Tooltip.Root>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Tooltip } from "@ark-ui/vue/tooltip";
import { tooltip } from "../../../styled-system/recipes";

withDefaults(
	defineProps<{ openDelay?: number; closeDelay?: number }>(),
	{ openDelay: 200, closeDelay: 100 },
);

const classes = computed(() => tooltip());
</script>
