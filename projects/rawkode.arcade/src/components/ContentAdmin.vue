<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { css } from "@/../styled-system/css";
import { games, type GameId } from "@/lib/game-catalogue";
import {
	control,
	field,
	fieldLabel,
	notice,
	row,
	runningOrder,
	sectionRule,
	shellWide,
	slug as slugStyle,
	stack,
	stage,
	text,
} from "@/styles/arcade";

const studio = css({
	display: "grid",
	gridTemplateColumns: { base: "1fr", lg: "minmax(0, token(sizes.railNarrow)) minmax(0, 1fr)" },
	gap: "stack",
	alignItems: "start",
	pb: "section",
});
const deckHeader = css({
	display: "flex",
	flexWrap: "wrap",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "4",
	py: "stackSm",
});
const editorGrid = css({ display: "grid", gap: "4" });
const group = css({ border: "none", padding: "0", margin: "0", display: "grid", gap: "4" });
const guard = css({ display: "grid", gap: "4", justifyItems: "start", py: "section", maxW: "measure" });
const area = css({ minHeight: "6", py: "3", resize: "vertical" });
const order = runningOrder();
const orderSelected = runningOrder({ state: "selected" });

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
	<div :class="shellWide">
		<header :class="deckHeader">
			<div :class="stack({ gap: 'tight' })">
				<span :class="slugStyle({ tone: 'live' })">Content studio</span>
				<h1 :class="text({ style: 'headline' })">Question packs</h1>
			</div>
			<button
				:class="control({ tone: 'live' })"
				type="button"
				data-control
				:disabled="pending || forbidden"
				@click="publishRevision"
			>
				Publish revision
			</button>
		</header>

		<p
			:class="notice({ tone: forbidden ? 'error' : 'info' })"
			aria-live="polite"
		>{{ status }}</p>

		<section v-if="!forbidden" :class="[studio, css({ mt: '5' })]">
			<aside aria-label="Content packs">
				<div :class="sectionRule">
					<span :class="slugStyle()">{{ packs.length }} packs</span>
				</div>
				<div :class="order.root">
					<button
						v-for="pack in packs"
						:key="pack.id"
						type="button"
						:class="selectedId === pack.id ? orderSelected.item : order.item"
						:aria-current="selectedId === pack.id ? 'true' : undefined"
						@click="edit(pack)"
					>
						<span :class="order.index">{{ pack.game_key }}</span>
						<span :class="order.title">{{ pack.title }}</span>
						<span :class="order.action">{{ pack.status }}</span>
					</button>
				</div>
				<p v-if="!packs.length" :class="[text({ style: 'bodySm', tone: 'mute' }), css({ mt: '4' })]">
					No packs yet. Fill in the form to create the first one.
				</p>
			</aside>

			<form :class="[stage({ pad: 'comfortable' }), editorGrid]" data-stage @submit.prevent="savePack">
				<div>
					<label :class="fieldLabel" for="pack-format">Show format</label>
					<select
						id="pack-format"
						v-model="gameKey"
						:class="field()"
						data-field
						:disabled="Boolean(selected)"
					>
						<option v-for="game in games" :key="game.id" :value="game.id">{{ game.title }}</option>
					</select>
				</div>

				<div>
					<label :class="fieldLabel" for="pack-slug">Slug</label>
					<input
						id="pack-slug"
						v-model="slug"
						:class="field()"
						data-field
						required
						pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
						:disabled="Boolean(selected)"
					/>
				</div>

				<div>
					<label :class="fieldLabel" for="pack-title">Pack title</label>
					<input id="pack-title" v-model="title" :class="field()" data-field required maxlength="160" />
				</div>

				<div>
					<label :class="fieldLabel" for="pack-description">Description</label>
					<textarea id="pack-description" v-model="description" :class="[field(), area]" data-field rows="2" />
				</div>

				<div :class="row({ gap: 'base', wrap: true })">
					<button :class="control({ tone: 'action', size: 'sm' })" type="submit" data-control :disabled="pending">
						{{ selected ? "Save pack" : "Create pack" }}
					</button>
					<button
						v-if="selected"
						:class="control({ tone: 'danger', size: 'sm' })"
						type="button"
						data-control
						:disabled="pending"
						@click="archivePack"
					>Archive</button>
				</div>

				<fieldset :class="group">
					<legend :class="[fieldLabel, css({ padding: '0' })]">
						Publish a validated revision
					</legend>
					<p :class="text({ style: 'bodySm', tone: 'soft' })">{{ revisionGuide }}</p>

					<div>
						<label :class="fieldLabel" for="revision-question">
							{{ gameKey === "spinlock" ? "Category" : "Prompt" }}
						</label>
						<textarea id="revision-question" v-model="question" :class="[field(), area]" data-field required rows="3" />
					</div>

					<div v-if="!answerListGame">
						<label :class="fieldLabel" for="revision-answer">
							{{ gameKey === "spinlock" ? "Phrase" : "Correct answer" }}
						</label>
						<input id="revision-answer" v-model="answer" :class="field()" data-field required autocomplete="off" />
					</div>

					<div v-if="gameKey === 'principal-engineer'">
						<label :class="fieldLabel" for="revision-options">Four choices, one per line</label>
						<textarea id="revision-options" v-model="options" :class="[field(), area]" data-field required rows="4" />
					</div>

					<div v-if="answerListGame">
						<label :class="fieldLabel" for="revision-answers">
							{{ gameKey === "ten-nines" ? "Ten answers, one per line" : "Answers, one per line" }}
						</label>
						<textarea id="revision-answers" v-model="answers" :class="[field(), area]" data-field required rows="6" />
					</div>

					<p :class="text({ style: 'bodySm', tone: 'mute' })">
						Answers go only to the authenticated content API. Each show publishes
						as its own reducer-valid manifest and is never passed to public
						live-room props.
					</p>
				</fieldset>
			</form>
		</section>

		<section v-else :class="guard">
			<span :class="slugStyle({ tone: 'closed' })">Access required</span>
			<h2 :class="text({ style: 'headline' })">Producer sign-in needed.</h2>
			<p :class="text({ style: 'body', tone: 'soft' })">
				Sign in with a host or producer session through Cloudflare Access, then
				reload the content studio.
			</p>
		</section>
	</div>
</template>
