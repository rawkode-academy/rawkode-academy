<script setup lang="ts">
import { academyPage } from "@rawkodeacademy/design-system";
import { localTime } from "@/lib/local-time";

interface AcademyCard {
	href: string;
	title: string;
	description: string;
	meta: string[];
	publishedAt?: string;
	kind?: string;
	mediaSrc?: string;
	// Serialised local-time spec; the date in meta[1] follows the reader's zone.
	localTime?: string;
}
interface ArchiveLink {
	href: string;
	value: string;
	label: string;
}
interface HomeProps {
	page?: "home";
	featured: AcademyCard;
	upcoming?: AcademyCard[];
	latest: AcademyCard[];
	learningPaths: AcademyCard[];
	archive: ArchiveLink[];
}
interface LearnProps {
	page: "learn";
	learningPaths: AcademyCard[];
	// Exclude Home data while keeping Vue's generated runtime props optional.
	featured?: never;
	upcoming?: never;
	latest?: never;
	archive?: never;
}
const props = withDefaults(defineProps<HomeProps | LearnProps>(), { page: "home" });
const styles = academyPage();

// Difficulty reads as a three-bar meter beside its label, so the level is
// never carried by colour alone.
const levelOf = (label: string) => {
	const value = label.toLowerCase();
	if (value.startsWith("beginner")) return 1;
	if (value.startsWith("intermediate")) return 2;
	if (value.startsWith("advanced")) return 3;
	return 0;
};
const pad = (index: number) => String(index + 1).padStart(2, "0");

// Ledger dates: the day is the numeral; the month and year sit beneath it.
// Both render in UTC and follow the reader's time zone in the browser.
const dateParts = (iso: string) => {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return undefined;
	const day = localTime(date, { day: "2-digit" }, "en-GB");
	const month = localTime(date, { month: "short", year: "numeric" }, "en-GB");
	return {
		day: day.text,
		dayAttrs: { "data-datetime": day.iso, "data-local-time": day.attrs["data-local-time"] },
		month: month.text,
		monthAttrs: { "data-datetime": month.iso, "data-local-time": month.attrs["data-local-time"] },
	};
};
</script>

