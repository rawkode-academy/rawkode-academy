import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import federationPlugin from "@pothos/plugin-federation";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
import { DateTimeResolver, JSONObjectResolver } from "graphql-scalars";
import * as s from "../data-model/schema";

type Technology = s.Technology;

export interface PothosTypes {
	Context: Record<string, unknown>;
	Scalars: {
		DateTime: { Input: Date; Output: Date };
		RichTextDocument: {
			Input: s.RichTextDocument;
			Output: s.RichTextDocument;
		};
	};
}

const cdn = "https://content.rawkode.academy";
// Logos live in the content R2 bucket at technologies/<id>/<variant>.svg, and
// the logos flags record which variants a technology has. The legacy
// logos/technologies/<id>.svg set is only a fallback for the logo field.
const logoCdn = `${cdn}/logos/technologies`;

type LogoVariant = keyof s.Logos;

const logoUrl =
	(variant: LogoVariant) => (technology: Pick<Technology, "id" | "logos">) =>
		technology.logos?.[variant]
			? `${cdn}/technologies/${technology.id}/${variant}.svg`
			: null;

export const iconUrl = logoUrl("icon");
export const horizontalLogoUrl = logoUrl("horizontal");
export const stackedLogoUrl = logoUrl("stacked");

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: s });
	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, federationPlugin],
	});

	builder.addScalarType("DateTime", DateTimeResolver);
	// The rich-text document format shared by every content service.
	builder.addScalarType("RichTextDocument", JSONObjectResolver, {
		description:
			'A TipTap/ProseMirror JSON document ({"type":"doc","content":[...]}), see @rawkodeacademy/rich-text.',
	});

	const byId = (id: string) =>
		db
			.select()
			.from(s.technologiesTable)
			.where(eq(s.technologiesTable.id, id))
			.get();

	const LearningResourcesRef =
		builder.objectRef<s.LearningResources>("LearningResources");
	builder.objectType(LearningResourcesRef, {
		fields: (t) => ({
			official: t.stringList({ resolve: (lr) => lr.official ?? [] }),
			community: t.stringList({ resolve: (lr) => lr.community ?? [] }),
			tutorials: t.stringList({ resolve: (lr) => lr.tutorials ?? [] }),
		}),
	});

	// cncf, community, matrix and seo are stored as JSON, but their keys are fixed
	// by the content schema (and every stored row matches it), so they are typed
	// objects rather than a JSON scalar. Enum-like values stay strings: several
	// (e.g. "guilty-pleasure") are not valid GraphQL enum names.
	const LogosRef = builder.objectRef<s.Logos>("TechnologyLogos").implement({
		fields: (t) => ({
			icon: t.boolean({ resolve: (l) => l.icon ?? false }),
			horizontal: t.boolean({ resolve: (l) => l.horizontal ?? false }),
			stacked: t.boolean({ resolve: (l) => l.stacked ?? false }),
		}),
	});

	const CncfRef = builder.objectRef<s.Cncf>("TechnologyCncf").implement({
		fields: (t) => ({
			status: t.string({ nullable: true, resolve: (c) => c.status }),
			// Dates as written in the landscape, e.g. "2016-03-10".
			accepted: t.string({ nullable: true, resolve: (c) => c.accepted }),
			incubating: t.string({ nullable: true, resolve: (c) => c.incubating }),
			graduated: t.string({ nullable: true, resolve: (c) => c.graduated }),
			archived: t.string({ nullable: true, resolve: (c) => c.archived }),
			devStatsUrl: t.string({ nullable: true, resolve: (c) => c.devStatsUrl }),
			annualReviewUrl: t.string({
				nullable: true,
				resolve: (c) => c.annualReviewUrl,
			}),
			personas: t.stringList({ resolve: (c) => c.personas ?? [] }),
			tags: t.stringList({ resolve: (c) => c.tags ?? [] }),
			useCase: t.string({ nullable: true, resolve: (c) => c.useCase }),
			businessUseCase: t.string({
				nullable: true,
				resolve: (c) => c.businessUseCase,
			}),
			releaseRate: t.string({ nullable: true, resolve: (c) => c.releaseRate }),
			integrations: t.stringList({ resolve: (c) => c.integrations ?? [] }),
		}),
	});

	const CommunityRef = builder
		.objectRef<s.Community>("TechnologyCommunity")
		.implement({
			fields: (t) => ({
				twitter: t.string({ nullable: true, resolve: (c) => c.twitter }),
				youtube: t.string({ nullable: true, resolve: (c) => c.youtube }),
				slack: t.string({ nullable: true, resolve: (c) => c.slack }),
				discord: t.string({ nullable: true, resolve: (c) => c.discord }),
				chat: t.string({ nullable: true, resolve: (c) => c.chat }),
				blog: t.string({ nullable: true, resolve: (c) => c.blog }),
				mailingList: t.string({
					nullable: true,
					resolve: (c) => c.mailingList,
				}),
				githubDiscussions: t.string({
					nullable: true,
					resolve: (c) => c.githubDiscussions,
				}),
			}),
		});

	// Rawkode's technology matrix placement and the story on the card back.
	const MatrixRef = builder.objectRef<s.Matrix>("TechnologyMatrix").implement({
		fields: (t) => ({
			status: t.exposeString("status"),
			grouping: t.string({ nullable: true, resolve: (m) => m.grouping }),
			confidence: t.string({ nullable: true, resolve: (m) => m.confidence }),
			trajectory: t.string({ nullable: true, resolve: (m) => m.trajectory }),
			firstUsed: t.string({ nullable: true, resolve: (m) => m.firstUsed }),
			lastUsed: t.string({ nullable: true, resolve: (m) => m.lastUsed }),
			makesMeFeel: t.string({ nullable: true, resolve: (m) => m.makesMeFeel }),
			why: t.string({ nullable: true, resolve: (m) => m.why }),
			spicyTake: t.string({ nullable: true, resolve: (m) => m.spicyTake }),
		}),
	});

	const SeoRef = builder.objectRef<s.Seo>("TechnologySeo").implement({
		fields: (t) => ({
			title: t.string({ nullable: true, resolve: (seo) => seo.title }),
			description: t.string({
				nullable: true,
				resolve: (seo) => seo.description,
			}),
		}),
	});

	const TechnologyRef = builder.objectRef<Technology>("Technology");
	builder.objectType(TechnologyRef, {
		fields: (t) => ({
			id: t.exposeID("id"),
			name: t.exposeString("name"),
			description: t.exposeString("description", {
				deprecationReason: "The profile body in Markdown; use body.",
			}),
			// The profile body. Null until it is backfilled from description.
			body: t.field({
				type: "RichTextDocument",
				nullable: true,
				resolve: (r) => r.body,
			}),
			icon: t.string({ nullable: true, resolve: (r) => iconUrl(r) }),
			horizontalLogo: t.string({
				nullable: true,
				resolve: (r) => horizontalLogoUrl(r),
			}),
			stackedLogo: t.string({
				nullable: true,
				resolve: (r) => stackedLogoUrl(r),
			}),
			// Which logo variants exist; all false when none were recorded.
			logos: t.field({ type: LogosRef, resolve: (r) => r.logos ?? {} }),
			// Kept for older clients: always a URL.
			logo: t.string({
				resolve: (r) => iconUrl(r) ?? `${logoCdn}/${r.id}.svg`,
			}),
			website: t.string({ resolve: (r) => r.website ?? "" }),
			source: t.string({ nullable: true, resolve: (r) => r.source }),
			documentation: t.string({ resolve: (r) => r.documentation ?? "" }),
			license: t.exposeString("license"),
			category: t.string({ nullable: true, resolve: (r) => r.category }),
			subcategory: t.string({ nullable: true, resolve: (r) => r.subcategory }),
			status: t.string({ nullable: true, resolve: (r) => r.status }),
			aliases: t.stringList({ nullable: true, resolve: (r) => r.aliases }),
			relatedTechnologies: t.stringList({
				nullable: true,
				resolve: (r) => r.relatedTechnologies,
			}),
			useCases: t.stringList({ nullable: true, resolve: (r) => r.useCases }),
			features: t.stringList({ nullable: true, resolve: (r) => r.features }),
			learningResources: t.field({
				type: LearningResourcesRef,
				nullable: true,
				resolve: (r) => r.learningResources,
			}),
			cncf: t.field({ type: CncfRef, nullable: true, resolve: (r) => r.cncf }),
			community: t.field({
				type: CommunityRef,
				nullable: true,
				resolve: (r) => r.community,
			}),
			matrix: t.field({
				type: MatrixRef,
				nullable: true,
				resolve: (r) => r.matrix,
			}),
			seo: t.field({ type: SeoRef, nullable: true, resolve: (r) => r.seo }),
			// When the technologies row last changed; null for rows never edited
			// since seeding. terms and videos come from other services and are not
			// covered by this timestamp.
			updatedAt: t.field({
				type: "DateTime",
				nullable: true,
				resolve: (r) => r.updatedAt,
			}),
		}),
	});

	builder.asEntity(TechnologyRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: (ref) => byId(ref.id),
	});

	builder.queryType({
		fields: (t) => ({
			technologyById: t.field({
				type: TechnologyRef,
				nullable: true,
				args: { id: t.arg.string({ required: true }) },
				resolve: (_root, args) => byId(args.id),
			}),
			// Every technology in one call; getTechnologies pages 15 at a time.
			allTechnologies: t.field({
				type: [TechnologyRef],
				resolve: () =>
					db
						.select()
						.from(s.technologiesTable)
						.orderBy(asc(s.technologiesTable.id))
						.all(),
			}),
			getTechnologies: t.field({
				type: [TechnologyRef],
				args: {
					limit: t.arg.int({ defaultValue: 15 }),
					offset: t.arg.int({ defaultValue: 0 }),
				},
				resolve: (_root, args) =>
					db
						.select()
						.from(s.technologiesTable)
						.orderBy(asc(s.technologiesTable.id))
						.limit(args.limit ?? 15)
						.offset(args.offset ?? 0)
						.all(),
			}),
		}),
	});

	return builder.toSubGraphSchema({
		linkUrl: "https://specs.apollo.dev/federation/v2.6",
		federationDirectives: ["@key"],
	});
};
