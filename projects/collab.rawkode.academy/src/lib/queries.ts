import type { CourseLessons } from "./lessons.ts";

export const DASHBOARD = /* GraphQL */ `
	query Dashboard {
		collaborators {
			id
			name
			organizationId
			announcement
			announcementUrl
			videos { id title slug }
			reviews { id title videoId state draftVersion dueAt canSignOff }
		}
		allCourses { id modules { slug video { id } } }
	}
`;

const PERIOD = "{ d90 lifetime }";
export const ANALYTICS = /* GraphQL */ `
	query Analytics {
		collaborators {
			id
			name
			organizationId
			analytics {
				generatedAt
				siteViews ${PERIOD}
				youtubeViews ${PERIOD}
				minutesWatched ${PERIOD}
				videos { id title slug siteViews ${PERIOD} youtubeViews ${PERIOD} minutesWatched ${PERIOD} }
			}
		}
		allCourses { id modules { slug video { id } } }
	}
`;

export const REVIEW = /* GraphQL */ `
	query Review($id: ID!) {
		review(id: $id) {
			id
			title
			videoId
			videoUrl
			state
			draftVersion
			dueAt
			partnerApprovedBy
			canComment
			canSignOff
			collaborator { id name organizationId }
			comments { id draftVersion authorLogin authorSide timestampMs body triage createdAt mayWithdraw }
		}
	}
`;

export const ADD_COMMENT = /* GraphQL */ `
	mutation AddComment($reviewId: ID!, $body: String!, $timestampMs: Int) {
		addReviewComment(reviewId: $reviewId, body: $body, timestampMs: $timestampMs) { id }
	}
`;

export const TRIAGE = /* GraphQL */ `
	mutation Triage($id: ID!, $triage: CommentTriage!) {
		triageReviewComment(id: $id, triage: $triage) { id triage }
	}
`;

export const SIGN_OFF = /* GraphQL */ `
	mutation SignOff($id: ID!) {
		signOffReview(id: $id) { id state }
	}
`;

export const OPEN_REVIEW = /* GraphQL */ `
	mutation OpenReview($input: OpenReviewInput!) {
		openReview(input: $input) { id draftVersion }
	}
`;

export const SET_ANNOUNCEMENT = /* GraphQL */ `
	mutation SetAnnouncement($collaboratorId: ID!, $text: String!, $url: String) {
		setAnnouncement(collaboratorId: $collaboratorId, text: $text, url: $url) { id announcement announcementUrl }
	}
`;

export interface DashboardData {
	allCourses?: CourseLessons;
	collaborators: {
		id: string;
		name: string;
		organizationId: string | null;
		announcement: string | null;
		announcementUrl: string | null;
		videos: { id: string; title: string; slug: string }[];
		reviews: { id: string; title: string; videoId: string; state: string; draftVersion: number; dueAt: string; canSignOff: boolean }[];
	}[];
}

export interface Comment {
	id: string;
	draftVersion: number;
	authorLogin: string;
	authorSide: "partner" | "staff";
	timestampMs: number | null;
	body: string;
	triage: "new" | "actionable" | "not_actionable" | "fixed" | "withdrawn";
	createdAt: string;
	mayWithdraw: boolean;
}

export interface ReviewData {
	review: {
		id: string;
		title: string;
		videoId: string;
		videoUrl: string;
		state: string;
		draftVersion: number;
		dueAt: string;
		partnerApprovedBy: string | null;
		canComment: boolean;
		canSignOff: boolean;
		collaborator: { id: string; name: string; organizationId: string | null };
		comments: Comment[];
	} | null;
}

export interface Period { d90: number; lifetime: number }
export interface AnalyticsData {
	allCourses?: CourseLessons;
	collaborators: {
		id: string;
		name: string;
		organizationId: string | null;
		analytics: {
			generatedAt: string;
			siteViews: Period;
			youtubeViews: Period;
			minutesWatched: Period;
			videos: { id: string; title: string; slug: string; siteViews: Period; youtubeViews: Period | null; minutesWatched: Period | null }[];
		} | null;
	}[];
}
