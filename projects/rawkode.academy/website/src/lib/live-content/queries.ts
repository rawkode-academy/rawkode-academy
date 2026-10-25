// GraphQL documents for every field the website reads from the content
// collections. They are validated against the composed supergraph in
// src/tests/live-content/queries.test.ts (when api/supergraph.graphql exists).
//
// Relations select only `id`: the gateway answers those from the owning
// subgraph's key without an extra hop, and ids for missing entities (e.g.
// article technologies with no profile) still come through.

const RESOURCE_EMBED = /* GraphQL */ `
	embedConfig {
		container
		src
		height
		width
		files
		importLocalDir
		startCommand
	}
`;

export const VIDEO_FIELDS = /* GraphQL */ `
	fragment LiveVideo on Video {
		id
		slug
		title
		subtitle
		tagline
		description
		descriptionDoc
		whatYouWillLearn
		publishedAt
		updatedAt
		duration
		audioFileSize
		type
		category
		youtubeId
		streamUrl
		thumbnailUrl
		realtimeKit {
			streamId
			meetingId
			livestreamName
			roomName
		}
		resources {
			id
			title
			description
			type
			url
			filePath
			embedConfig
			category
		}
		chapters {
			startTime
			title
		}
		terms
		guests {
			id
		}
		technologies {
			id
		}
		episode {
			code
			show {
				id
			}
		}
	}
`;

export const SHOW_FIELDS = /* GraphQL */ `
	fragment LiveShow on Show {
		id
		name
		description
		descriptionDoc
		tagline
		status
		published
		gameFormatUrl
		coverUrl
		coverAlt
		coverWidth
		coverHeight
		podcast {
			guid
			email
			category
			subcategory
			explicit
			copyright
			artworkUrl
		}
		subscribeLinks {
			platform
			url
			icon
		}
		updatedAt
		terms
		hosts {
			id
		}
	}
`;

export const PERSON_FIELDS = /* GraphQL */ `
	fragment LivePerson on Person {
		id
		name
		forename
		surname
		githubHandle
		githubUrl
		avatarUrl
		twitterHandle
		twitterUrl
		blueskyHandle
		blueskyUrl
		linkedinHandle
		linkedinUrl
		mastodonUrl
		websiteUrl
		youtubeUrl
		updatedAt
		biographyDoc
		links {
			name
			url
		}
		terms
	}
`;

export const TECHNOLOGY_FIELDS = /* GraphQL */ `
	fragment LiveTechnology on Technology {
		id
		name
		icon
		horizontalLogo
		stackedLogo
		logos {
			icon
			horizontal
			stacked
		}
		website
		source
		documentation
		license
		category
		subcategory
		status
		aliases
		relatedTechnologies
		useCases
		features
		learningResources {
			official
			community
			tutorials
		}
		cncf {
			status
			accepted
			incubating
			graduated
			archived
			devStatsUrl
			annualReviewUrl
			personas
			tags
			useCase
			businessUseCase
			releaseRate
			integrations
		}
		community {
			twitter
			youtube
			slack
			discord
			chat
			blog
			mailingList
			githubDiscussions
		}
		matrix {
			status
			grouping
			confidence
			trajectory
			firstUsed
			lastUsed
			makesMeFeel
			why
			spicyTake
		}
		seo {
			title
			description
		}
		updatedAt
		terms
	}
`;

export const ARTICLE_FIELDS = /* GraphQL */ `
	fragment LiveArticle on Article {
		id
		slug
		title
		subtitle
		description
		body
		type
		howto
		draft
		categories
		tags
		cover {
			url
			alt
			width
			height
		}
		openGraph {
			title
			subtitle
		}
		updates {
			date
			description
		}
		resources {
			id
			title
			description
			type
			url
			filePath
			${RESOURCE_EMBED}
			category
		}
		publishedAt
		revisedAt
		updatedAt
		authors {
			id
		}
		technologies {
			id
		}
	}
`;

export const NEWS_FIELDS = /* GraphQL */ `
	fragment LiveNews on NewsStory {
		id
		slug
		title
		description
		body
		publishedAt
		updatedAt
		authors {
			id
		}
		technologies {
			id
		}
	}
`;

export const CHANGELOG_FIELDS = /* GraphQL */ `
	fragment LiveChangelog on ChangelogEntry {
		id
		title
		date
		type
		description
		pullRequest
		body
		updatedAt
		author {
			id
		}
	}
`;

export const ADR_FIELDS = /* GraphQL */ `
	fragment LiveAdr on Adr {
		id
		title
		adoptedAt
		body
		updatedAt
		authors {
			id
		}
	}
`;

export const TESTIMONIAL_FIELDS = /* GraphQL */ `
	fragment LiveTestimonial on Testimonial {
		id
		type
		quote
		author {
			name
			title
			image
			link
		}
		updatedAt
	}
`;

