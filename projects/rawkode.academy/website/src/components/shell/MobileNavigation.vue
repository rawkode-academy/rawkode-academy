<script setup lang="ts">
import { actions } from "astro:actions";
import { academyShell } from "@rawkodeacademy/design-system";
import { NavigationDrawer } from "@rawkodeacademy/design-system/vue";
import { ref } from "vue";
import { createLogger } from "@/lib/logger";

interface NavigationItem {
	label: string;
	href: string;
}

defineProps<{
	primary: NavigationItem[];
	groups: Array<{ label: string; items: NavigationItem[] }>;
	currentPath: string;
}>();

const logger = createLogger("auth");
const styles = academyShell();
type Account =
	| { state: "unknown" }
	| { state: "signed-out" }
	| { state: "signed-in"; name: string; email: string };
const account = ref<Account>({ state: "unknown" });
let requested = false;

// Most pages are prerendered, so the session is only asked for once the
// drawer is first opened.
const loadAccount = async (open: boolean) => {
	if (!open || requested) return;
	requested = true;
	try {
		const response = await fetch("/api/auth/me", { credentials: "same-origin" });
		const body = response.ok ? await response.json() : null;
		account.value = body?.authenticated
			? { state: "signed-in", name: body.user.name ?? "", email: body.user.email ?? "" }
			: { state: "signed-out" };
	} catch (error) {
		logger.error("Failed to load session", error);
		account.value = { state: "signed-out" };
	}
};

const signOut = async () => {
	try {
		await actions.auth.signOut();
		if ((window as any).posthog?.reset) (window as any).posthog.reset();
		window.location.href = "/";
	} catch (error) {
		logger.error("Failed to sign out", error);
	}
};
</script>

<template>
	<NavigationDrawer :primary="primary" :groups="groups" :current-path="currentPath" @open-change="loadAccount">
		<template #account>
			<div v-if="account.state !== 'unknown'" :class="styles.menuAccount">
				<a v-if="account.state === 'signed-out'" href="/api/auth/sign-in" :class="styles.menuSignIn">Sign in</a>
				<div v-else :class="styles.menuIdentity">
					<span :class="styles.menuIdentityText">
						<span :class="styles.menuIdentityName">{{ account.name }}</span>
						<span :class="styles.menuIdentityEmail">{{ account.email }}</span>
					</span>
					<button type="button" :class="styles.menuSignOut" @click="signOut">Sign out</button>
				</div>
			</div>
		</template>
	</NavigationDrawer>
</template>
