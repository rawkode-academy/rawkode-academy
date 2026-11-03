<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { academyGame } from "@rawkodeacademy/design-system";
import { clampGuess, dailyPuzzle, dayKey, markGuess, MAX_GUESSES, normalize, restoreGuesses, shareResult } from "@/lib/games/kubele";
const props = defineProps<{ registered: boolean }>();
const stats = ref<{ played: number; wins: number; streak: number; distribution: number[] } | null>(null);
const theme = academyGame();
const puzzle = ref(dailyPuzzle());
const guesses = ref<string[]>([]);
const input = ref("");
const message = ref("");
const shareText = ref("");
const target = computed(() => normalize(puzzle.value.answer.name));
const won = computed(() => guesses.value.includes(target.value));
const finished = computed(() => won.value || guesses.value.length === MAX_GUESSES);
const rows = computed(() => Array.from({ length: MAX_GUESSES }, (_, index) => {
	const word = guesses.value[index] ?? (index === guesses.value.length && !finished.value ? normalize(input.value) : "");
	const marks = guesses.value[index] ? markGuess(word, target.value) : [];
	return Array.from({ length: target.value.length }, (_, position) => ({ letter: word[position] ?? "", mark: marks[position] }));
}));
function onInput(event: Event) {
	const field = event.target as HTMLInputElement;
	const clamped = clampGuess(field.value, target.value.length);
	if (clamped !== field.value) field.value = clamped;
	input.value = clamped;
}
const storageKey = () => `kubele:v1:${puzzle.value.date}`;
function load() {
	try { guesses.value = restoreGuesses(localStorage.getItem(storageKey()), target.value); }
	catch { guesses.value = []; }
}
function checkDay() {
	if (dayKey() === puzzle.value.date) return false;
	puzzle.value = dailyPuzzle(); input.value = ""; shareText.value = ""; load();
	void syncStats();
 message.value = "A new UTC day has arrived. Your new puzzle is ready.";
	return true;
}
function submit() {
	if (checkDay() || finished.value) return;
	const guess = normalize(input.value);
	if (guess.length !== target.value.length) { message.value = `Enter ${target.value.length} letters. Spaces and punctuation do not count.`; return; }
	if (guesses.value.includes(guess)) { message.value = "You already tried that guess."; return; }
	guesses.value.push(guess); input.value = "";
 if (finished.value) void syncStats(true);
	message.value = won.value ? "Kube-rilliant! You solved today's puzzle." : finished.value ? "Out of guesses. Discover today's answer below." : `Guess ${guesses.value.length} of 6: ${markGuess(guess, target.value).map((mark, i) => `${guess[i]} ${mark}`).join(", ")}.`;
	try { localStorage.setItem(storageKey(), JSON.stringify(guesses.value)); }
	catch { message.value += " Progress could not be saved in this browser."; }
}
async function syncStats(save = false) {
 if (!props.registered) return;
 try {
  const response = await fetch("/api/games/kubele/stats", save ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: puzzle.value.date, guesses: guesses.value }) } : {});
  if (!response.ok) throw new Error("Stats unavailable");
  const data = await response.json(); stats.value = data.stats;
  if (data.today && !save) { guesses.value = restoreGuesses(JSON.stringify(data.today), target.value); }
 } catch { message.value = "Account stats could not sync. Your browser progress is still available."; }
}
async function shareSocial() {
 const text = shareResult(puzzle.value.date, guesses.value, target.value);
 if (navigator.share) { try { await navigator.share({ title: "Kubele", text }); } catch (error) { if (!(error instanceof Error && error.name === "AbortError")) await share(); } }
 else await share();
}
async function share() {
	const result = shareResult(puzzle.value.date, guesses.value, target.value);
	try { await navigator.clipboard.writeText(result); message.value = "Spoiler-free result copied."; }
	catch { shareText.value = result; message.value = "Copy your result from the text box below."; }
}
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => { load(); void syncStats(finished.value); timer = setInterval(checkDay, 1000); window.addEventListener("focus", checkDay); });
onUnmounted(() => { clearInterval(timer); window.removeEventListener("focus", checkDay); });
</script>

