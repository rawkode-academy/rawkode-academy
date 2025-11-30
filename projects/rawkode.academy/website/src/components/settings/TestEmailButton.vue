<script setup lang="ts">
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
	<div class="space-y-3">
		<p class="text-sm text-neutral-600 dark:text-neutral-400">
			Send yourself a quick test message to verify email delivery.
		</p>

		<div class="flex items-center gap-3">
			<button
				type="button"
				:disabled="isSending"
				@click="sendTestEmail"
				class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/30 transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
			>
				<svg
					v-if="isSending"
					class="h-4 w-4 animate-spin"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke-width="4"></circle>
					<path class="opacity-75" d="M4 12a8 8 0 018-8" stroke-linecap="round" stroke-width="4"></path>
				</svg>
				<span>{{ isSending ? "Sending..." : "Send Test Email" }}</span>
			</button>

			<span v-if="success" class="text-sm text-green-600 dark:text-green-400">
				{{ success }}
			</span>
			<span v-else-if="error" class="text-sm text-red-600 dark:text-red-400">
				{{ error }}
			</span>
		</div>
	</div>
</template>
