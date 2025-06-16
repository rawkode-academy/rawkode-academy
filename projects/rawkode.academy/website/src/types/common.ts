// Common type definitions used across the application

export interface Author {
	id: string;
	name: string;
	email?: string;
	avatar?: string;
	bio?: string;
	social?: {
		twitter?: string;
		github?: string;
		linkedin?: string;
		website?: string;
	};
}

export interface Technology {
	id: string;
	name: string;
	logo?: string;
	category?: string;
	description?: string;
}

export interface PaginationParams {
	page?: number;
	limit?: number;
	offset?: number;
}

export interface PaginationResponse<T> {
	data: T[];
	total: number;
	page: number;
	limit: number;
	hasNext: boolean;
	hasPrev: boolean;
}

export interface ApiResponse<T> {
	data?: T;
	error?: string;
	message?: string;
	status: number;
}

export interface BaseEntity {
	id: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface SEOMetadata {
	title: string;
	description: string;
	keywords?: string[];
	canonicalUrl?: string;
	ogImage?: string;
	ogType?: string;
	twitterCard?: "summary" | "summary_large_image" | "player";
}

export type SortOrder = "asc" | "desc";

export interface SortParams {
	field: string;
	order: SortOrder;
}

export interface FilterParams {
	[key: string]: string | number | boolean | string[] | undefined;
}

export interface SearchParams {
	query: string;
	filters?: FilterParams;
	sort?: SortParams;
	pagination?: PaginationParams;
}
