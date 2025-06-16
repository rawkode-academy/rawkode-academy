import type { Author, BaseEntity, Technology } from "./common";

export interface Video extends BaseEntity {
	title: string;
	slug: string;
	description: string;
	duration: number; // in seconds
	publishedAt: Date;
	thumbnailUrl: string;
	videoUrl: string;
	manifestUrl?: string;
	captionsUrl?: string;
	author?: Author;
	technologies?: Technology[];
	tags?: string[];
	viewCount?: number;
	likeCount?: number;
	commentCount?: number;
	series?: VideoSeries;
	chapters?: VideoChapter[];
}

export interface VideoSeries {
	id: string;
	name: string;
	slug: string;
	description?: string;
	videoCount: number;
	order: number;
}

export interface VideoChapter {
	id: string;
	title: string;
	startTime: number; // in seconds
	endTime: number; // in seconds
	description?: string;
}

export interface VideoComment {
	id: number;
	author: string;
	email: string;
	content: string;
	timestamp: string;
	avatarUrl?: string;
}

export interface VideoTranscript {
	start: string;
	end: string;
	text: string;
}

export interface VideoReaction {
	emoji: string;
	count: number;
	userReacted: boolean;
}

export interface VideoStats {
	views: number;
	likes: number;
	comments: number;
	shares: number;
	watchTime: number; // average watch time in seconds
}