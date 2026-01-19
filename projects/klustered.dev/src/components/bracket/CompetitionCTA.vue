<script setup lang="ts">
import { ref } from "vue";
import { actions } from "astro:actions";

interface BracketWithCounts {
	id: string;
	name: string;
	slug: string;
	type: "solo" | "team";
	status: "draft" | "registration" | "active" | "completed";
	competitorCount: number;
}

interface UserParticipation {
	bracketId: string;
	confirmed: boolean;
}

const props = defineProps<{
	brackets: BracketWithCounts[];
	userParticipation: UserParticipation[];
	isSignedIn: boolean;
	signInUrl: string;
}>();

const isLoading = ref(false);
const error = ref<string | null>(null);
const localParticipation = ref([...props.userParticipation]);

const hasActiveBrackets = props.brackets.some(b => b.status === "active");
const hasRegistrationBrackets = props.brackets.some(b => b.status === "registration");
const hasCompletedBrackets = props.brackets.some(b => b.status === "completed");
const hasNoBrackets = props.brackets.length === 0;

const pendingConfirmations = props.userParticipation.filter(p => {
	const bracket = props.brackets.find(b => b.id === p.bracketId);
	return bracket && (bracket.status === "registration" || bracket.status === "draft") && !p.confirmed;
});

async function handleConfirm(bracketId: string) {
	isLoading.value = true;
	error.value = null;

	try {
		const { error: actionError } = await actions.bracket.confirmParticipation({
			bracketId,
		});

		if (actionError) throw new Error(actionError.message);

		const idx = localParticipation.value.findIndex(p => p.bracketId === bracketId);
		if (idx !== -1) {
			localParticipation.value[idx].confirmed = true;
		}
	} catch (err) {
		error.value = err instanceof Error ? err.message : "Failed to confirm";
	} finally {
		isLoading.value = false;
	}
}

function getBracketName(bracketId: string): string {
	const bracket = props.brackets.find(b => b.id === bracketId);
	return bracket?.name ?? "Unknown Bracket";
}
</script>

<template>
	<div class="competition-cta">
		<div v-if="pendingConfirmations.length > 0" class="pending-confirmations">
			<div class="pending-header">
				<span class="pending-icon">!</span>
				<h3 class="pending-title">Confirm Your Participation</h3>
			</div>
			<p class="pending-description">
				You have pending registrations that need confirmation before the competition starts.
			</p>

			<div v-if="error" class="error-message">
				{{ error }}
			</div>

			<div class="confirmation-actions">
				<button
					v-for="participation in pendingConfirmations"
					:key="participation.bracketId"
					@click="handleConfirm(participation.bracketId)"
					:disabled="isLoading || localParticipation.find(p => p.bracketId === participation.bracketId)?.confirmed"
					:class="['confirm-button', { 'is-confirmed': localParticipation.find(p => p.bracketId === participation.bracketId)?.confirmed }]"
				>
					<template v-if="localParticipation.find(p => p.bracketId === participation.bracketId)?.confirmed">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
						Confirmed
					</template>
					<template v-else>
						Confirm {{ getBracketName(participation.bracketId) }}
					</template>
				</button>
			</div>
		</div>

		<div v-else-if="hasActiveBrackets" class="active-cta">
			<h3 class="cta-title">Competition is Live!</h3>
			<p class="cta-description">
				Follow the action as competitors battle it out in Kubernetes chaos.
			</p>
			<div class="cta-buttons">
				<a
					v-for="bracket in brackets.filter(b => b.status === 'active')"
					:key="bracket.id"
					:href="`/bracket/${bracket.slug}`"
					class="primary-button"
				>
					View {{ bracket.name }}
				</a>
			</div>
		</div>

		<div v-else-if="hasRegistrationBrackets" class="registration-cta">
			<h3 class="cta-title">Ready to Compete?</h3>
			<p class="cta-description">
				Registration is open! Choose Solo or Team competition.
			</p>

			<div v-if="!isSignedIn" class="sign-in-prompt">
				<a :href="signInUrl" class="primary-button">
					Sign In to Register
				</a>
			</div>

			<div v-else class="registration-options">
				<a href="/compete" class="primary-button">
					Register Now
				</a>
			</div>
		</div>

		<div v-else-if="hasCompletedBrackets" class="completed-cta">
			<h3 class="cta-title">Competition Complete</h3>
			<p class="cta-description">
				Thanks to all competitors! Check out the final brackets.
			</p>
			<div class="cta-buttons">
				<a
					v-for="bracket in brackets.filter(b => b.status === 'completed')"
					:key="bracket.id"
					:href="`/bracket/${bracket.slug}`"
					class="secondary-button"
				>
					View {{ bracket.name }} Results
				</a>
			</div>
		</div>

		<div v-else class="coming-soon-cta">
			<h3 class="cta-title">Competition Coming Soon</h3>
			<p class="cta-description">
				Klustered '26 is on the horizon. Stay tuned for registration announcements!
			</p>
			<div v-if="!isSignedIn" class="sign-in-prompt">
				<a :href="signInUrl" class="secondary-button">
					Sign In to Get Notified
				</a>
			</div>
		</div>
	</div>
