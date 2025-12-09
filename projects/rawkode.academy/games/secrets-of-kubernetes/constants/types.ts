export type ClusterLayer =
	| "External"
	| "App"
	| "ServiceMesh"
	| "KubeSystem"
	| "ApiServer"
	| "Host";

export type InsultLayer = ClusterLayer | "Generic";

export interface EnemyData {
	id: string;
	name: string;
	layer: ClusterLayer;
	description: string;
	difficulty: number;
	sprite: string;
}

export interface Insult {
	id: string;
	text: string;
	layer: InsultLayer;
	enemies: string[];
}

export interface Comeback {
	id: string;
	text: string;
	effectiveness: string[];
	layer: InsultLayer;
}

export interface PlayerProgress {
	currentLayer: ClusterLayer;
	defeatedEnemies: string[];
	unlockedComebacks: string[];
	health: number;
}