const COURSE_RESOURCE = /* GraphQL */ `
	resources {
		id
		title
		description
		type
		url
		filePath
		${RESOURCE_EMBED}
		category
	}
`;

export const COURSE_MODULE_FIELDS = /* GraphQL */ `
	fragment LiveCourseModule on CourseModule {
		id
		courseId
		slug
		title
		description
		cover {
			url
			alt
			width
			height
		}
		section
		order
		video {
			id
			thumbnailUrl
			youtube
			rawkode
			poster
		}
		duration
		difficulty
		publishedAt
		updatedAt
		draft
		authors {
			id
		}
		${COURSE_RESOURCE}
		body
	}
`;

export const COURSE_FIELDS = /* GraphQL */ `
	fragment LiveCourse on Course {
		id
		title
		description
		cover {
			url
			alt
			width
			height
		}
		publishedAt
		updatedAt
		difficulty
		learningPath
		authors {
			id
		}
		technologies {
			id
		}
		${COURSE_RESOURCE}
		signupConfig {
			audienceId
			sponsor
			sponsorAudienceId
			allowSponsorContact
		}
		body
		modules {
			...LiveCourseModule
		}
	}
	${COURSE_MODULE_FIELDS}
`;

export const LEARNING_PATH_FIELDS = /* GraphQL */ `
	fragment LiveLearningPath on LearningPath {
		id
		title
		description
		difficulty
		estimatedDuration
		prerequisites
		technologies {
			id
		}
		publishedAt
		updatedAt
		authors {
			id
		}
		body
	}
`;

/** One query per source list. courses also yields courseModules. */
export const LIST_QUERIES = {
	videos: {
		operationName: "LiveVideos",
		query: `query LiveVideos { getAllVideos { ...LiveVideo } }\n${VIDEO_FIELDS}`,
		root: "getAllVideos",
	},
	shows: {
		operationName: "LiveShows",
		query: `query LiveShows { allShows { ...LiveShow } }\n${SHOW_FIELDS}`,
		root: "allShows",
	},
	people: {
		operationName: "LivePeople",
		query: `query LivePeople { allPeople { ...LivePerson } }\n${PERSON_FIELDS}`,
		root: "allPeople",
	},
	technologies: {
		operationName: "LiveTechnologies",
		query: `query LiveTechnologies { allTechnologies { ...LiveTechnology } }\n${TECHNOLOGY_FIELDS}`,
		root: "allTechnologies",
	},
	articles: {
		operationName: "LiveArticles",
		query: `query LiveArticles { allArticles { ...LiveArticle } }\n${ARTICLE_FIELDS}`,
		root: "allArticles",
	},
	news: {
		operationName: "LiveNews",
		query: `query LiveNews { allNewsStories { ...LiveNews } }\n${NEWS_FIELDS}`,
		root: "allNewsStories",
	},
	changelog: {
		operationName: "LiveChangelog",
		query: `query LiveChangelog { allChangelogEntries { ...LiveChangelog } }\n${CHANGELOG_FIELDS}`,
		root: "allChangelogEntries",
	},
	adrs: {
		operationName: "LiveAdrs",
		query: `query LiveAdrs { allAdrs { ...LiveAdr } }\n${ADR_FIELDS}`,
		root: "allAdrs",
	},
	testimonials: {
		operationName: "LiveTestimonials",
		query: `query LiveTestimonials { allTestimonials { ...LiveTestimonial } }\n${TESTIMONIAL_FIELDS}`,
		root: "allTestimonials",
	},
	courses: {
		operationName: "LiveCourses",
		query: `query LiveCourses { allCourses { ...LiveCourse } }\n${COURSE_FIELDS}`,
		root: "allCourses",
	},
	learningPaths: {
		operationName: "LiveLearningPaths",
		query: `query LiveLearningPaths { allLearningPaths { ...LiveLearningPath } }\n${LEARNING_PATH_FIELDS}`,
		root: "allLearningPaths",
	},
} as const;

export type ListSource = keyof typeof LIST_QUERIES;

/** The technology list omits profile bodies (≈1 MB); entries load them here. */
export const TECHNOLOGY_BY_ID_QUERY = {
	operationName: "LiveTechnologyById",
	query: `query LiveTechnologyById($id: String!) { technologyById(id: $id) { ...LiveTechnology body } }\n${TECHNOLOGY_FIELDS}`,
	root: "technologyById",
} as const;

/** The hourly manifest also needs technology bodies to notice their edits. */
export const TECHNOLOGY_MANIFEST_QUERY = {
	operationName: "LiveTechnologyManifest",
	query: `query LiveTechnologyManifest { allTechnologies { ...LiveTechnology body } }\n${TECHNOLOGY_FIELDS}`,
	root: "allTechnologies",
} as const;
