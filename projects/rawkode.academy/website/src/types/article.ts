import type { Author, BaseEntity, SEOMetadata, Technology } from "./common";

export interface Article extends BaseEntity {
	title: string;
	slug: string;
	description: string;
	content: string;
	publishedAt: Date;
	updatedAt?: Date;
	authors: Author[];
	technologies?: Technology[];
	tags?: string[];
	readingTime?: number; // in minutes
	cover?: ArticleCover;
	isDraft?: boolean;
	series?: ArticleSeries;
	seo?: SEOMetadata;
	openGraph: {
		title: string;
		subtitle: string;
		image?: string;
	};
}

export interface ArticleCover {
	src: string;
	alt: string;
	caption?: string;
	credit?: string;
}

export interface ArticleSeries {
	id: string;
	name: string;
	slug: string;
	description?: string;
	articleCount: number;
	order: number;
}

export interface ArticleHeading {
	id: string;
	text: string;
	level: number;
	slug: string;
}

export interface ArticleStats {
	views: number;
	likes: number;
	comments: number;
	shares: number;
	readingTime: number;
}