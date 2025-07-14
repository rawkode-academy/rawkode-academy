export interface TypeBadgeConfig {
	bg: string;
	text: string;
	label: string;
	icon?: string;
}

export const typeBadgeConfig = {
	tutorial: {
		bg: "bg-blue-100 dark:bg-blue-200",
		text: "text-blue-800 dark:text-blue-900",
		label: "Tutorial",
		icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253", // Book icon
	},
	architecture: {
		bg: "bg-green-100 dark:bg-green-200",
		text: "text-green-800 dark:text-green-900",
		label: "Architecture",
		icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", // Office building
	},
	tools: {
		bg: "bg-purple-100 dark:bg-purple-200",
		text: "text-purple-800 dark:text-purple-900",
		label: "Tools",
		icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z", // Cog/settings icon
	},
	practices: {
		bg: "bg-yellow-100 dark:bg-yellow-200",
		text: "text-yellow-800 dark:text-yellow-900",
		label: "Best Practice",
		icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", // Check circle
	},
	features: {
		bg: "bg-indigo-100 dark:bg-indigo-200",
		text: "text-indigo-800 dark:text-indigo-900",
		label: "Feature",
		icon: "M13 10V3L4 14h7v7l9-11h-7z", // Lightning bolt
	},
	news: {
		bg: "bg-red-100 dark:bg-red-200",
		text: "text-red-800 dark:text-red-900",
		label: "News",
		icon: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z", // Newspaper icon
	},
	"case-study": {
		bg: "bg-gray-100 dark:bg-gray-200",
		text: "text-gray-800 dark:text-gray-900",
		label: "Case Study",
		icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", // Chart/document icon
	},
	editorial: {
		bg: "bg-orange-100 dark:bg-orange-200",
		text: "text-orange-800 dark:text-orange-900",
		label: "Editorial",
		icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z", // Star icon for opinion/editorial
	},
} as const satisfies Record<string, TypeBadgeConfig>;

export function getTypeBadgeConfig(type: string): TypeBadgeConfig {
	return typeBadgeConfig[type as keyof typeof typeBadgeConfig] || typeBadgeConfig.tutorial;
}