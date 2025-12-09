import { WorkerEntrypoint } from "cloudflare:workers";
import { createId } from "@paralleldrive/cuid2";
import type { Env } from "./main.js";

const ENEMY_NAMES: Record<string, string> = {
	'nginx-ingress': 'Ingress Controller',
	'kubernetes-dashboard': 'Kubernetes Dashboard',
	'traefik': 'Traefik',
	'load-balancer': 'Load Balancer',
	'api-pod': 'API Pod',
	'redis-cache': 'Redis Cache',
	'istio-proxy': 'Istio Proxy',
	'etcd': 'etcd',
	'api-server': 'API Server',
};

const RANK_NAMES: Record<string, string> = {
	'SCRIPT_KIDDIE': 'Script Kiddie',
	'PENTESTER': 'Pentester',
	'RED_TEAMER': 'Red Teamer',
	'SECURITY_RESEARCHER': 'Security Researcher',
	'CISO_SLAYER': 'CISO Slayer',
};

const VALID_ENEMIES = new Set(Object.keys(ENEMY_NAMES));
const VALID_RANKS = new Set(Object.keys(RANK_NAMES));

function escapeXml(unsafe: string): string {
	return unsafe
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function validateAndSanitizeParams(params: {
	enemyDefeated: string;
	moveCount: number;
	timeSeconds: number;
	rank?: string;
}): { enemyDefeated: string; moveCount: number; timeSeconds: number; rank: string } {
	const enemyDefeated = VALID_ENEMIES.has(params.enemyDefeated)
		? params.enemyDefeated
		: 'api-server';

	const rank = params.rank && VALID_RANKS.has(params.rank)
		? params.rank
		: 'SCRIPT_KIDDIE';

	const moveCount = Math.max(0, Math.min(9999, Math.floor(params.moveCount)));
	const timeSeconds = Math.max(0, Math.min(3600, Math.floor(params.timeSeconds)));

	return { enemyDefeated, moveCount, timeSeconds, rank };
}

function generateShareText(params: {
	enemyDefeated: string;
	moveCount: number;
	timeSeconds: number;
	rank?: string;
}): string {
	const enemyName = ENEMY_NAMES[params.enemyDefeated] ?? params.enemyDefeated;
	const rankName = params.rank ? RANK_NAMES[params.rank] : null;

	const lines = [
		`I just breached ${enemyName} in Secret of Kubernetes Island!`,
		`${params.moveCount} moves | ${params.timeSeconds}s`,
	];

	if (rankName) {
		lines.push(`Rank: ${rankName}`);
	}

	lines.push('', 'Can you beat my score?', 'https://rawkode.academy/games/secret-of-kubernetes-island');

	return lines.join('\n');
}

function generateSvgCard(params: {
	enemyDefeated: string;
	moveCount: number;
	timeSeconds: number;
	rank?: string;
	personName?: string;
}): string {
	const enemyName = ENEMY_NAMES[params.enemyDefeated] ?? params.enemyDefeated;
	const rankName = params.rank ? RANK_NAMES[params.rank] : 'Script Kiddie';

	return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
	<defs>
		<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
			<stop offset="0%" style="stop-color:#1a1a2e"/>
			<stop offset="100%" style="stop-color:#16213e"/>
		</linearGradient>
		<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
			<path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(4, 181, 156, 0.1)" stroke-width="1"/>
		</pattern>
	</defs>

	<rect width="1200" height="630" fill="url(#bg)"/>
	<rect width="1200" height="630" fill="url(#grid)"/>

	<text x="600" y="80" text-anchor="middle" font-family="monospace" font-size="24" fill="#04b59c" letter-spacing="0.2em">SECRET OF</text>
	<text x="600" y="130" text-anchor="middle" font-family="monospace" font-size="48" font-weight="bold" fill="#85ff95" letter-spacing="0.1em">KUBERNETES ISLAND</text>

	<rect x="100" y="180" width="1000" height="300" rx="12" fill="rgba(0,0,0,0.6)" stroke="#04b59c" stroke-width="2"/>

	<text x="600" y="250" text-anchor="middle" font-family="monospace" font-size="32" fill="#f1c40f">CLUSTER BREACHED</text>

	<text x="600" y="320" text-anchor="middle" font-family="monospace" font-size="28" fill="#fff">Defeated: ${enemyName}</text>

	<text x="400" y="390" text-anchor="middle" font-family="monospace" font-size="24" fill="#04b59c">${params.moveCount} moves</text>
	<text x="800" y="390" text-anchor="middle" font-family="monospace" font-size="24" fill="#04b59c">${params.timeSeconds}s</text>

	<text x="600" y="450" text-anchor="middle" font-family="monospace" font-size="20" fill="#888">Rank: ${rankName}</text>

	<text x="600" y="560" text-anchor="middle" font-family="monospace" font-size="18" fill="#666">rawkode.academy/games/secret-of-kubernetes-island</text>
	<text x="600" y="595" text-anchor="middle" font-family="monospace" font-size="16" fill="#04b59c">Can you beat this score?</text>
</svg>`;
}

export interface ShareCardParams {
	personId: string;
	personName?: string;
	enemyDefeated: string;
	moveCount: number;
	timeSeconds: number;
	rank?: string;
}

export interface ShareCardResult {
	cardId: string;
	imageUrl: string;
	shareText: string;
	shareUrl: string;
}

const R2_PREFIX = "games/ski/share-cards";

export class SkiShareCards extends WorkerEntrypoint<Env> {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/health") {
			return new Response("ok", { headers: { "Content-Type": "text/plain" } });
		}

		// GET /cards/:id.svg - Serve a card
		const cardMatch = url.pathname.match(/^\/cards\/([^/]+)\.svg$/);
		if (cardMatch && request.method === "GET") {
			const cardId = cardMatch[1];
			const card = await this.env.UGC_BUCKET.get(`${R2_PREFIX}/${cardId}.svg`);

			if (!card) {
				return new Response("Card not found", { status: 404 });
			}

			return new Response(card.body, {
				headers: {
					"Content-Type": "image/svg+xml",
					"Cache-Control": "public, max-age=31536000",
				},
			});
		}

		// POST /generate - Generate a new card
		if (url.pathname === "/generate" && request.method === "POST") {
			try {
				const params = await request.json() as ShareCardParams;
				const result = await this.generateCard(params);
				return new Response(JSON.stringify(result), {
					headers: { "Content-Type": "application/json" },
				});
			} catch (error) {
				return new Response(JSON.stringify({ error: "Invalid request" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
		}

		return new Response("Not Found", { status: 404 });
	}

	async generateCard(params: ShareCardParams): Promise<ShareCardResult> {
		const sanitized = validateAndSanitizeParams({
			enemyDefeated: params.enemyDefeated,
			moveCount: params.moveCount,
			timeSeconds: params.timeSeconds,
			rank: params.rank,
		});

		const cardId = createId();
		const svg = generateSvgCard({
			enemyDefeated: sanitized.enemyDefeated,
			moveCount: sanitized.moveCount,
			timeSeconds: sanitized.timeSeconds,
			rank: sanitized.rank,
			personName: params.personName,
		});

		await this.env.UGC_BUCKET.put(`${R2_PREFIX}/${cardId}.svg`, svg, {
			httpMetadata: {
				contentType: "image/svg+xml",
			},
		});

		const shareText = generateShareText({
			enemyDefeated: sanitized.enemyDefeated,
			moveCount: sanitized.moveCount,
			timeSeconds: sanitized.timeSeconds,
			rank: sanitized.rank,
		});

		const baseUrl = "https://rawkode.academy";
		const gameUrl = `${baseUrl}/games/secret-of-kubernetes-island`;
		const imageUrl = `${baseUrl}/api/games/ski/share-card/${cardId}.svg`;

		return {
			cardId,
			imageUrl,
			shareText,
			shareUrl: gameUrl,
		};
	}
}
