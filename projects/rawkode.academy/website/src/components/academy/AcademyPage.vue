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
const props = withDefaults(defineProps<{
	page?: "home" | "learn";
	featured: AcademyCard;
	latest: AcademyCard[];
	// Compatibility: Home and Learn still supply this prop.
	videos: AcademyCard[];
	learningPaths: AcademyCard[];
	stats: Array<{ value: string; label: string }>;
}>(), { page: "home" });
const styles = academyPage();
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
				<div :class="styles.sectionHead"><div><p :class="styles.kicker">Across the Academy</p><h2 id="latest-title" :class="styles.sectionTitle">Fresh perspectives.</h2></div><a href="/search" :class="styles.textLink">Explore everything <span aria-hidden="true">→</span></a></div>
				<div :class="styles.feedGrid">
					<a v-for="item in props.latest.slice(0, 6)" :key="item.href" :href="item.href" :class="styles.card">
						<div v-if="item.mediaSrc" :class="styles.cardArt"><img :src="item.mediaSrc" alt="" :class="styles.cardImage" width="640" height="360" loading="lazy" /></div>
						<div :class="styles.cardBody"><p :class="styles.cardMeta"><span>{{ item.kind || item.meta[0] }}</span><time v-if="item.publishedAt" :datetime="item.publishedAt">{{ item.meta[1] }}</time></p><h3 :class="styles.cardTitle">{{ item.title }}</h3><p :class="styles.cardDescription">{{ item.description }}</p></div>
					</a>
				</div>
			</section>
		</template>
		<section v-else :class="styles.pageHero">
			<div :class="styles.container"><p :class="styles.kicker">Build your understanding</p><div :class="styles.pageHeroGrid"><h1 :class="styles.pageTitle">Learning paths.</h1><p :class="styles.lede">A sequence of lessons that connects the dots. Pick a path and build something you understand.</p></div></div>
		</section>
		<section v-if="props.learningPaths.length" :class="styles.section" aria-labelledby="paths-title">
			<div :class="styles.sectionHead"><div><p v-if="props.page === 'home'" :class="styles.kicker">Go a little deeper</p><h2 id="paths-title" :class="styles.sectionTitle">{{ props.page === 'home' ? 'A path worth following.' : 'Choose your next project' }}</h2></div><a v-if="props.page === 'home'" href="/learning-paths" :class="styles.textLink">All learning paths <span aria-hidden="true">→</span></a><span v-else :class="styles.resultCount">{{ props.learningPaths.length }} paths · self-paced</span></div>
			<div :class="styles.pathList">
				<a v-for="(path, index) in (props.page === 'home' ? props.learningPaths.slice(0, 3) : props.learningPaths)" :key="path.href" :href="path.href" :class="styles.pathCard"><span :class="styles.pathIndex" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span><div :class="styles.pathBody"><h3 :class="styles.pathTitle">{{ path.title }}</h3><p :class="styles.cardDescription">{{ path.description }}</p><p :class="styles.pathMeta">{{ path.meta.join(' · ') }}</p></div><span :class="styles.pathArrow" aria-hidden="true">↗</span></a>
			</div>
		</section>

		<section v-if="props.page === 'home'" id="join" :class="styles.newsletter" aria-labelledby="newsletter-title">
			<div><p :class="styles.kicker">Keep learning</p><h2 id="newsletter-title" :class="styles.sectionTitle">Good things.<br />In your inbox.</h2><p :class="styles.lede">New lessons, courses, and ideas from the Academy.</p></div>
			<form :class="styles.newsletterForm" action="https://email.rawkode.academy/subscribe" method="post"><label for="academy-email">Your email address</label><div :class="styles.newsletterRow"><input id="academy-email" name="email" type="email" required autocomplete="email" placeholder="you@example.com" :class="styles.input" /><button type="submit" :class="styles.buttonPrimary">Subscribe <span aria-hidden="true">→</span></button></div><p :class="styles.finePrint">Unsubscribe at any time. <a href="/privacy">Privacy policy</a></p></form>
		</section>
	</div>
</template>
