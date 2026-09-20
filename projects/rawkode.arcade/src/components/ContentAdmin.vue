<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { games, type GameId } from "@/lib/game-catalogue";

type Pack = {
	id: string;
	game_key: string;
	slug: string;
	title: string;
	description?: string;
	status: string;
	published_revision_id?: string | null;
};
const props = defineProps<{ packId?: string }>();
const packs = ref<Pack[]>([]);
const selectedId = ref(props.packId ?? "");
const gameKey = ref<GameId>(games[0].id);
const slug = ref("");
const title = ref("");
const description = ref("");
const question = ref("");
const answer = ref("");
const options = ref("");
const answers = ref("");
const status = ref("Loading content studio…");
const pending = ref(false);
const forbidden = ref(false);
const selected = computed(() =>
	packs.value.find((pack) => pack.id === selectedId.value),
);
const answerListGame = computed(
	() =>
		gameKey.value === "merge-conflict" ||
		gameKey.value === "ten-nines" ||
		gameKey.value === "null-pointer",
);
const revisionGuide = computed(() => {
	switch (gameKey.value) {
		case "spinlock":
			return "A category and phrase create a masked, wheel-driven board.";
		case "principal-engineer":
			return "Provide exactly four choices and put the correct choice in the answer field.";
		case "race-condition":
			return "The prompt and answer become a chaser round.";
		case "ten-nines":
			return "Provide exactly ten answers, one per line.";
		case "null-pointer":
			return "Add one or more acceptable answers, one per line.";
		default:
			return "Add one or more ranked survey answers, one per line.";
	}
});

function lines(value: string): string[] {
	return value
		.split("\n")
		.map((entry) => entry.trim())
		.filter(Boolean);
}
function resetRevisionDraft(key: GameId) {
	const defaults: Record<
		GameId,
		{ question: string; answer: string; options?: string; answers?: string }
	> = {
		"merge-conflict": {
			question: "Name a code-review practice developers value.",
			answer: "",
			answers: "Clear comments\nSmall pull requests\nAutomated checks",
		},
		spinlock: {
			question: "Developer practice",
			answer: "rubber duck debugging",
		},
		"principal-engineer": {
			question: "Which HTTP method is idempotent?",
			answer: "PUT",
			options: "POST\nPATCH\nPUT\nCONNECT",
		},
		"race-condition": {
			question: "Which data structure uses FIFO ordering?",
			answer: "queue",
		},
		"ten-nines": {
			question: "Name a thing an excellent engineer should know.",
			answer: "",
			answers:
				"Git\nTesting\nDebugging\nSecurity\nDatabases\nNetworking\nObservability\nAccessibility\nPerformance\nDocumentation",
		},
		"null-pointer": {
			question: "Name a programming language with garbage collection.",
			answer: "",
			answers: "Java\nJavaScript\nPython\nGo\nElixir",
		},
	};
	const draft = defaults[key];
	question.value = draft.question;
	answer.value = draft.answer;
	options.value = draft.options ?? "";
	answers.value = draft.answers ?? "";
}

function revisionInput(): {
	questions: Array<Record<string, unknown>>;
	manifest: Record<string, unknown>;
} {
	const prompt = question.value.trim();
	const value = answer.value.trim();
	if (!prompt) throw new Error("A prompt or category is required.");
	const manifest = (gameContent: Record<string, unknown>) => ({
		gameContent,
	});
	if (gameKey.value === "merge-conflict") {
		const values = lines(answers.value);
		if (!values.length) throw new Error("Merge Conflict needs at least one ranked answer.");
		const ranked = values.map((entry, index) => ({
			answer: entry,
			aliases: [],
			points: Math.max(10, 100 - index * 10),
		}));
		return {
			questions: [{ kind: "survey", prompt, answer: { answers: ranked } }],
			manifest: manifest({ title: title.value.trim() || "Merge Conflict", rounds: [{ prompt, answers: ranked }] }),
		};
	}
	if (gameKey.value === "spinlock") {
		if (!value) throw new Error("Spinlock needs a phrase.");
		const round = { phrase: value, category: prompt, aliases: [] as string[] };
		return {
			questions: [{ kind: "phrase", prompt, options: { category: prompt }, answer: round }],
			manifest: manifest({ title: title.value.trim() || "Spinlock", wheel: [100, 150, 200, 250], rounds: [round] }),
		};
	}
	if (gameKey.value === "principal-engineer") {
		const choices = lines(options.value);
		if (choices.length !== 4) throw new Error("Principal Engineer needs exactly four choices.");
		const correct = choices.indexOf(value);
		if (correct < 0) throw new Error("The correct answer must match one of the four choices.");
		const entry = { prompt, choices, correct, prize: 100 };
		return {
			questions: [{ kind: "multiple-choice", prompt, options: { choices }, answer: { correct, prize: 100 } }],
			manifest: manifest({ title: title.value.trim() || "Who Wants to Be a Principal Engineer?", questions: [entry] }),
		};
	}
	if (gameKey.value === "race-condition") {
		if (!value) throw new Error("Race Condition needs a correct answer.");
		const round = { prompt, answer: value, aliases: [] as string[], teamSteps: 1, chaserSteps: 1 };
		return {
			questions: [{ kind: "chase", prompt, answer: round }],
			manifest: manifest({ title: title.value.trim() || "Race Condition", finish: 5, rounds: [round] }),
		};
	}
	const values = lines(answers.value);
	if (gameKey.value === "ten-nines" && values.length !== 10)
		throw new Error("Ten Nines needs exactly ten answers.");
	if (!values.length) throw new Error("Add at least one valid answer.");
	if (gameKey.value === "ten-nines") {
		const list = values.map((entry) => ({ answer: entry, aliases: [] as string[] }));
		return {
			questions: [{ kind: "list", prompt, answer: { answers: list } }],
			manifest: manifest({ title: title.value.trim() || "Ten Nines", rounds: [{ prompt, answers: list }] }),
		};
	}
	const rare = values.map((entry, index) => ({
		answer: entry,
		aliases: [] as string[],
		surveyResponses: Math.max(0, values.length - index - 1),
	}));
	return {
		questions: [{ kind: "rare-answer", prompt, answer: { answers: rare } }],
		manifest: manifest({ title: title.value.trim() || "Null Pointer", rounds: [{ prompt, answers: rare }] }),
	};
}

