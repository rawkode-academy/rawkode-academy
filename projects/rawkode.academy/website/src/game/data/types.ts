export type ClusterLayer =
	| "external-web"
	| "app-namespace"
	| "service-mesh"
	| "control-plane"
	| "api-server"
	| "host";

export interface EnemyData {
	id: string;
	name: string;
	layer: ClusterLayer;
	description: string;
	difficulty: number;
}

export interface Insult {
	id: string;
	text: string;
	layer: ClusterLayer | "generic";
}

export interface Comeback {
	id: string;
	text: string;
	effectiveness: string[];
}

export interface PlayerProgress {
	currentLayer: ClusterLayer;
	defeatedEnemies: string[];
	unlockedComebacks: string[];
	health: number;
}
