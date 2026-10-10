/**
 * A small PublicContentBridge-shaped fixture client for VM/Astro SSR harnesses.
 * Route tests use this to exercise the exact-lookup, relation-filter and bounded
 * page calls as production without contacting a Worker.
 */
export function createPayloadContentFixtures(collections = {}, { now = new Date() } = {}) {
	const calls = [];
	const records = (collection) => (collections[collection] ?? []).filter((entry) => {
		if (entry?._status === "draft" || entry?.data?.publish === false) return false;
		const publishedAt = entry?.data?.publishedAt;
		if (publishedAt && new Date(publishedAt) > now) {
			// Upcoming live sessions are public metadata; future recorded content
			// and other scheduled records are not yet in the public projection.
			return collection === "videos" && entry.data.type === "live";
		}
		return true;
	});

	const referenceValue = (reference) => {
		if (typeof reference === "string") return reference;
		if (!reference || typeof reference !== "object") return undefined;
		return reference.id ?? reference.slug;
	};
	const includesReference = (value, expected) => {
		const values = Array.isArray(value) ? value : value == null ? [] : [value];
		return values.some((reference) => referenceValue(reference) === expected);
	};
	const matchesOptions = (collection, entry, options = {}) => {
		const data = entry.data ?? {};
		if (options.authorId && !includesReference(data.authors ?? data.author, options.authorId)) return false;
		if (options.technologyId && !includesReference(data.technologies ?? data.relatedTechnologies, options.technologyId)) return false;
		if (options.showId && !includesReference(data.show, options.showId)) return false;
		if (options.courseId && !includesReference(data.course ?? data.courses, options.courseId)) return false;
		if (options.seriesId && !includesReference(data.series, options.seriesId)) return false;
		if (options.personId) {
			const personRelations = collection === "shows"
				? data.hosts
				: collection === "videos"
					? data.guests
					: data.authors ?? data.author;
			if (!includesReference(personRelations, options.personId)) return false;
		}
		if (options.type && data.type !== options.type) return false;
		if (options.category && data.category !== options.category) return false;
		if (options.q) {
			const query = String(options.q).slice(0, 120).toLowerCase();
			const searchable = [data.title, data.name, data.description, data.subtitle]
				.filter((value) => typeof value === "string")
				.join(" ")
				.toLowerCase();
			if (!searchable.includes(query)) return false;
		}
		return true;
	};
	const resolve = (collection, lookup) => {
		if (typeof lookup === "string") {
			// Plain strings are preserved slugs; relationship CUIDs are explicit
			// `{ id }` objects, matching the production client contract.
			return records(collection).find((entry) => entry.slug === lookup);
		}
		if (!lookup || typeof lookup !== "object") return undefined;
		if (lookup.id) return records(collection).find((entry) => entry.id === lookup.id);
		if (lookup.slug) return records(collection).find((entry) => entry.slug === lookup.slug);
		return undefined;
	};

	async function getEntry(collection, lookup, options = {}) {
		calls.push({ kind: "entry", collection, lookup, view: options.view ?? "full" });
		return resolve(collection, lookup);
	}
	async function getEntries(references) {
		calls.push({ kind: "entries", collection: "people", references });
		return (references ?? []).map((reference) => resolve("people", reference));
	}
	async function getPayloadCollectionPage(collection, options = {}) {
		const page = Math.max(1, Math.floor(options.page ?? 1));
		const limit = Math.max(1, Math.min(100, Math.floor(options.limit ?? 50)));
		calls.push({ kind: "page", collection, options: { ...options, page, limit } });
		const matching = records(collection).filter((entry) => matchesOptions(collection, entry, options));
		const start = (page - 1) * limit;
		return {
			docs: matching.slice(start, start + limit),
			page,
			limit,
			hasNextPage: start + limit < matching.length,
			nextReleaseAt: null,
		};
	}
	async function listPayloadContent(collection, options = {}) {
		return (await getPayloadCollectionPage(collection, options)).docs;
	}
	async function getCollection(collection, filter, options = {}) {
		const docs = await listPayloadContent(collection, {
			...options,
			page: options.page ?? 1,
			limit: options.limit ?? 100,
			view: "summary",
		});
		return filter ? docs.filter(filter) : docs;
	}
	async function getAllCollection(collection, filter, options = {}) {
		calls.push({ kind: "all", collection, options });
		const entries = [];
		for (let page = 1; page <= 100; page += 1) {
			const result = await getPayloadCollectionPage(collection, {
				...options,
				page,
				limit: 100,
				view: "summary",
			});
			entries.push(...(filter ? result.docs.filter(filter) : result.docs));
			if (!result.hasNextPage) return entries;
		}
		throw new Error(`Fixture collection ${collection} exceeded the 10000 item limit.`);
	}

	return {
		getEntry,
		getEntries,
		getCollection,
		getAllCollection,
		getPayloadCollectionPage,
		listPayloadContent,
		getPayloadImageVariant(image, width) {
			const source =
				typeof image === "string"
					? image
					: image && typeof image === "object"
						? image.src
						: undefined;
			if (typeof source !== "string") return undefined;
			const url = new URL(source, "https://rawkode.academy");
			if (!url.pathname.startsWith("/cms-assets/")) return undefined;
			url.searchParams.set("w", String(width));
			return `${url.pathname}${url.search}`;
		},
		calls,
	};
}