watch(gameKey, resetRevisionDraft);

async function api<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(path, {
		credentials: "same-origin",
		headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
		...init,
	});
	if (response.status === 401 || response.status === 403) {
		forbidden.value = true;
		throw new Error(
			"A host or producer session is required for content changes.",
		);
	}
	if (!response.ok) {
		const body = (await response.json().catch(() => ({}))) as {
			error?: { message?: string };
		};
		throw new Error(
			body.error?.message ?? "The content service rejected this request.",
		);
	}
	return response.json() as Promise<T>;
}

function edit(pack: Pack) {
	selectedId.value = pack.id;
	const game = games.find((candidate) => candidate.id === pack.game_key);
	if (game) gameKey.value = game.id;
	slug.value = pack.slug;
	title.value = pack.title;
	description.value = pack.description ?? "";
}
async function load() {
	pending.value = true;
	try {
		const response = await api<{ packs: Pack[] }>("/api/content/packs");
		packs.value = response.packs;
		const target =
			packs.value.find((pack) => pack.id === selectedId.value) ??
			packs.value[0];
		if (target) edit(target);
		status.value = target
			? "Content loaded from D1."
			: "Create your first content pack.";
	} catch (cause) {
		status.value =
			cause instanceof Error ? cause.message : "Unable to load content.";
	} finally {
		pending.value = false;
	}
}
async function createPack() {
	pending.value = true;
	try {
		const response = await api<{ id: string }>("/api/content/packs", {
			method: "POST",
			body: JSON.stringify({
				gameKey: gameKey.value,
				slug: slug.value,
				title: title.value,
				description: description.value,
			}),
		});
		selectedId.value = response.id;
		await load();
		status.value = "Pack created. Add a validated revision before publishing.";
	} catch (cause) {
		status.value =
			cause instanceof Error ? cause.message : "Unable to create pack.";
	} finally {
		pending.value = false;
	}
}
async function savePack() {
	if (!selectedId.value) return createPack();
	pending.value = true;
	try {
		await api(`/api/content/packs/${encodeURIComponent(selectedId.value)}`, {
			method: "PATCH",
			body: JSON.stringify({
				title: title.value,
				description: description.value,
			}),
		});
		await load();
		status.value = "Pack changes saved.";
	} catch (cause) {
		status.value =
			cause instanceof Error ? cause.message : "Unable to save pack.";
	} finally {
		pending.value = false;
	}
}
async function archivePack() {
	if (!selectedId.value || !confirm("Archive this content pack?")) return;
	pending.value = true;
	try {
		await api(`/api/content/packs/${encodeURIComponent(selectedId.value)}`, {
			method: "DELETE",
		});
		selectedId.value = "";
		await load();
		status.value = "Pack archived.";
	} catch (cause) {
		status.value =
			cause instanceof Error ? cause.message : "Unable to archive pack.";
	} finally {
		pending.value = false;
	}
}
async function publishRevision() {
	if (!selectedId.value) {
		status.value = "Save the pack before creating a revision.";
		return;
	}
	pending.value = true;
	try {
		const revision = await api<{ id: string }>(
			`/api/content/packs/${encodeURIComponent(selectedId.value)}/revisions`,
			{
				method: "POST",
				body: JSON.stringify(revisionInput()),
			},
		);
		await api(
			`/api/content/revisions/${encodeURIComponent(revision.id)}/publish`,
			{
				method: "POST",
			},
		);
		await load();
		status.value = "Revision validated and published.";
	} catch (cause) {
		status.value =
			cause instanceof Error ? cause.message : "Unable to publish revision.";
	} finally {
		pending.value = false;
	}
}
resetRevisionDraft(gameKey.value);
onMounted(load);
</script>
<template>
	<div class="admin-shell">
		<header>
			<div><span>Content studio</span><h1>Build the next <em>great round.</em></h1></div>
			<button class="publish" :disabled="pending || forbidden" @click="publishRevision">Publish revision <span>↗</span></button>
		</header>
		<p class="status" :class="{ error: forbidden }" aria-live="polite">{{ status }}</p>
		<section v-if="!forbidden" class="studio">
			<aside class="content-list" aria-label="Content packs">
				<button v-for="pack in packs" :key="pack.id" class="pack" :class="{ active: selectedId === pack.id }" @click="edit(pack)"><b>{{ pack.game_key }}</b><span>{{ pack.title }}</span><small>{{ pack.status }}</small></button>
				<p v-if="!packs.length">No packs yet.</p>
			</aside>
			<form class="editor" @submit.prevent="savePack">
				<label>Show format<select v-model="gameKey" :disabled="Boolean(selected)"><option v-for="game in games" :key="game.id" :value="game.id">{{ game.title }}</option></select></label>
				<label>Slug<input v-model="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" :disabled="Boolean(selected)" /></label>
				<label>Pack title<input v-model="title" required maxlength="160" /></label>
				<label>Description<textarea v-model="description" rows="2" /></label>
				<div class="editor-footer"><button class="save" type="submit" :disabled="pending">{{ selected ? 'Save pack' : 'Create pack' }}</button><button v-if="selected" class="archive" type="button" :disabled="pending" @click="archivePack">Archive</button></div>
				<fieldset><legend>Publish a validated {{ games.find((game) => game.id === gameKey)?.title }} revision</legend><p class="revision-guide">{{ revisionGuide }}</p><label>{{ gameKey === 'spinlock' ? 'Category' : 'Prompt' }}<textarea v-model="question" required rows="3" /></label><label v-if="!answerListGame">{{ gameKey === 'spinlock' ? 'Phrase' : 'Correct answer' }}<input v-model="answer" required autocomplete="off" /></label><label v-if="gameKey === 'principal-engineer'">Four choices (one per line)<textarea v-model="options" required rows="4" /></label><label v-if="answerListGame">{{ gameKey === 'ten-nines' ? 'Ten answers (one per line)' : 'Answers (one per line)' }}<textarea v-model="answers" required rows="6" /></label><small>Answers are sent only to the authenticated content API. Each show is published as its own reducer-valid game manifest and is never passed to public live-room props.</small></fieldset>
			</form>
		</section>
		<section v-else class="auth-guard"><h2>Producer access required</h2><p>Sign in with a host or producer session, then reload the content studio.</p></section>
	</div>
