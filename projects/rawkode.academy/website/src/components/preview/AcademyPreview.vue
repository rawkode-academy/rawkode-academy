<script setup lang="ts">
import { ref, onMounted } from "vue";
import {
	academyPreview,
	Dialog,
	Tabs,
} from "@rawkodeacademy/design-system/vue";

type PreviewPage = "home" | "learn" | "watch";

interface PreviewCard {
	href: string;
	title: string;
	description: string;
	meta: string[];
	mediaSrc?: string;
}

interface PreviewPath extends PreviewCard {
	meta: [string, string];
}

interface Props {
	page?: PreviewPage;
	featured: PreviewCard;
	videos: PreviewCard[];
	articles: PreviewCard[];
	news: PreviewCard[];
	learningPaths: PreviewPath[];
	stats: Array<{ value: string; label: string }>;
}

const props = withDefaults(defineProps<Props>(), {
	page: "home",
});

const styles = academyPreview();
const subscribed = ref(false);
const isDark = ref(false);

onMounted(() => {
	isDark.value = document.documentElement.classList.contains("dark");
});

const toggleTheme = () => {
	isDark.value = !isDark.value;
	document.documentElement.classList.toggle("dark", isDark.value);
};

const tabs = [
	{ value: "kubernetes", label: "Kubernetes" },
	{ value: "kueue", label: "Kueue" },
	{ value: "rust", label: "Rust" },
	{ value: "systems", label: "Systems" },
];

const description = (item: PreviewCard) =>
	item.description || "A practical session from the Rawkode Academy archive.";

const submitSubscription = () => {
	subscribed.value = true;
};
</script>

