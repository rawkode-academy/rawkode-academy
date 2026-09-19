<script setup lang="ts">
import { ref, onMounted } from "vue";
import {
	academyPage,
	tabs as academyTabs,
} from "@rawkodeacademy/design-system";
import { Dialog, Tabs } from "@rawkodeacademy/design-system/vue";
import { getColorScheme, setColorScheme } from "@/lib/theme";

type AcademyPage = "home" | "learn" | "watch";

interface AcademyCard {
	href: string;
	title: string;
	description: string;
	meta: string[];
	publishedAt?: string;
	kind?: string;
	mediaSrc?: string;
}

interface AcademyPath extends AcademyCard {
	meta: [string, string];
}

interface Props {
	page?: AcademyPage;
	featured: AcademyCard;
	latest: AcademyCard[];
	videos: AcademyCard[];
	learningPaths: AcademyPath[];
	stats: Array<{ value: string; label: string }>;
}

const props = withDefaults(defineProps<Props>(), {
	page: "home",
});

const styles = academyPage();
const tabStyles = academyTabs({ tone: "academy" });
const isDark = ref(false);
const isMounted = ref(false);

onMounted(() => {
	isMounted.value = true;
	isDark.value = getColorScheme() === "dark";
});

const toggleTheme = () => {
	isDark.value = !isDark.value;
	setColorScheme(isDark.value ? "dark" : "light");
};

const tabs = [
	{ value: "kubernetes", label: "Kubernetes" },
	{ value: "kueue", label: "Kueue" },
	{ value: "rust", label: "Rust" },
	{ value: "systems", label: "Systems" },
];

const description = (item: AcademyCard) =>
	item.description || "A practical session from the Rawkode Academy archive.";
</script>

<template>
	<div :class="styles.root">
		<header :class="styles.header">
			<nav :class="styles.nav" aria-label="Primary navigation">
				<a href="/" :class="styles.brand">rawkode academy</a>

				<div :class="styles.navLinks">
					<a href="/watch">Watch</a>
					<a href="/read">Read</a>
					<a href="/learning-paths">Learn</a>
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
									v-if="isMounted"
									id="academy-approach"
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
								<a v-else href="/about" :class="styles.buttonGhost">
									See the approach
								</a>
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

					<Tabs
						v-if="isMounted"
						id="academy-formats"
						:items="tabs"
						aria-label="Academy formats"
					>
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
					<div v-else :class="tabStyles.root">
						<div
							:class="tabStyles.list"
							role="tablist"
							aria-label="Academy formats"
						>
							<span
								v-for="(item, index) in tabs"
								:key="item.value"
								:class="tabStyles.trigger"
								role="tab"
								:aria-selected="index === 0"
								:data-selected="index === 0 ? '' : undefined"
							>
								{{ item.label }}
							</span>
						</div>
						<div :class="tabStyles.content" role="tabpanel">
							<strong>Start with the system you run.</strong>
							<span>Foundations, operations, and the details that make clusters predictable.</span>
						</div>
					</div>
				</div>
			</section>

			<section
				v-for="rail in [
					{ title: 'Latest', href: '/search', items: props.latest },
					{ title: 'Learn by building', href: '/learning-paths', items: props.learningPaths },
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
				<form
					:class="styles.joinForm"
					action="https://email.rawkode.academy/subscribe"
					method="post"
				>
					<label for="academy-email" :class="styles.joinLabel">Your email</label>
					<div :class="styles.joinRow">
						<input
							id="academy-email"
							name="email"
							type="email"
							required
							autocomplete="email"
							placeholder="you@example.com"
							:class="styles.input"
						/>
						<button type="submit" :class="styles.buttonPrimary">Sign me up</button>
					</div>
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
							<a href="#watch-archive-title">Browse all sessions <span aria-hidden="true">→</span></a>
							<a href="/learning-paths">Find a learning path <span aria-hidden="true">→</span></a>
						</div>
					</aside>
				</div>
			</section>

			<section :class="styles.section" aria-labelledby="watch-archive-title">
				<div :class="styles.sectionInner">
					<div :class="styles.railHeader">
						<h2 id="watch-archive-title" :class="styles.railTitle">Video archive</h2>
						<span :class="styles.meta">{{ props.videos.length }} sessions</span>
					</div>
					<div :class="styles.railTrack">
						<a
							v-for="item in props.videos"
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
		</template>

		<footer :class="styles.footer">
			<span>Rawkode Academy · practical cloud native education</span>
			<nav :class="styles.footerNav" aria-label="Footer navigation">
				<a href="/">Home</a>
				<a href="/learning-paths">Learn</a>
				<a href="/watch">Watch</a>
				<a href="/read">Read</a>
				<a href="/organizations/partnerships">For teams</a>
			</nav>
		</footer>
	</div>
</template>
