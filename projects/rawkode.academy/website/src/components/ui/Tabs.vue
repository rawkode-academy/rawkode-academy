<template>
	<Tabs.Root v-model:value="activeValue" :class="classes.root" :default-value="defaultValue">
		<Tabs.List :class="classes.list">
			<Tabs.Trigger
				v-for="tab in tabs"
				:key="tab.value"
				:value="tab.value"
				:disabled="tab.disabled"
				:class="classes.trigger"
			>
				{{ tab.label }}
			</Tabs.Trigger>
			<Tabs.Indicator :class="classes.indicator" />
		</Tabs.List>
		<Tabs.Content
			v-for="tab in tabs"
			:key="tab.value"
			:value="tab.value"
			:class="classes.content"
		>
			<slot :name="tab.value" />
		</Tabs.Content>
	</Tabs.Root>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Tabs } from "@ark-ui/vue/tabs";
import { tabs as tabsRecipe } from "../../../styled-system/recipes";

export interface TabItem {
	value: string;
	label: string;
	disabled?: boolean;
}

const props = withDefaults(
	defineProps<{
		tabs: TabItem[];
		modelValue?: string;
		defaultValue?: string;
	}>(),
	{},
);
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const activeValue = computed({
	get: () => props.modelValue,
	set: (v) => emit("update:modelValue", v ?? ""),
});

const classes = computed(() => tabsRecipe());
</script>
