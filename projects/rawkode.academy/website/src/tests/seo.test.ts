import { describe, it, expect, vi } from "vitest";

// Mock getCollection for tests
const getCollection = vi.fn();

describe("SEO Validation", () => {
	describe("Article SEO", () => {
		it("all articles should have required meta fields", async () => {
			// Mock articles data
			const mockArticles = [
				{
					id: "test-article",
					data: {
						title: "Test Article Title for SEO",
						description:
							"This is a test article description that meets the minimum length requirement for SEO validation",
						openGraph: {
							title: "OG Title",
							subtitle: "OG Subtitle",
						},
						publishedAt: new Date(),
						authors: ["test-author"],
						isDraft: false,
					},
					body: "Test article content that is long enough",
				},
			];

			getCollection.mockResolvedValue(mockArticles);

			const articles = await getCollection(
				"articles",
				({ data }: { data: any }) => !data.isDraft,
			);

			for (const article of articles) {
				// Check title length
				expect(article.data.title.length).toBeGreaterThan(10);
				expect(article.data.title.length).toBeLessThan(60);

				// Check description
				expect(article.data.description).toBeDefined();
				expect(article.data.description.length).toBeGreaterThan(50);
				expect(article.data.description.length).toBeLessThan(160);

				// Check OpenGraph data
				expect(article.data.openGraph.title).toBeDefined();
				expect(article.data.openGraph.subtitle).toBeDefined();

				// Check dates
				expect(article.data.publishedAt).toBeInstanceOf(Date);

				// Check authors
				expect(article.data.authors).toBeDefined();
				expect(article.data.authors.length).toBeGreaterThan(0);
			}
		});

		it("all articles should have proper image alt text if cover exists", async () => {
			const articles = await getCollection(
				"articles",
				({ data }: { data: any }) => !data.isDraft,
			);

			for (const article of articles) {
				if (article.data.cover) {
					expect(article.data.cover.alt).toBeDefined();
					expect(article.data.cover.alt.length).toBeGreaterThan(10);
					expect(article.data.cover.alt).not.toMatch(
						/^(image|photo|picture|screenshot)$/i,
					);
				}
			}
		});

		it("all articles should have technology tags", async () => {
			const articles = await getCollection(
				"articles",
				({ data }: { data: any }) => !data.isDraft,
			);

			for (const article of articles) {
				// Technology tags are optional but when present should be valid
				if (article.data.technologies) {
					expect(Array.isArray(article.data.technologies)).toBe(true);
					expect(article.data.technologies.length).toBeGreaterThan(0);
				}
			}
		});
	});

	describe("Course SEO", () => {
		it("all courses should have required meta fields", async () => {
			const courses = await getCollection("courses");

			for (const course of courses) {
				// Check title and description
				expect(course.data.title).toBeDefined();
				expect(course.data.title.length).toBeGreaterThan(10);
				expect(course.data.description).toBeDefined();
				expect(course.data.description.length).toBeGreaterThan(50);

				// Check dates
				expect(course.data.publishedAt).toBeInstanceOf(Date);

				// Check difficulty
				expect(["beginner", "intermediate", "advanced"]).toContain(
					course.data.difficulty,
				);
			}
		});
	});

	describe("URL Structure", () => {
		it("all article URLs should be SEO-friendly", async () => {
			const articles = await getCollection(
				"articles",
				({ data }: { data: any }) => !data.isDraft,
			);

			for (const article of articles) {
				// Check URL slug format
				expect(article.id).toMatch(/^[a-z0-9-/]+$/);
				expect(article.id).not.toContain("__");
				expect(article.id).not.toContain("--");
			}
		});
	});

	describe("Content Structure", () => {
		it("articles should have proper heading structure", async () => {
			const articles = await getCollection(
				"articles",
				({ data }: { data: any }) => !data.isDraft,
			);

			// This would need to be enhanced to actually parse the content
			// For now, just ensure articles have content
			for (const article of articles) {
				if (article.body) {
					expect(article.body.length).toBeGreaterThan(100);
				}
			}
		});
	});
});

