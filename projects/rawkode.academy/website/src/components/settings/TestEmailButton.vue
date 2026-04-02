<script setup lang="ts">
import { css } from "../../../styled-system/css";
import { ref } from "vue";
import { actions } from "astro:actions";

const isSending = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);

const sendTestEmail = async () => {
	if (isSending.value) return;

	isSending.value = true;
	error.value = null;
	success.value = null;

	try {
		const { error: actionError } = await actions.email.sendTest({});

		if (actionError) {
			throw new Error(actionError.message);
		}

		success.value = "Test email sent. Check your inbox.";
	} catch (err: unknown) {
		error.value =
			err instanceof Error ? err.message : "Failed to send test email.";
	} finally {
		isSending.value = false;
	}
};
</script>

<template>
	<div :class="css({ display: 'flex', flexDir: 'column', gap: '3' })">
		<p :class="css({ fontSize: 'sm', color: { base: 'neutral.600', _dark: 'neutral.400' } })">
			Send yourself a quick test message to verify email delivery.
		</p>

		<div :class="css({ display: 'flex', alignItems: 'center', gap: '3' })">
			<button
				type="button"
				:disabled="isSending"
				@click="sendTestEmail"
				:class="css({ display: 'inline-flex', alignItems: 'center', gap: '2', rounded: 'lg', bg: 'primary', px: '4', py: '2', fontSize: 'sm', fontWeight: 'semibold', color: 'white', shadow: 'md', shadowColor: 'primary/30', transition: 'all', _hover: { bg: 'primary/90' }, _focusVisible: { outline: '2px solid', outlineOffset: '2px', outlineColor: 'primary' }, _disabled: { cursor: 'not-allowed', opacity: '0.6' } })"
			>
				<svg
					v-if="isSending"
					:class="css({ h: '4', w: '4', animation: 'spin' })"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<circle :class="css({ opacity: '0.25' })" cx="12" cy="12" r="10" stroke-width="4"></circle>
					<path :class="css({ opacity: '0.75' })" d="M4 12a8 8 0 018-8" stroke-linecap="round" stroke-width="4"></path>
				</svg>
				<span>{{ isSending ? "Sending..." : "Send Test Email" }}</span>
			</button>

			<span v-if="success" :class="css({ fontSize: 'sm', color: { base: 'green.600', _dark: 'green.400' } })">
				{{ success }}
			</span>
			<span v-else-if="error" :class="css({ fontSize: 'sm', color: { base: 'red.600', _dark: 'red.400' } })">
				{{ error }}
			</span>
		</div>
	</div>
</template>
