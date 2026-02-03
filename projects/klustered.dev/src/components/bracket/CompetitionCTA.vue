<script setup lang="ts">
interface BracketWithCounts {
	id: string;
	name: string;
	slug: string;
	type: "solo" | "team";
	status: "draft" | "registration" | "active" | "completed";
	competitorCount: number;
}

const props = defineProps<{
	brackets: BracketWithCounts[];
}>();

const hasActiveBrackets = props.brackets.some((bracket) => bracket.status === "active");
const hasRegistrationBrackets = props.brackets.some((bracket) => bracket.status === "registration");
const hasCompletedBrackets = props.brackets.some((bracket) => bracket.status === "completed");
const hasNoBrackets = props.brackets.length === 0;
</script>

<template>
	<div class="competition-cta">
		<div v-if="hasActiveBrackets" class="active-cta">
			<h3 class="cta-title">Competition is Live!</h3>
			<p class="cta-description">
				Follow the action as competitors battle it out in Kubernetes chaos.
			</p>
			<div class="cta-buttons">
				<a
					v-for="bracket in brackets.filter(bracket => bracket.status === 'active')"
					:key="bracket.id"
					:href="`/bracket/${bracket.slug}`"
					class="primary-button"
				>
					View {{ bracket.name }}
				</a>
			</div>
		</div>

		<div v-else-if="hasRegistrationBrackets" class="registration-cta">
			<h3 class="cta-title">Registration is Open</h3>
			<p class="cta-description">
				Bracket rosters are curated in YAML, so check bracket pages for the latest details.
			</p>
			<div class="cta-buttons">
				<a href="/bracket" class="primary-button">
					View Registration Brackets
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
					v-for="bracket in brackets.filter(bracket => bracket.status === 'completed')"
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
			<div v-if="hasNoBrackets" class="cta-buttons">
				<a href="/bracket" class="secondary-button">
					Explore Brackets
				</a>
			</div>
		</div>
	</div>
</template>

<style scoped>
.competition-cta {
	width: 100%;
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

.cta-buttons {
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
