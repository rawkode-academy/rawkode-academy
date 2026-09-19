<script setup lang="ts">
import { Dialog } from "@ark-ui/vue/dialog";
import { computed } from "vue";
import { dialog } from "../recipes/dialog";

const props = withDefaults(
	defineProps<{
		title: string;
		description?: string;
		closeLabel?: string;
		defaultOpen?: boolean;
		size?: "sm" | "md";
		tone?: "editorial" | "academy";
		id?: string;
	}>(),
	{
		description: undefined,
		closeLabel: "Close dialog",
		defaultOpen: false,
		size: "md",
		tone: "editorial",
	},
);

const styles = computed(() => dialog({ size: props.size, tone: props.tone }));
</script>

<template>
	<Dialog.Root :id="props.id" :default-open="props.defaultOpen">
		<Dialog.Trigger :class="styles.trigger">
			<slot name="trigger">Open dialog</slot>
		</Dialog.Trigger>

		<Teleport to="body">
			<Dialog.Backdrop :class="styles.backdrop" />
			<Dialog.Positioner :class="styles.positioner">
				<Dialog.Content :class="styles.content">
					<div :class="styles.header">
						<div>
							<Dialog.Title :class="styles.title">
								{{ props.title }}
							</Dialog.Title>
							<Dialog.Description
								v-if="props.description"
								:class="styles.description"
							>
								{{ props.description }}
							</Dialog.Description>
						</div>

						<Dialog.CloseTrigger
							:class="styles.closeTrigger"
							:aria-label="props.closeLabel"
						>
							<span aria-hidden="true">×</span>
						</Dialog.CloseTrigger>
					</div>

					<div :class="styles.body">
						<slot />
					</div>

					<div v-if="$slots.footer" :class="styles.footer">
						<slot name="footer" />
					</div>
				</Dialog.Content>
			</Dialog.Positioner>
		</Teleport>
	</Dialog.Root>
</template>
