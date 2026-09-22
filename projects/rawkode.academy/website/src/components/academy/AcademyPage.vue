<script setup lang="ts">
import { academyPage } from "@rawkodeacademy/design-system";

interface AcademyCard {
	href: string;
	title: string;
	description: string;
	meta: string[];
	publishedAt?: string;
	kind?: string;
	mediaSrc?: string;
}
interface ArchiveLink {
	href: string;
	value: string;
	label: string;
}
interface HomeProps {
	page?: "home";
	featured: AcademyCard;
	latest: AcademyCard[];
	learningPaths: AcademyCard[];
	archive: ArchiveLink[];
}
interface LearnProps {
	page: "learn";
	learningPaths: AcademyCard[];
	// Exclude Home data while keeping Vue's generated runtime props optional.
	featured?: never;
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

// Ledger dates are calendar days in UTC. The day is the numeral; the month
// and year sit beneath it.
const dayOf = new Intl.DateTimeFormat("en-GB", {
	day: "2-digit",
	timeZone: "UTC",
});
const monthOf = new Intl.DateTimeFormat("en-GB", {
	month: "short",
	year: "numeric",
	timeZone: "UTC",
});
const dateParts = (iso: string) => {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return undefined;
	return { day: dayOf.format(date), month: monthOf.format(date) };
};
</script>

<template>
	<div :class="styles.root">
		<template v-if="props.page === 'home'">
			<section :class="styles.hero" aria-labelledby="home-title">
				<div :class="styles.container">
					<h1 id="home-title" :class="styles.title"><span :class="styles.titleLine">Understand</span><span :class="[styles.titleLine, styles.titleAccent]">the system.</span></h1>
					<div :class="styles.heroGrid">
						<div :class="styles.heroCopy">
							<p :class="styles.heroLede">Cloud native, taught by the engineers doing the work, with every decision on screen.</p>
							<div :class="styles.actions">
								<a :href="props.featured.href" :class="styles.buttonPrimary">Watch the latest session <span aria-hidden="true">→</span></a>
								<a href="/watch" :class="styles.buttonGhost">Browse the library</a>
							</div>
						</div>
						<a :href="props.featured.href" :class="styles.featureCard" :aria-label="`Watch ${props.featured.title}`">
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
					<nav :class="styles.archive" aria-label="Academy archive">
						<a v-for="link in props.archive" :key="link.href" :href="link.href" :class="styles.archiveLink"><strong>{{ link.value }}</strong><span>{{ link.label }}</span></a>
						<span :class="styles.archiveNote">Open to everyone.</span>
					</nav>
				</div>
			</section>
			<section :class="styles.section" aria-labelledby="latest-title">
				<div :class="styles.sectionHead">
					<div><h2 id="latest-title" :class="styles.sectionTitle">Recently published</h2><p :class="styles.sectionLede">One stream, in order: sessions, articles, news, and courses as they land.</p></div>
					<a href="/search" :class="styles.textLink">Search the archive <span aria-hidden="true">→</span></a>
				</div>
				<div :class="styles.ledger">
					<a v-for="item in props.latest.slice(0, 6)" :key="item.href" :href="item.href" :class="styles.ledgerRow" :data-media="Boolean(item.mediaSrc)">
						<time v-if="item.publishedAt" :datetime="item.publishedAt" :class="styles.ledgerDate"><template v-if="dateParts(item.publishedAt)"><strong>{{ dateParts(item.publishedAt)?.day }}</strong><span>{{ dateParts(item.publishedAt)?.month }}</span></template><template v-else>{{ item.meta[1] }}</template></time>
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
		<section v-else :class="styles.pageHero">
			<div :class="styles.container">
				<div :class="styles.pageHeroGrid">
					<h1 :class="styles.pageTitle">Learning paths</h1>
					<div :class="styles.pageHeroAside">
						<p :class="styles.pageLede">A sequence of related lessons, articles, and working sessions. Start at the top and follow the order.</p>
						<p :class="styles.heroFigure"><strong>{{ props.learningPaths.length }}</strong><span>{{ props.learningPaths.length === 1 ? "learning path" : "learning paths" }}</span></p>
					</div>
				</div>
			</div>
		</section>
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

		<section v-if="props.page === 'home'" id="join" :class="styles.newsletter" aria-labelledby="newsletter-title">
			<div :class="styles.newsletterCopy"><h2 id="newsletter-title" :class="styles.sectionTitle">Keep learning</h2><p :class="styles.lede">New sessions, articles, and courses from the Academy, sent when they publish. Nothing else.</p></div>
			<form :class="styles.newsletterForm" action="https://email.rawkode.academy/subscribe" method="post"><label for="academy-email">Your email address</label><div :class="styles.newsletterRow"><input id="academy-email" name="email" type="email" required autocomplete="email" placeholder="you@example.com" :class="styles.input" /><button type="submit" :class="styles.buttonPrimary">Subscribe <span aria-hidden="true">→</span></button></div><p :class="styles.finePrint">Unsubscribe at any time. <a href="/privacy">Privacy policy</a></p></form>
		</section>
	</div>
</template>