<template>
	<div :class="styles.root">
		<template v-if="props.page === 'home'">
			<section :class="styles.hero" aria-labelledby="home-title" data-system>
				<canvas :class="styles.system" data-system-canvas aria-hidden="true" />
				<div :class="styles.container">
					<h1 id="home-title" :class="styles.title"><span :class="styles.titleLine" data-system-avoid="text">Understand</span><span :class="[styles.titleLine, styles.titleAccent]" data-system-avoid="text">the system.</span></h1>
					<div :class="styles.heroGrid">
						<div :class="styles.heroCopy" data-system-avoid>
							<p :class="styles.heroLede">Cloud native, taught by the engineers doing the work, with every decision on screen.</p>
							<div :class="styles.actions">
								<a :href="props.featured.href" :class="styles.buttonPrimary">Watch the latest session <span aria-hidden="true">→</span></a>
								<a href="/watch" :class="styles.buttonGhost">Browse the library</a>
							</div>
						</div>
						<a :href="props.featured.href" :class="styles.featureCard" :aria-label="`Watch ${props.featured.title}`" data-system-avoid>
							<span :class="styles.featureArt">
								<img v-if="props.featured.mediaSrc" :src="props.featured.mediaSrc" alt="" :class="styles.featureImage" width="1280" height="720" fetchpriority="high" />
								<span :class="styles.play" data-play aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12-7.5z" /></svg></span>
								<span v-if="props.featured.meta[1]" :class="styles.featureRuntime" aria-hidden="true">{{ props.featured.meta[1] }}</span>
							</span>
							<span :class="styles.featureCaption">
								<span :class="styles.featureKicker">{{ props.featured.meta[0] }}</span>
								<h2 :class="styles.featureTitle">{{ props.featured.title }}</h2>
							</span>
						</a>
					</div>
					<nav :class="styles.archive" aria-label="Academy archive" data-system-avoid>
						<a v-for="link in props.archive" :key="link.href" :href="link.href" :class="styles.archiveLink" :aria-label="`${link.label}, ${link.value}`">{{ link.label }}<sup aria-hidden="true">{{ link.value }}</sup></a>
						<span :class="styles.archiveNote">Open to everyone.</span>
					</nav>
				</div>
			</section>
			<section v-if="props.upcoming?.length" :class="styles.section" aria-labelledby="upcoming-title">
				<div :class="styles.sectionHead">
					<div><h2 id="upcoming-title" :class="styles.sectionTitle">Upcoming live streams</h2><p :class="styles.sectionLede">Scheduled builds, shown in your time zone. Join live and ask questions as we go.</p></div>
					<a href="/watch" :class="styles.textLink">All videos <span aria-hidden="true">→</span></a>
				</div>
				<div :class="styles.feedGrid">
					<a v-for="item in props.upcoming" :key="item.href" :href="item.href" :class="styles.card">
						<div :class="styles.cardArt">
							<img v-if="item.mediaSrc" :src="item.mediaSrc" alt="" :class="styles.cardImage" width="640" height="360" loading="lazy" />
						</div>
						<div :class="styles.cardBody">
							<p :class="styles.cardMeta">{{ item.meta[0] }} · <time :datetime="item.publishedAt" :data-local-time="item.localTime">{{ item.meta[1] }}</time></p>
							<h3 :class="styles.cardTitle">{{ item.title }}</h3>
							<p :class="styles.lede">{{ item.description }}</p>
						</div>
					</a>
				</div>
			</section>
			<section :class="styles.section" aria-labelledby="latest-title">
				<div :class="styles.sectionHead">
					<div><h2 id="latest-title" :class="styles.sectionTitle">Recently published</h2><p :class="styles.sectionLede">One stream, in order: sessions, articles, news, and courses as they land.</p></div>
					<a href="/search" :class="styles.textLink">Search the archive <span aria-hidden="true">→</span></a>
				</div>
				<div :class="styles.ledger">
					<a v-for="item in props.latest.slice(0, 6)" :key="item.href" :href="item.href" :class="styles.ledgerRow" :data-media="Boolean(item.mediaSrc)">
						<time v-if="item.publishedAt" :datetime="item.publishedAt" :class="styles.ledgerDate"><template v-if="dateParts(item.publishedAt)"><strong v-bind="dateParts(item.publishedAt)?.dayAttrs">{{ dateParts(item.publishedAt)?.day }}</strong><span v-bind="dateParts(item.publishedAt)?.monthAttrs">{{ dateParts(item.publishedAt)?.month }}</span></template><template v-else>{{ item.meta[1] }}</template></time>
						<span v-if="item.mediaSrc" :class="styles.ledgerMedia"><img :src="item.mediaSrc" alt="" :class="styles.ledgerImage" width="640" height="360" loading="lazy" /></span>
						<span :class="styles.ledgerBody" data-body>
							<span :class="styles.ledgerKind" :data-kind="item.kind || item.meta[0]">{{ item.kind || item.meta[0] }}<template v-if="item.meta[2]"> · {{ item.meta[2] }}</template></span>
							<h3 :class="styles.ledgerTitle">{{ item.title }}</h3>
							<span :class="styles.ledgerDescription">{{ item.description }}</span>
						</span>
					</a>
				</div>
			</section>
		</template>
		<section v-if="props.learningPaths.length" :class="styles.section" :aria-labelledby="props.page === 'home' ? 'paths-title' : undefined" :aria-label="props.page === 'learn' ? 'Available learning paths' : undefined">
			<div v-if="props.page === 'home'" :class="styles.sectionHead">
				<div><h2 id="paths-title" :class="styles.sectionTitle">Choose a learning path</h2><p :class="styles.sectionLede">Ordered routes through the archive, with the hours of core video counted honestly.</p></div>
				<a href="/learning-paths" :class="styles.textLink">All learning paths <span aria-hidden="true">→</span></a>
			</div>
			<div :class="styles.pathList">
				<a v-for="(path, index) in (props.page === 'home' ? props.learningPaths.slice(0, 3) : props.learningPaths)" :key="path.href" :href="path.href" :class="styles.pathCard">
					<span :class="styles.pathIndex" data-index aria-hidden="true">{{ pad(index) }}</span>
					<span :class="styles.pathBody">
						<component :is="props.page === 'home' ? 'h3' : 'h2'" :class="styles.pathTitle">{{ path.title }}</component>
						<span :class="styles.cardDescription">{{ path.description }}</span>
						<span :class="styles.pathMeta">
							<span :class="styles.pathLevel" aria-hidden="true"><i v-for="bar in 3" :key="bar" :class="styles.pathLevelBar" :data-on="bar <= levelOf(path.meta[0])" /></span>
							<span>{{ path.meta[0] }}</span>
							<span v-if="path.meta[1]">· {{ path.meta[1] }}</span>
						</span>
					</span>
					<span :class="styles.pathArrow" data-arrow aria-hidden="true">↗</span>
				</a>
			</div>
		</section>
	</div>
</template>
