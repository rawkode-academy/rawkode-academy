import type { EnemyData } from "./types";

const SPRITE_BASE = "/games/secret-of-kubernetes-island/enemies";

export const enemies: EnemyData[] = [
	{
		id: "nginx-ingress",
		name: "Ingress Controller",
		layer: "External",
		description: "The popular ingress controller, guarding the cluster entrance",
		difficulty: 1,
		sprite: `${SPRITE_BASE}/ingress.webp`,
	},
	{
		id: "exposed-dashboard",
		name: "K8s Dashboard",
		layer: "External",
		description: "An accidentally exposed Kubernetes dashboard",
		difficulty: 1,
		sprite: `${SPRITE_BASE}/kubernetes-dashboard.webp`,
	},
	{
		id: "redis-cache",
		name: "Redis Cache",
		layer: "App",
		description: "An unprotected Redis instance storing session tokens",
		difficulty: 2,
		sprite: `${SPRITE_BASE}/redis.webp`,
	},
	{
		id: "linkerd-proxy",
		name: "Linkerd Proxy",
		layer: "ServiceMesh",
		description: "A lightweight service mesh with mTLS bypasses",
		difficulty: 3,
		sprite: `${SPRITE_BASE}/linkerd.webp`,
	},
	{
		id: "etcd-store",
		name: "etcd",
		layer: "KubeSystem",
		description: "The cluster's brain - stores all secrets",
		difficulty: 4,
		sprite: `${SPRITE_BASE}/etcd.webp`,
	},
	{
		id: "kube-scheduler",
		name: "Scheduler",
		layer: "KubeSystem",
		description: "Decides where pods run - manipulate for privilege escalation",
		difficulty: 4,
		sprite: `${SPRITE_BASE}/scheduler.webp`,
	},
	{
		id: "controller-manager",
		name: "Controller Manager",
		layer: "KubeSystem",
		description: "The brain's assistant - manages all the control loops",
		difficulty: 4,
		sprite: `${SPRITE_BASE}/controller-manager.webp`,
	},
	{
		id: "api-server",
		name: "API Server",
		layer: "ApiServer",
		description: "The final boss - cluster admin access awaits",
		difficulty: 5,
		sprite: `${SPRITE_BASE}/api-server.webp`,
	},
	{
		id: "kubelet",
		name: "Kubelet",
		layer: "Host",
		description: "Node agent - your path to container escape",
		difficulty: 5,
		sprite: `${SPRITE_BASE}/kubelet.webp`,
	},
];
