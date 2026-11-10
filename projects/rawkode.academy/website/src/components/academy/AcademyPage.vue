<script setup lang="ts">
import { academyPage, button } from "@rawkodeacademy/design-system";
import { localDate, localDateTime, localTime } from "@/lib/local-time";

interface AcademyCard {
	href: string;
	title: string;
	description: string;
	meta: string[];
}
/** A collection in the hero index: its name, its real size, one line on it. */
interface IndexLink {
	href: string;
	label: string;
	count: number;
	description: string;
}
/** The latest session. Every fact is optional: a missing one is left out. */
interface Session {
	href: string;
	title: string;
	publishedAt: string;
	mediaSrc?: string;
	runtime?: string;
	guests?: string[];
	show?: { href: string; name: string; episodes: number };
}
interface LedgerEntry {
	href: string;
	title: string;
	publishedAt: string;
	meta?: string[];
	description?: string;
	mediaSrc?: string;
}
/** One collection's recent entries. A column with no entries is not drawn. */
interface LedgerColumn {
	id: string;
	title: string;
	href: string;
	more: string;
	total?: number;
	entries: LedgerEntry[];
}
interface Stream {
	href: string;
	title: string;
	description?: string;
	publishedAt: string;
	mediaSrc?: string;
}
interface PathRow extends AcademyCard {
	/** Sessions the path puts in order, when its content counts them. */
	sessions?: number;
}
interface HomeProps {
	page?: "home";
	collections: IndexLink[];
	featured?: Session | undefined;
	ledger: LedgerColumn[];
	upcoming?: Stream[];
	learningPaths: PathRow[];
}
interface LearnProps {
	page: "learn";
	learningPaths: AcademyCard[];
	// Exclude Home data while keeping Vue's generated runtime props optional.
	collections?: never;
	featured?: never;
	ledger?: never;
	upcoming?: never;
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
const count = (value: number, singular: string, plural = `${singular}s`) =>
	`${value} ${value === 1 ? singular : plural}`;

// Every date renders in UTC and follows the reader's time zone in the
// browser: the element carries its instant and the format it wants.
const part = (iso: string, options: Intl.DateTimeFormatOptions) => {
	const value = localTime(iso, options, "en-GB");
	return {
		text: value.text,
		attrs: { "data-datetime": value.iso, "data-local-time": value.attrs["data-local-time"] },
	};
};
const valid = (iso: string) => !Number.isNaN(new Date(iso).getTime());
// Ledger dates: the day is the numeral; the month and year sit beneath it.
const dateParts = (iso: string) =>
	valid(iso)
		? { day: part(iso, { day: "2-digit" }), month: part(iso, { month: "short", year: "numeric" }) }
		: undefined;
// A scheduled start: the day at numeral scale, then the date and the time.
const startParts = (iso: string) =>
	valid(iso)
		? {
				day: part(iso, { day: "2-digit" }),
				date: part(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
				time: part(iso, { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }),
			}
		: undefined;

const columns = (props.ledger ?? []).filter((column) => column.entries.length > 0);
const entryCount = columns.reduce((total, column) => total + column.entries.length, 0);
const featuredDate = props.featured && valid(props.featured.publishedAt) ? localDate(props.featured.publishedAt) : undefined;
const [nextStream, ...laterStreams] = (props.upcoming ?? []).filter((stream) => valid(stream.publishedAt));
const nextStart = nextStream ? startParts(nextStream.publishedAt) : undefined;
const nextStartShort = nextStream ? localDateTime(nextStream.publishedAt) : undefined;
const laterStarts = laterStreams.map((stream) => ({ ...stream, start: localDateTime(stream.publishedAt) }));
</script>

<template>
	<div :class="styles.root">
		<template v-if="props.page === 'home'">
			<section :class="styles.hero" aria-labelledby="home-title" data-system>
				<canvas :class="styles.system" data-system-canvas aria-hidden="true" />
				<div :class="styles.container">
					<h1 id="home-title" :class="styles.title"><span :class="styles.titleLine" data-system-avoid="text">Understand</span> <span :class="styles.titleLine" data-system-avoid="text">the system<span :class="styles.titleAccent">.</span></span></h1>
					<div :class="styles.heroSub">
						<p :class="styles.heroLede" data-system-avoid="text">Cloud native, taught by the engineers doing the work, with every decision on screen.</p>
						<dl v-if="featuredDate || nextStartShort" :class="styles.heroFacts" data-system-avoid>
							<div v-if="featuredDate"><dt>Latest session</dt><dd><time v-bind="featuredDate.attrs">{{ featuredDate.text }}</time></dd></div>
							<div v-if="nextStartShort"><dt>Next live</dt><dd><time v-bind="nextStartShort.attrs">{{ nextStartShort.text }}</time></dd></div>
						</dl>
					</div>
					<nav v-if="props.collections.length" aria-label="The archive" data-system-avoid>
						<ul :class="styles.index">
							<li v-for="link in props.collections" :key="link.href">
								<a :href="link.href" :class="styles.indexLink">
									<span :class="styles.indexName" data-name>{{ link.label }}<sup aria-hidden="true">{{ link.count }}</sup><span :class="styles.visuallyHidden">, {{ link.count }} in the archive.</span></span> <span :class="styles.indexWhat">{{ link.description }}</span>
									<span :class="styles.indexArrow" data-arrow aria-hidden="true">→</span>
								</a>
							</li>
						</ul>
					</nav>
				</div>
			</section>
			<section v-if="props.featured" :class="styles.sectionLead" aria-labelledby="latest-session-title">
				<div :class="styles.spread">
					<a :href="props.featured.href" :class="styles.plate" tabindex="-1" aria-hidden="true">
						<img v-if="props.featured.mediaSrc" :src="props.featured.mediaSrc" alt="" :class="styles.plateImage" width="1280" height="720" fetchpriority="high" />
						<span v-if="props.featured.runtime" :class="styles.plateRuntime"><svg viewBox="0 0 10 12"><path d="M0 0l10 6-10 6z" /></svg>{{ props.featured.runtime }}</span>
					</a>
					<div :class="styles.colophon">
						<p :class="styles.dotLabel">Latest session</p>
						<h2 id="latest-session-title" :class="styles.colophonTitle">{{ props.featured.title }}</h2>
						<dl :class="styles.facts">
							<div v-if="featuredDate"><dt>Published</dt><dd><time v-bind="featuredDate.attrs">{{ featuredDate.text }}</time></dd></div>
							<div v-if="props.featured.runtime"><dt>Runtime</dt><dd>{{ props.featured.runtime }}</dd></div>
							<div v-if="props.featured.guests?.length"><dt>{{ props.featured.guests.length === 1 ? "Guest" : "Guests" }}</dt><dd>{{ props.featured.guests.join(", ") }}</dd></div>
							<div v-if="props.featured.show"><dt>Show</dt><dd><a :href="props.featured.show.href">{{ props.featured.show.name }}</a> <small v-if="props.featured.show.episodes > 0">{{ count(props.featured.show.episodes, "episode") }}</small></dd></div>
						</dl>
						<a :href="props.featured.href" :class="button({ size: 'lg' })">Watch the session <span data-part="arrow" aria-hidden="true">→</span></a>
					</div>
				</div>
			</section>
			<section v-if="columns.length" :class="styles.section" aria-labelledby="latest-title">
				<div :class="styles.sectionHead">
					<h2 id="latest-title" :class="styles.sectionTitle">Recently published</h2>
					<p :class="styles.sectionNote">{{ count(entryCount, "entry", "entries") }}, newest first</p>
				</div>
				<div :class="styles.columns" :data-columns="columns.length">
					<section v-for="column in columns" :key="column.id" :class="styles.column" :aria-labelledby="`recent-${column.id}`">
						<h3 :id="`recent-${column.id}`" :class="styles.columnHead">{{ column.title }} <span v-if="column.total">{{ column.entries.length }} of {{ column.total }}</span></h3>
						<ol :class="styles.entries" :data-wide="columns.length === 1 ? '' : undefined">
							<li v-for="item in column.entries" :key="item.href">
								<a :href="item.href" :class="styles.entry">
									<time v-if="dateParts(item.publishedAt)" :datetime="item.publishedAt" :class="styles.entryDate"><strong v-bind="dateParts(item.publishedAt)?.day.attrs">{{ dateParts(item.publishedAt)?.day.text }}</strong><span v-bind="dateParts(item.publishedAt)?.month.attrs">{{ dateParts(item.publishedAt)?.month.text }}</span></time>
									<span v-else />
									<span :class="styles.entryBody" data-body>
										<span :class="styles.entryTitle" data-title>{{ item.title }}</span> <span v-if="item.meta?.length" :class="styles.entryMeta">{{ item.meta.join(" · ") }}</span> <span v-if="item.description" :class="styles.entryDescription">{{ item.description }}</span>
										<span v-if="item.mediaSrc" :class="styles.entryCover"><img :src="item.mediaSrc" alt="" :class="styles.entryCoverImage" width="640" height="360" loading="lazy" /></span>
									</span>
								</a>
							</li>
						</ol>
						<a :href="column.href" :class="styles.textLink">{{ column.more }} <span aria-hidden="true">→</span></a>
					</section>
				</div>
			</section>
			<section v-if="nextStream && nextStart" :class="styles.band" aria-labelledby="upcoming-title">
				<div :class="styles.bandGrid">
					<p :class="styles.bandWhen">
						<time :datetime="nextStream.publishedAt"><strong v-bind="nextStart.day.attrs">{{ nextStart.day.text }}</strong></time>
						<span data-date><span v-bind="nextStart.date.attrs">{{ nextStart.date.text }}</span> <span v-bind="nextStart.time.attrs">{{ nextStart.time.text }}</span></span>
					</p>
					<div :class="styles.bandCopy">
						<p :class="styles.bandState">Upcoming live stream</p>
						<h2 id="upcoming-title" :class="styles.bandTitle">{{ nextStream.title }}</h2>
						<p v-if="nextStream.description" :class="styles.bandLede">{{ nextStream.description }}</p>
						<a :href="nextStream.href" :class="button({ variant: 'outline', surface: 'ink' })">Get notified <span data-part="arrow" aria-hidden="true">→</span></a>
					</div>
					<a v-if="nextStream.mediaSrc" :href="nextStream.href" :class="styles.bandStill" tabindex="-1" aria-hidden="true">
						<img :src="nextStream.mediaSrc" alt="" :class="styles.bandStillImage" width="640" height="360" loading="lazy" />
					</a>
					<ul v-if="laterStarts.length" :class="styles.bandLater" aria-label="Also scheduled">
						<li v-for="stream in laterStarts" :key="stream.href"><a :href="stream.href"><time v-bind="stream.start.attrs">{{ stream.start.text }}</time><span>{{ stream.title }}</span></a></li>
					</ul>
				</div>
			</section>
			<section v-if="props.learningPaths.length" :class="styles.section" aria-labelledby="paths-title">
				<div :class="styles.paths">
					<div :class="styles.pathsIntro">
						<h2 id="paths-title" :class="styles.sectionTitle">Learning paths</h2>
						<p>Ordered routes through the archive, for when you want a sequence and a place to start.</p>
						<a href="/learning-paths" :class="styles.textLink">All learning paths <span aria-hidden="true">→</span></a>
					</div>
					<div>
						<p :class="styles.pathTableHead" aria-hidden="true"><span>Path</span><span>Sessions</span></p>
						<ul :class="styles.pathTable">
							<li v-for="path in props.learningPaths" :key="path.href">
								<a :href="path.href" :class="styles.pathRow">
									<span :class="styles.pathRowBody">
										<span :class="styles.pathRowName" data-name>{{ path.title }}</span> <span v-if="path.meta.length" :class="styles.pathRowMeta">{{ path.meta.join(" · ") }}</span>
									</span> <span v-if="path.sessions" :class="styles.pathRowCount"><strong>{{ path.sessions }}</strong> {{ path.sessions === 1 ? "session" : "sessions" }}</span>
								</a>
							</li>
						</ul>
					</div>
				</div>
			</section>
		</template>
		<section v-else-if="props.learningPaths.length" :class="styles.section" aria-label="Available learning paths">
			<div :class="styles.pathList">
				<a v-for="(path, index) in props.learningPaths" :key="path.href" :href="path.href" :class="styles.pathCard">
					<span :class="styles.pathIndex" data-index aria-hidden="true">{{ pad(index) }}</span>
					<span :class="styles.pathBody">
						<h2 :class="styles.pathTitle">{{ path.title }}</h2>
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
