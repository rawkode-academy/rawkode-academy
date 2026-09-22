<script setup lang="ts">
import { Tabs as ArkTabs } from "@ark-ui/vue/tabs";
import { computed } from "vue";
import { tabs } from "../recipes/tabs";

interface TabItem {
	value: string;
	label: string;
}

const props = withDefaults(
	defineProps<{
		items: TabItem[];
		defaultValue?: string;
		modelValue?: string;
		ariaLabel?: string;
		id?: string;
	}>(),
	{
		defaultValue: undefined,
		ariaLabel: "Content sections",
	},
);

const styles = computed(() => tabs({ tone: "academy" }));
const emit = defineEmits<{
	"update:modelValue": [value: string];
	valueChange: [value: string];
}>();

const handleValueChange = (details: { value: string }) => {
	emit("update:modelValue", details.value);
	emit("valueChange", details.value);
};
</script>

<template>
	<ArkTabs.Root
		:id="props.id"
		:default-value="props.defaultValue ?? props.items[0]?.value"
		:value="props.modelValue"
		:class="styles.root"
		@value-change="handleValueChange"
	>
		<ArkTabs.List :class="styles.list" :aria-label="props.ariaLabel">
			<ArkTabs.Trigger
				v-for="item in props.items"
				:key="item.value"
				:value="item.value"
				:class="styles.trigger"
			>
				{{ item.label }}
			</ArkTabs.Trigger>
			<ArkTabs.Indicator :class="styles.indicator" />
		</ArkTabs.List>

		<ArkTabs.Content
			v-for="item in props.items"
			:key="item.value"
			:value="item.value"
			:class="styles.content"
		>
			<slot :name="item.value" :item="item" />
		</ArkTabs.Content>
	</ArkTabs.Root>
</template>