<template>
	<div :class="styles.root">
		<header :class="styles.header">
			<nav :class="styles.nav" aria-label="Preview navigation">
				<a href="/preview" :class="styles.brand">rawkode academy</a>

				<div :class="styles.navLinks">
					<a href="/preview/watch">Watch</a>
					<a href="/preview/learn">Learn</a>
					<a href="/technology/matrix">Matrix</a>
				</div>

				<div :class="styles.navActions">
					<button
						type="button"
						:class="styles.iconButton"
						:aria-label="isDark ? 'Use light theme' : 'Use dark theme'"
						:title="isDark ? 'Use light theme' : 'Use dark theme'"
						@click="toggleTheme"
					>
						{{ isDark ? "☼" : "◐" }}
					</button>
					<a href="#join" :class="[styles.buttonPrimary, styles.headerButton]">
						Join the Academy
					</a>
				</div>
			</nav>
		</header>

		<template v-if="props.page === 'home'">
			<section :class="styles.hero">
				<div :class="styles.heroInner">
					<div :class="styles.feature">
						<div :class="styles.featureCopy">
							<p :class="styles.kicker">Hands-on cloud native</p>
							<h1 :class="styles.title">{{ props.featured.title }}</h1>
							<p :class="styles.lede">{{ description(props.featured) }}</p>
							<p :class="styles.meta">
								{{ props.featured.meta.join(" · ") }}
							</p>
							<div :class="styles.actions">
								<a
									:href="props.featured.href"
									:class="styles.buttonPrimary"
								>
									Start watching <span aria-hidden="true">↗</span>
								</a>
								<Dialog
									tone="academy"
									size="sm"
									title="How Rawkode teaches"
									description="Real systems, explicit trade-offs, and enough context to make the call yourself."
								>
									<template #trigger>See the approach</template>
									<div>
										<p>
											Each lesson starts with the problem in front of
											an engineer, then follows the decisions that make
											the system hold up in production.
										</p>
										<ul>
											<li>See the constraints.</li>
											<li>Build the smallest useful system.</li>
											<li>Leave with judgment, not trivia.</li>
										</ul>
									</div>
									<template #footer>
										<a href="/courses" :class="styles.buttonGhost">
											Explore courses <span aria-hidden="true">→</span>
										</a>
									</template>
								</Dialog>
							</div>
							<div :class="styles.meta" aria-label="Academy archive stats">
								<span v-for="stat in props.stats" :key="stat.label">
									<strong>{{ stat.value }}</strong> {{ stat.label }}
								</span>
							</div>
						</div>

						<a :href="props.featured.href" :class="styles.featureArt">
							<img
								v-if="props.featured.mediaSrc"
								:src="props.featured.mediaSrc"
								:alt="props.featured.title"
								:class="styles.featureImage"
								loading="eager"
							/>
							<div v-else :class="styles.featureCopy">
								<span :class="styles.kicker">Rawkode Academy</span>
								<strong :class="styles.title">Build in public.</strong>
							</div>
						</a>
					</div>

					<Tabs :items="tabs" aria-label="Academy formats">
						<template #kubernetes>
							<strong>Start with the system you run.</strong>
							<span>Foundations, operations, and the details that make clusters predictable.</span>
						</template>
						<template #kueue>
							<strong>Follow the work all the way through.</strong>
							<span>From a real Kubernetes problem to a working queue, one decision at a time.</span>
						</template>
						<template #rust>
							<strong>Learn the tool by making something.</strong>
							<span>Short feedback loops for engineers who prefer a terminal to a slide deck.</span>
						</template>
						<template #systems>
							<strong>Keep the trade-offs visible.</strong>
							<span>Architecture is a sequence of choices, not a diagram you admire once.</span>
						</template>
					</Tabs>
				</div>
			</section>

			<section
				v-for="rail in [
					{ title: 'Latest', href: '/watch', items: props.videos },
					{ title: 'Learn by building', href: '/learning-paths', items: props.learningPaths },
					{ title: 'Read the reasoning', href: '/read', items: props.articles },
					{ title: 'Latest updates', href: '/news', items: props.news },
				]"
				:key="rail.title"
				:class="styles.section"
			>
				<div :class="styles.sectionInner">
					<div :class="styles.railHeader">
						<h2 :class="styles.railTitle">{{ rail.title }}</h2>
						<a :href="rail.href" :class="styles.railLink">View all →</a>
					</div>
					<div :class="styles.railTrack">
						<a
							v-for="item in rail.items"
							:key="item.href"
							:href="item.href"
							:class="styles.card"
						>
							<div :class="styles.cardArt">
								<img
									v-if="item.mediaSrc"
									:src="item.mediaSrc"
									:alt="item.title"
									:class="styles.cardImage"
									loading="lazy"
								/>
								<div v-else :class="styles.featureCopy">
									<span :class="styles.kicker">{{ item.meta[0] }}</span>
									<strong :class="styles.title">{{ item.title.slice(0, 1) }}</strong>
								</div>
							</div>
							<div :class="styles.cardMeta">
								<span>{{ item.meta[0] }}</span>
								<span>{{ item.meta[1] }}</span>
							</div>
							<h3 :class="styles.cardTitle">{{ item.title }}</h3>
						</a>
					</div>
				</div>
			</section>

			<section id="join" :class="styles.join">
				<div :class="styles.joinCopy">
					<h2 :class="styles.joinTitle">Make better calls.</h2>
					<p :class="styles.joinBody">
						One useful email when there is a new course, session, or systems lesson worth your time.
					</p>
				</div>
				<form :class="styles.joinForm" @submit.prevent="submitSubscription">
					<template v-if="!subscribed">
						<label for="preview-email" :class="styles.joinLabel">Your email</label>
						<div :class="styles.joinRow">
							<input
								id="preview-email"
								name="email"
								type="email"
								required
								placeholder="you@example.com"
								:class="styles.input"
							/>
							<button type="submit" :class="styles.buttonPrimary">Sign me up</button>
						</div>
						<label :class="styles.checkboxLabel">
							<input type="checkbox" required />
							<span>I want practical cloud native lessons, not inbox noise.</span>
						</label>
					</template>
					<p v-else :class="styles.joinBody" role="status">
						You are on the list. We will keep it useful.
					</p>
					<p :class="styles.finePrint">No spam. Unsubscribe whenever you want.</p>
				</form>
			</section>
		</template>

		<template v-else-if="props.page === 'learn'">
			<section :class="styles.pageHero">
				<div :class="styles.pageShell">
					<p :class="styles.pageKicker">Learn by building</p>
					<h1 :class="styles.pageTitle">A clear route through cloud native work.</h1>
					<p :class="styles.pageLede">
						Choose a path, follow the constraints, and finish with a system you can explain to the next engineer.
					</p>
				</div>
			</section>

			<section :class="styles.pageSection">
				<div :class="styles.pageSectionHead">
					<h2 :class="styles.railTitle">Learning paths</h2>
					<span :class="styles.meta">{{ props.learningPaths.length }} paths in the archive</span>
				</div>
				<div :class="styles.pathList">
					<a
						v-for="(path, index) in props.learningPaths"
						:key="path.href"
						:href="path.href"
						:class="styles.pathCard"
					>
						<span :class="styles.pathIndex">{{ String(index + 1).padStart(2, '0') }}</span>
						<div :class="styles.pathBody">
							<h2 :class="styles.pathTitle">{{ path.title }}</h2>
							<p :class="styles.pathDescription">{{ description(path) }}</p>
						</div>
						<span :class="styles.pathFact">
							{{ path.meta[0] }}<br />{{ path.meta[1] }}
						</span>
						<span :class="styles.pathArrow" aria-hidden="true">→</span>
					</a>
				</div>
			</section>

			<section :class="styles.pageSection">
				<div :class="styles.callout">
					<div>
						<h2 :class="styles.calloutTitle">Start with the work in front of you.</h2>
						<p :class="styles.calloutBody">
							The best route is the one that makes your next decision clearer. Every path is made from working lessons, supporting articles, and honest trade-offs.
						</p>
					</div>
					<div :class="styles.tagRow" aria-label="Learning themes">
						<span v-for="tag in ['Kubernetes', 'Platform engineering', 'Rust', 'Delivery']" :key="tag" :class="styles.tag">{{ tag }}</span>
					</div>
				</div>
			</section>
		</template>

		<template v-else>
			<section :class="styles.pageHero">
				<div :class="styles.pageShell">
					<p :class="styles.pageKicker">Watch working systems</p>
					<h1 :class="styles.pageTitle">The archive is the classroom.</h1>
					<p :class="styles.pageLede">
						Recorded sessions and live builds for the moments when a diagram is not enough.
					</p>
				</div>
			</section>

			<section :class="styles.pageSection">
				<div :class="styles.watchLayout">
					<div>
						<a :href="props.featured.href" :class="styles.videoFrame" :aria-label="`Play ${props.featured.title}`">
							<img
								v-if="props.featured.mediaSrc"
								:src="props.featured.mediaSrc"
								:alt="props.featured.title"
								:class="styles.videoImage"
							/>
							<div :class="styles.videoOverlay">
								<span :class="styles.play" aria-hidden="true">▶</span>
							</div>
						</a>
						<div :class="styles.watchCopy">
							<p :class="styles.kicker">Featured session</p>
							<h2 :class="styles.watchTitle">{{ props.featured.title }}</h2>
							<div :class="styles.watchBody">
								<p>{{ description(props.featured) }}</p>
								<ul>
									<li>Watch the build, not just the finished diagram.</li>
									<li>Pause on the decision that changes the system.</li>
									<li>Take the next step in a learning path.</li>
								</ul>
							</div>
						</div>
					</div>

					<aside :class="styles.watchAside">
						<p :class="styles.railTitle">Session details</p>
						<div :class="styles.watchFact">
							Format<strong>{{ props.featured.meta[0] || 'Recorded session' }}</strong>
						</div>
						<div :class="styles.watchFact">
							Archive<strong>{{ props.videos.length }} recent sessions</strong>
						</div>
						<div :class="styles.resourceLinks">
							<a href="/watch">Browse all sessions <span aria-hidden="true">→</span></a>
							<a href="/learning-paths">Find a learning path <span aria-hidden="true">→</span></a>
						</div>
					</aside>
				</div>
			</section>
		</template>

		<footer :class="styles.footer">
			<span>Rawkode Academy · practical cloud native education</span>
			<nav :class="styles.footerNav" aria-label="Footer navigation">
				<a href="/preview">Home</a>
				<a href="/preview/learn">Learn</a>
				<a href="/preview/watch">Watch</a>
				<a href="/organizations/partnerships">For teams</a>
			</nav>
		</footer>
	</div>
</template>
