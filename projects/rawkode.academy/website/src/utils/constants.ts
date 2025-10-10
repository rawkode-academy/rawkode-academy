// Application-wide constants

export const APP_NAME = "Rawkode Academy";
export const APP_URL = "https://rawkode.academy";
export const APP_DESCRIPTION =
	"The Rawkode Academy provides educational, entertaining, and cutting-edge learning paths for developers.";

export const API_ENDPOINTS = {
    VIDEOS: "/api/videos",
    ARTICLES: "/api/articles",
    COMMENTS: "/api/comments",
    SEARCH: "/api/search",
    GRAPHQL: "https://api.rawkode.academy/graphql",
} as const;

export const BREAKPOINTS = {
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280,
	"2xl": 1536,
} as const;

export const PAGINATION = {
	DEFAULT_PAGE_SIZE: 12,
	MAX_PAGE_SIZE: 100,
} as const;

export const VIDEO_PLAYER = {
	DEFAULT_QUALITY: "1080p",
	SEEK_STEP: 10, // seconds
	VOLUME_STEP: 0.1,
} as const;

export const CACHE_KEYS = {
	VIDEOS: "videos",
	ARTICLES: "articles",
	USER_PREFERENCES: "user_preferences",
} as const;

export const CACHE_DURATION = {
	SHORT: 5 * 60 * 1000, // 5 minutes
	MEDIUM: 30 * 60 * 1000, // 30 minutes
	LONG: 24 * 60 * 60 * 1000, // 24 hours
} as const;

export const ERROR_MESSAGES = {
	NETWORK_ERROR: "Unable to connect. Please check your internet connection.",
	SERVER_ERROR: "Something went wrong on our end. Please try again later.",
	NOT_FOUND: "The requested resource could not be found.",
	UNAUTHORIZED: "You need to be signed in to perform this action.",
} as const;

export const ROUTES = {
        HOME: "/",
        VIDEOS: "/watch",
        SHOWS: "/shows",
        ARTICLES: "/read",
        COURSES: "/courses",
        ABOUT: "/about",
        SEARCH: "/search",
} as const;
