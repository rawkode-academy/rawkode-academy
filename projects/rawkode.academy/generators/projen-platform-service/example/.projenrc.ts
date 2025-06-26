import { Project } from "projen";
import { PlatformServiceProject } from "../src/index";

// Create a test project
const project = new Project({
	name: "example-services",
	outdir: "example-output",
});

// Example 1: Basic service
new PlatformServiceProject(project, {
	serviceName: "video-bookmarks",
	serviceDescription: "Allows users to bookmark specific timestamps in videos",
	tableName: "video_bookmarks",
	graphqlTypeName: "VideoBookmark",
});

// Example 2: Service with write model and tests
new PlatformServiceProject(project, {
	serviceName: "watch-history",
	serviceDescription: "Tracks user watch history and progress",
	tableName: "watch_history",
	graphqlTypeName: "WatchHistory",
	includeWriteModel: true,
	includeTests: true,
	// Note: schemaFields and databaseColumns are deprecated
	// You need to manually create schema files
});

// Example 3: Service that doesn't extend Video
new PlatformServiceProject(project, {
	serviceName: "user-preferences",
	serviceDescription: "Manages user preferences and settings",
	tableName: "user_preferences",
	graphqlTypeName: "UserPreference",
	extendsVideo: false,
	includeWriteModel: true,
	// Note: schemaFields and databaseColumns are deprecated
	// You need to manually create schema files
	customScripts: {
		"migrate:seed": "bun run data-model/seed.ts",
	},
});

project.synth();
