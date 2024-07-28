/* eslint-disable */
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = {
	[K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
	[SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
	[SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<
	T extends { [key: string]: unknown },
	K extends keyof T,
> = { [_ in K]?: never };
export type Incremental<T> =
	| T
	| {
			[P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never;
	  };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
	ID: { input: string; output: string };
	String: { input: string; output: string };
	Boolean: { input: boolean; output: boolean };
	Int: { input: number; output: number };
	Float: { input: number; output: number };
	DateTime: { input: any; output: any };
};

export type Chapter = {
	__typename?: "Chapter";
	timestamp: Scalars["String"]["output"];
	title: Scalars["String"]["output"];
};

export type Event = {
	__typename?: "Event";
	description: Scalars["String"]["output"];
	endsAt: Scalars["DateTime"]["output"];
	id: Scalars["String"]["output"];
	name: Scalars["String"]["output"];
	recurrence?: Maybe<Scalars["String"]["output"]>;
	show?: Maybe<Scalars["String"]["output"]>;
	startsAt: Scalars["DateTime"]["output"];
	type: Scalars["String"]["output"];
};

export type EventRsvPs = {
	__typename?: "EventRSVPs";
	count: Scalars["Int"]["output"];
	userIds: Array<Scalars["String"]["output"]>;
};

export type Person = {
	__typename?: "Person";
	forename: Scalars["String"]["output"];
	id: Scalars["String"]["output"];
	surname: Scalars["String"]["output"];
};

export type Query = {
	__typename?: "Query";
	eventById: Event;
	events: Array<Event>;
	people: Array<Person>;
	personById: Person;
	rsvpsForEvent: EventRsvPs;
	shows: Array<Show>;
	technologies: Array<Technology>;
	technologyById: Technology;
	videoById: Video;
	videos: Array<Video>;
};

export type QueryEventByIdArgs = {
	id: Scalars["String"]["input"];
};

export type QueryPersonByIdArgs = {
	id: Scalars["String"]["input"];
};

export type QueryRsvpsForEventArgs = {
	eventId: Scalars["String"]["input"];
};

export type QueryTechnologyByIdArgs = {
	id: Scalars["String"]["input"];
};

export type QueryVideoByIdArgs = {
	id: Scalars["String"]["input"];
};

export type Show = {
	__typename?: "Show";
	hosts: Array<Person>;
	id: Scalars["String"]["output"];
	name: Scalars["String"]["output"];
};

export type Technology = {
	__typename?: "Technology";
	description: Scalars["String"]["output"];
	documentationUrl: Scalars["String"]["output"];
	githubRepository: Scalars["String"]["output"];
	id: Scalars["String"]["output"];
	license: Scalars["String"]["output"];
	name: Scalars["String"]["output"];
	websiteUrl: Scalars["String"]["output"];
};

export type Video = {
	__typename?: "Video";
	chapters: Array<Chapter>;
	description: Scalars["String"]["output"];
	duration: Scalars["Int"]["output"];
	id: Scalars["String"]["output"];
	publishedAt: Scalars["DateTime"]["output"];
	show?: Maybe<Scalars["String"]["output"]>;
	title: Scalars["String"]["output"];
	type: Scalars["String"]["output"];
	visibility: Scalars["String"]["output"];
};
