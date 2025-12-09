import type { ClusterLayer } from "./types";

const SCENE_BASE = "/games/secret-of-kubernetes-island/scenes";

export const layerScenes: Record<ClusterLayer, string> = {
	External: `${SCENE_BASE}/scene-external.webp`,
	App: `${SCENE_BASE}/scene-app-namespace.webp`,
	ServiceMesh: `${SCENE_BASE}/scene-service-mesh.webp`,
	KubeSystem: `${SCENE_BASE}/scene-api-server.webp`,
	ApiServer: `${SCENE_BASE}/scene-control-plane.webp`,
	Host: `${SCENE_BASE}/scene-host.webp`,
};