<template>
	<div :class="theme.root" class="kubele">
		<header>
			<p class="eyebrow">Daily cloud native puzzle · {{ puzzle.date }} · UTC</p>
			<h1>Kubele.</h1><p>All kube. No fluke.</p>
			<p>Six guesses to uncover a cloud native project or term. Sandbox projects get their day in the sun, too.</p>
		</header>
		<div class="puzzle-meta"><strong>{{ puzzle.answer.kind }}</strong><span>{{ target.length }} letters · {{ guesses.length }}/6 guesses</span></div>
		<details><summary>How to play</summary>
			<p>Type any guess with {{ target.length }} letters. Answers vary in length each day; omit spaces, hyphens, and punctuation. Green (✓) means the right letter in the right place. Yellow (~) means the letter belongs elsewhere. Gray (×) means no remaining match. Repeated letters count only as often as they appear in the answer.</p>
			<p>Everyone gets the same puzzle, changing at midnight UTC. Progress is saved in this browser. No account needed.</p>
		</details>
		<div class="board" role="group" aria-label="Six guess puzzle board">
			<div v-for="(row, index) in rows" :key="index" class="row" :style="{ gridTemplateColumns: `repeat(${target.length}, minmax(0, 1fr))` }" :aria-label="`Guess ${index + 1}`">
				<span v-for="(cell, position) in row" :key="position" class="tile" :class="cell.mark" :aria-label="`${cell.letter || 'Empty'}${cell.mark ? `: ${cell.mark}` : ''}`">{{ cell.letter }}<small v-if="cell.mark" aria-hidden="true">{{ cell.mark === 'correct' ? '✓' : cell.mark === 'present' ? '~' : '×' }}</small></span>
			</div>
		</div>
		<p class="message" role="status" aria-live="polite">{{ message }}</p>
		<form v-if="!finished" @submit.prevent="submit">
			<label for="kubele-guess">Your guess ({{ target.length }} letters)</label>
			<div class="entry"><input id="kubele-guess" :value="input" @input="onInput" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" :maxlength="target.length * 2" aria-describedby="kubele-help" /><button type="submit">Guess</button></div>
			<p id="kubele-help" class="help">Type your guess and press Enter or select Guess.</p>
		</form>
		<section v-else class="result" aria-label="Puzzle result">
			<h2>{{ won ? 'Kube-rilliant!' : 'Better luck next kube.' }}</h2>
			<p>Today's answer: <strong>{{ puzzle.answer.name }}</strong></p><p>{{ puzzle.answer.description }}</p>
			<a :href="puzzle.answer.url" target="_blank" rel="noopener noreferrer">Learn about {{ puzzle.answer.name }} ↗</a>
			<button type="button" @click="shareSocial">Share to social</button>
   <button type="button" @click="share">Copy spoiler-free result</button>
   <a :href="`https://bsky.app/intent/compose?text=${encodeURIComponent(shareResult(puzzle.date, guesses, target))}`" target="_blank" rel="noopener noreferrer">Post to Bluesky ↗</a>
   <a :href="`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareResult(puzzle.date, guesses, target))}`" target="_blank" rel="noopener noreferrer">Post to X ↗</a>
			<label v-if="shareText" for="kubele-share">Copy your result</label><textarea v-if="shareText" id="kubele-share" :value="shareText" readonly rows="9" />
			<p class="help">Next puzzle at midnight UTC. Come back tomorrow.</p>
		</section>
		<section v-if="stats" class="result" aria-label="Your account statistics"><h2>Your Kubele stats</h2><p>{{ stats.played }} played · {{ stats.wins }} wins · {{ stats.played ? Math.round(stats.wins / stats.played * 100) : 0 }}% win rate · {{ stats.streak }} day streak</p><ol aria-label="Winning guess distribution"><li v-for="(count, index) in stats.distribution" :key="index">{{ index + 1 }} guesses: {{ count }}</li></ol></section>
  <p v-if="!registered"><a href="/api/auth/sign-in?returnTo=/games/kubele">Sign in to save your stats across devices.</a></p>
  <footer><a href="/games/cnicon">Prefer pictures? Play CNIcon ↗</a></footer>
	</div>
</template>

<style scoped>
.kubele { max-width: 42rem; margin: 0 auto; padding: 2rem 0; display: grid; gap: 1.25rem; }
header { display: grid; gap: .6rem; line-height: 1.6; }
h1 { font-family: var(--font-red-hat-display); font-size: clamp(3rem, 10vw, 5rem); font-weight: 800; line-height: 1; }
.eyebrow, .help { font-size: .8rem; color: var(--editorial-ink-soft); }
.puzzle-meta { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .5rem; font-size: .85rem; }
details { border-block: 1px solid var(--editorial-hairline); padding: .8rem 0; }
summary { cursor: pointer; min-height: 2.75rem; display: flex; align-items: center; }
details p { margin-top: .5rem; line-height: 1.6; }
.board { display: grid; gap: .3rem; }
.row { display: grid; gap: .25rem; }
.tile { position: relative; display: grid; place-items: center; aspect-ratio: 1; max-height: 3.8rem; border: 1px solid var(--editorial-hairline); background: var(--surface-card); font-family: var(--font-red-hat-mono); font-weight: 700; font-size: clamp(.75rem, 3vw, 1.5rem); }
.tile small { position: absolute; bottom: 0; right: .15rem; font-size: .65rem; }
.correct { background: #166534 !important; color: #fff !important; border-color: #166534; }
.present { background: #854d0e !important; color: #fff !important; border-color: #854d0e; }
.absent { background: #475569 !important; color: #fff !important; border-color: #475569; }
.message { min-height: 1.5rem; line-height: 1.5; }
form, .result { display: grid; gap: .75rem; }
.entry { display: flex; gap: .5rem; }
input, textarea { min-width: 0; width: 100%; padding: .75rem; border: 1px solid var(--editorial-hairline); border-radius: var(--radius-sm); background: var(--surface-card); color: inherit; }
input { text-transform: uppercase; font-family: var(--font-red-hat-mono); }
button { padding: .6rem .85rem; border: 1px solid var(--editorial-hairline); border-radius: var(--radius-sm); color: inherit; background: var(--surface-card); }
button:hover { outline: 1px solid currentColor; }
.result { border: 1px solid var(--editorial-hairline); padding: 1.25rem; background: var(--surface-card); line-height: 1.6; }
a { color: var(--editorial-spruce); text-underline-offset: .2em; }
footer { border-top: 1px solid var(--editorial-hairline); padding-top: 1rem; font-size: .85rem; }
summary:focus-visible { outline: 2px solid var(--editorial-spruce); outline-offset: 2px; }
</style>
