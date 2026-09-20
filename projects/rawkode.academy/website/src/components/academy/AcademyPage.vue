<script setup lang="ts">
import { academyCatalog, academyPage } from "@rawkodeacademy/design-system";

interface AcademyCard {
	href: string;
	title: string;
	description: string;
	meta: string[];
	publishedAt?: string;
	kind?: string;
	mediaSrc?: string;
}
interface HomeProps {
	page?: "home";
	featured: AcademyCard;
	latest: AcademyCard[];
	learningPaths: AcademyCard[];
	stats: Array<{ value: string; label: string }>;
}
interface LearnProps {
	page: "learn";
	learningPaths: AcademyCard[];
	// Exclude Home data while keeping Vue's generated runtime props optional.
	featured?: never;
	latest?: never;
	stats?: never;
}
const props = withDefaults(defineProps<HomeProps | LearnProps>(), { page: "home" });
const styles = academyPage();
const catalog = academyCatalog();
const formats = [
	{ href: "/watch", title: "Watch", copy: "Real builds. Every decision explained." },
	{ href: "/read", title: "Read", copy: "Technical ideas, taken apart carefully." },
	{ href: "/courses", title: "Learn", copy: "Structured courses. Practical outcomes." },
];
</script>

<template>
	<div :class="styles.root">
		<template v-if="props.page === 'home'">
			<section :class="styles.hero" aria-labelledby="home-title">
				<div :class="styles.container">
					<p :class="styles.kicker">Independent cloud native education</p>
					<div :class="styles.feature">
						<div :class="styles.featureCopy">
							<h1 id="home-title" :class="styles.title">Understand<br /><span :class="styles.titleAccent">the system.</span></h1>
							<p :class="styles.lede">Build it. Break it. Find out why.<br />Learn cloud native with the engineers doing the work.</p>
							<div :class="styles.actions">
								<a href="/watch" :class="styles.buttonPrimary">Explore lessons <span aria-hidden="true">→</span></a>
								<a href="/about" :class="styles.textLink">Our approach <span aria-hidden="true">↗</span></a>
							</div>
						</div>
						<a :href="props.featured.href" :class="styles.featureCard">
							<div :class="styles.featureArt">
								<img v-if="props.featured.mediaSrc" :src="props.featured.mediaSrc" alt="" :class="styles.featureImage" width="1280" height="720" fetchpriority="high" />
								<span :class="styles.play" aria-hidden="true">▶</span>
							</div>
							<div :class="styles.featureCaption">
								<p :class="styles.cardMeta"><span>Latest session</span><span>{{ props.featured.meta[1] }}</span></p>
								<h2 :class="styles.featureTitle">{{ props.featured.title }} <span aria-hidden="true">↗</span></h2>
							</div>
						</a>
					</div>
					<div :class="styles.archiveNote" aria-label="Academy archive">
						<span v-for="stat in props.stats" :key="stat.label"><strong>{{ stat.value }}</strong> {{ stat.label.toLowerCase() }}</span>
						<span>Open to everyone.</span>
					</div>
				</div>
			</section>
			<nav :class="styles.formatNav" aria-label="Ways to learn">
				<a v-for="format in formats" :key="format.href" :href="format.href" :class="styles.formatLink"><span :class="styles.formatHeading">{{ format.title }} <span aria-hidden="true">↗</span></span><span :class="styles.cardDescription">{{ format.copy }}</span></a>
			</nav>
			<section :class="styles.section" aria-labelledby="latest-title">
				<div :class="styles.sectionHead"><h2 id="latest-title" :class="styles.sectionTitle">Recently published.</h2><a href="/search" :class="styles.textLink">Explore everything <span aria-hidden="true">→</span></a></div>
				<div :class="catalog.editorialList">
					<a v-for="item in props.latest.slice(0, 6)" :key="item.href" :href="item.href" :class="catalog.editorialRow" :data-media="Boolean(item.mediaSrc)">
						<img v-if="item.mediaSrc" :src="item.mediaSrc" alt="" :class="catalog.editorialImage" width="640" height="360" loading="lazy" />
						<div :class="catalog.editorialBody"><p :class="styles.cardMeta"><span>{{ item.kind || item.meta[0] }}</span><time v-if="item.publishedAt" :datetime="item.publishedAt">{{ item.meta[1] }}</time></p><h3 :class="catalog.editorialTitle">{{ item.title }}</h3><p :class="styles.cardDescription">{{ item.description }}</p></div>
					</a>
				</div>
			</section>
		</template>
		<section v-else :class="styles.pageHero">
			<div :class="styles.container"><div :class="styles.pageHeroGrid"><h1 :class="styles.pageTitle">Learning paths.</h1><p :class="styles.lede">Follow a sequence of related lessons, articles, and working sessions.</p></div></div>
		</section>
		<section v-if="props.learningPaths.length" :class="styles.section" :aria-labelledby="props.page === 'home' ? 'paths-title' : undefined" :aria-label="props.page === 'learn' ? 'Available learning paths' : undefined">
			<div v-if="props.page === 'home'" :class="styles.sectionHead"><h2 id="paths-title" :class="styles.sectionTitle">Choose a learning path.</h2><a href="/learning-paths" :class="styles.textLink">All learning paths <span aria-hidden="true">→</span></a></div>
			<div :class="styles.pathList">
					<a v-for="path in (props.page === 'home' ? props.learningPaths.slice(0, 3) : props.learningPaths)" :key="path.href" :href="path.href" :class="styles.pathCard"><div :class="styles.pathBody"><component :is="props.page === 'home' ? 'h3' : 'h2'" :class="styles.pathTitle">{{ path.title }}</component><p :class="styles.cardDescription">{{ path.description }}</p><p :class="styles.pathMeta">{{ path.meta.join(' · ') }}</p></div><span :class="styles.pathArrow" aria-hidden="true">↗</span></a>
			</div>
		</section>

		<section v-if="props.page === 'home'" id="join" :class="styles.newsletter" aria-labelledby="newsletter-title">
			<div><h2 id="newsletter-title" :class="styles.sectionTitle">Keep learning.</h2><p :class="styles.lede">New lessons, courses, and ideas from the Academy, in your inbox.</p></div>
			<form :class="styles.newsletterForm" action="https://email.rawkode.academy/subscribe" method="post"><label for="academy-email">Your email address</label><div :class="styles.newsletterRow"><input id="academy-email" name="email" type="email" required autocomplete="email" placeholder="you@example.com" :class="styles.input" /><button type="submit" :class="styles.buttonPrimary">Subscribe <span aria-hidden="true">→</span></button></div><p :class="styles.finePrint">Unsubscribe at any time. <a href="/privacy">Privacy policy</a></p></form>
		</section>
	</div>
</template>
