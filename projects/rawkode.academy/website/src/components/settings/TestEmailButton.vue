<script setup lang="ts">
import { academyAccount } from "@rawkodeacademy/design-system";
const account = academyAccount();

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
	<div :class="account.list">
		<p :class="account.description">
			Send yourself a quick test message to verify email delivery.
		</p>

		<div :class="account.actions">
			<button
				type="button"
				:disabled="isSending"
				@click="sendTestEmail"
				:class="account.button"
			>
				<svg
					v-if="isSending"
					:class="account.spinner"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke-width="4"></circle>
					<path class="opacity-75" d="M4 12a8 8 0 018-8" stroke-linecap="round" stroke-width="4"></path>
				</svg>
				<span>{{ isSending ? "Sending..." : "Send Test Email" }}</span>
			</button>

			<span v-if="success" role="status" :class="account.success">
				{{ success }}
			</span>
			<span v-else-if="error" role="alert" :class="account.error">
				{{ error }}
			</span>
		</div>
	</div>
</template>