</template>

<style scoped>
.competition-cta {
	width: 100%;
}

.pending-confirmations {
	background: linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(245, 158, 11, 0.05));
	border: 1px solid rgba(251, 191, 36, 0.3);
	border-radius: 1rem;
	padding: 1.5rem;
	text-align: center;
}

.pending-header {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	margin-bottom: 0.5rem;
}

.pending-icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	background: rgba(251, 191, 36, 0.3);
	color: #fde047;
	font-weight: 700;
	font-size: 0.875rem;
	border-radius: 50%;
}

.pending-title {
	font-size: 1.125rem;
	font-weight: 600;
	color: white;
	margin: 0;
}

.pending-description {
	font-size: 0.875rem;
	color: rgba(255, 255, 255, 0.7);
	margin: 0 0 1rem 0;
}

.error-message {
	padding: 0.75rem 1rem;
	background: rgba(239, 68, 68, 0.1);
	border: 1px solid rgba(239, 68, 68, 0.3);
	border-radius: 0.5rem;
	color: #fca5a5;
	font-size: 0.875rem;
	margin-bottom: 1rem;
}

.confirmation-actions {
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 0.75rem;
}

.confirm-button {
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.75rem 1.5rem;
	background: linear-gradient(135deg, #22c55e, #16a34a);
	color: white;
	font-size: 0.875rem;
	font-weight: 600;
	border: none;
	border-radius: 0.5rem;
	cursor: pointer;
	transition: all 0.2s;
}

.confirm-button:hover:not(:disabled) {
	transform: translateY(-2px);
	box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

.confirm-button:disabled {
	opacity: 0.8;
	cursor: default;
}

.confirm-button.is-confirmed {
	background: rgba(34, 197, 94, 0.2);
	color: #86efac;
}

.active-cta,
.registration-cta,
.completed-cta,
.coming-soon-cta {
	background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(168, 85, 247, 0.05));
	border: 1px solid rgba(139, 92, 246, 0.2);
	border-radius: 1rem;
	padding: 1.5rem;
	text-align: center;
}

.cta-title {
	font-size: 1.25rem;
	font-weight: 600;
	color: white;
	margin: 0 0 0.5rem 0;
}

.cta-description {
	font-size: 0.875rem;
	color: rgba(255, 255, 255, 0.7);
	margin: 0 0 1.25rem 0;
}

.cta-buttons,
.sign-in-prompt,
.registration-options {
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 0.75rem;
}

.primary-button {
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.75rem 1.5rem;
	background: linear-gradient(135deg, #8b5cf6, #7c3aed);
	color: white;
	font-size: 0.875rem;
	font-weight: 600;
	border-radius: 0.5rem;
	text-decoration: none;
	transition: all 0.2s;
}

.primary-button:hover {
	transform: translateY(-2px);
	box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
}

.secondary-button {
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.75rem 1.5rem;
	background: rgba(139, 92, 246, 0.2);
	color: #c4b5fd;
	font-size: 0.875rem;
	font-weight: 500;
	border-radius: 0.5rem;
	text-decoration: none;
	transition: all 0.2s;
}

.secondary-button:hover {
	background: rgba(139, 92, 246, 0.3);
	color: white;
}
</style>