</template>
<style scoped>
.admin-shell { margin: auto; max-width: 1100px; padding: 2rem; }header { align-items: end; display: flex; justify-content: space-between; gap: 1rem; }header span { color: var(--cyan); font-family: "IBM Plex Mono", monospace; font-size: .64rem; letter-spacing: .1em; text-transform: uppercase; }h1 { font-family: "Space Grotesk", sans-serif; font-size: clamp(1.8rem, 4vw, 3rem); letter-spacing: -.07em; margin: .35rem 0 0; }h1 em { color: var(--cyan); font-style: normal; }.publish, .save { background: var(--cyan); border: 0; border-radius: 8px; color: var(--ink); font-weight: 800; padding: .7rem .85rem; }.status { color: var(--lime); font-size: .8rem; }.status.error { color: var(--coral); }.studio { display: grid; gap: 1rem; grid-template-columns: 280px 1fr; }.content-list, .editor, .auth-guard { background: rgb(16 26 53 / 70%); border: 1px solid var(--line); border-radius: 13px; padding: 1rem; }.pack { background: transparent; border: 1px solid transparent; border-radius: 8px; color: var(--cloud); display: grid; gap: .2rem; margin-bottom: .35rem; padding: .65rem; text-align: left; width: 100%; }.pack.active { background: rgb(77 232 255 / 8%); border-color: rgb(77 232 255 / 24%); }.pack b, .pack small, fieldset small { color: var(--mist); font-family: "IBM Plex Mono", monospace; font-size: .62rem; }.editor { display: grid; gap: .8rem; }.editor label { color: var(--mist); display: grid; font-family: "IBM Plex Mono", monospace; font-size: .64rem; gap: .35rem; letter-spacing: .05em; text-transform: uppercase; }input, select, textarea { background: rgb(8 13 29 / 58%); border: 1px solid var(--line); border-radius: 7px; color: var(--cloud); font: inherit; padding: .65rem; text-transform: none; width: 100%; }.editor-footer { display: flex; gap: .6rem; }.archive { background: transparent; border: 1px solid var(--coral); border-radius: 8px; color: var(--coral); padding: .65rem .8rem; }fieldset { border: 1px solid var(--line); border-radius: 9px; display: grid; gap: .7rem; padding: .8rem; }legend { color: var(--cyan); font-family: "IBM Plex Mono", monospace; font-size: .62rem; letter-spacing: .07em; text-transform: uppercase; }.auth-guard { margin-top: 1rem; }@media (max-width: 700px) { .admin-shell { padding: 1rem; } header { align-items: start; flex-direction: column; }.studio { grid-template-columns: 1fr; } }
</style>