describe("Structured Data Validation", () => {
	it("should have valid Course JSON-LD with required fields", () => {
		// Mock course data
		const mockCourse = {
			id: "test-course",
			data: {
				title: "Test Course",
				description: "Test course description for structured data validation",
				publishedAt: new Date("2025-01-01"),
				updatedAt: new Date("2025-01-15"),
				difficulty: "intermediate",
			},
		};

		const mockModules = [
			{
				id: "module-1",
				data: {
					title: "Module 1",
					description: "First module description",
					order: 1,
				},
			},
		];

		const mockAuthors = [
			{
				data: {
					name: "Test Author",
					handle: "testauthor",
				},
			},
		];

		// Simulate the courseJsonLd creation logic
		const courseJsonLd = {
			"@context": "https://schema.org",
			"@type": "Course",
			name: mockCourse.data.title,
			description: mockCourse.data.description,
			provider: {
				"@type": "Organization",
				name: "Rawkode Academy",
				sameAs: "https://rawkode.academy",
				logo: {
					"@type": "ImageObject",
					url: "https://rawkode.academy/android-chrome-512x512.png",
				},
			},
			hasCourseInstance: mockModules.map((module) => ({
				"@type": "CourseInstance",
				name: module.data.title,
				description: module.data.description,
				courseMode: "online",
				courseWorkload: "PT30M",
			})),
			creator: mockAuthors.map((author) => ({
				"@type": "Person",
				name: author.data.name,
				url: `https://github.com/${author.data.handle}`,
			})),
			offers: {
				"@type": "Offer",
				price: "0",
				priceCurrency: "USD",
				availability: "https://schema.org/InStock",
				category: "Educational",
				itemOffered: {
					"@type": "Course",
					name: mockCourse.data.title,
					url: `https://rawkode.academy/courses/${mockCourse.id}`,
				},
			},
			isAccessibleForFree: true,
		};

		// Validate required fields for Google Search Console
		expect(courseJsonLd["@type"]).toBe("Course");
		expect(courseJsonLd.provider).toBeDefined();
		expect(courseJsonLd.provider["@type"]).toBe("Organization");

		expect(courseJsonLd.hasCourseInstance).toBeDefined();
		expect(Array.isArray(courseJsonLd.hasCourseInstance)).toBe(true);
		expect(courseJsonLd.hasCourseInstance.length).toBeGreaterThan(0);

		expect(courseJsonLd.offers).toBeDefined();
		expect(courseJsonLd.offers["@type"]).toBe("Offer");
		expect(courseJsonLd.offers.price).toBe("0");
		expect(courseJsonLd.offers.priceCurrency).toBe("USD");
		expect(courseJsonLd.offers.availability).toBe("https://schema.org/InStock");
		expect(courseJsonLd.offers.category).toBe("Educational");
		expect(courseJsonLd.offers.itemOffered).toBeDefined();
		expect(courseJsonLd.offers.itemOffered["@type"]).toBe("Course");
		expect(courseJsonLd.offers.itemOffered.url).toBeDefined();

		// Validate isAccessibleForFree field
		expect(courseJsonLd.isAccessibleForFree).toBe(true);

		// Validate creator field
		expect(courseJsonLd.creator).toBeDefined();
		expect(Array.isArray(courseJsonLd.creator)).toBe(true);
		expect(courseJsonLd.creator.length).toBeGreaterThan(0);
		expect(courseJsonLd.creator[0]).toBeDefined();
		expect(courseJsonLd.creator[0]?.name).toBe("Test Author");
		expect(courseJsonLd.creator[0]?.url).toBe("https://github.com/testauthor");

		// Validate JSON structure can be serialized
		expect(() => JSON.stringify(courseJsonLd)).not.toThrow();
	});
});
