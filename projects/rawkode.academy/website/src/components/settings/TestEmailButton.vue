<script setup lang="ts">
import { css } from "styled-system/css";
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

const spaceY3 = css({ display: 'flex', flexDir: 'column', gap: '3' });
const descText = css({
	fontSize: 'sm',
	color: { base: 'neutral.600', _dark: 'neutral.400' },
});
const rowStyle = css({ display: 'flex', alignItems: 'center', gap: '3' });
const btnStyle = css({
	display: 'inline-flex',
	alignItems: 'center',
	gap: '2',
	rounded: 'lg',
	bg: 'primary',
	px: '4',
	py: '2',
	fontSize: 'sm',
	fontWeight: 'semibold',
	color: 'white',
	shadow: 'md',
	transition: 'all',
	_hover: { bg: 'primary/90' },
	_focusVisible: {
		outline: '2px solid',
		outlineColor: 'primary',
		outlineOffset: '2px',
	},
	_disabled: { cursor: 'not-allowed', opacity: '0.6' },
});
const spinnerStyle = css({ h: '4', w: '4', animation: 'spin' });
const opacity25 = css({ opacity: '0.25' });
const opacity75 = css({ opacity: '0.75' });
const successText = css({
	fontSize: 'sm',
	color: { base: 'green.600', _dark: 'green.400' },
});
const errorText = css({
	fontSize: 'sm',
	color: { base: 'red.600', _dark: 'red.400' },
});
</script>

<template>
	<div :class="spaceY3">
		<p :class="descText">
			Send yourself a quick test message to verify email delivery.
		</p>

		<div :class="rowStyle">
			<button
				type="button"
				:disabled="isSending"
				@click="sendTestEmail"
				:class="btnStyle"
			>
				<svg
					v-if="isSending"
					:class="spinnerStyle"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<circle :class="opacity25" cx="12" cy="12" r="10" stroke-width="4"></circle>
					<path :class="opacity75" d="M4 12a8 8 0 018-8" stroke-linecap="round" stroke-width="4"></path>
				</svg>
				<span>{{ isSending ? "Sending..." : "Send Test Email" }}</span>
			</button>

			<span v-if="success" :class="successText">
				{{ success }}
			</span>
			<span v-else-if="error" :class="errorText">
				{{ error }}
			</span>
		</div>
	</div>
</template>
