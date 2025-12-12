import { listTechnologies } from "@/subgraph/loaders/technologies";

export type TechnologyOption = {
	id: string;
	name: string;
	iconUrl: string;
};

export function getUtcDayKey(date = new Date()): string {
	const yyyy = date.getUTCFullYear();
	const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(date.getUTCDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

function hashStringToSeed(input: string): number {
	let h = 2166136261;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
	const out = [...arr];
	const rand = mulberry32(seed);
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[out[i], out[j]] = [out[j]!, out[i]!];
	}
	return out;
}

let techCache: { list: TechnologyOption[]; byId: Map<string, TechnologyOption> } | null = null;

export async function getTechnologyIndex(): Promise<{
	list: TechnologyOption[];
	byId: Map<string, TechnologyOption>;
}> {
	if (techCache) return techCache;
	const items = await listTechnologies();
	const list = items
		.filter((t) => Boolean(t.icon))
		.map((t) => ({
			id: t.id,
			name: t.name,
			iconUrl: t.icon!,
		}))
		.sort((a, b) => a.id.localeCompare(b.id));
	const byId = new Map(list.map((t) => [t.id, t] as const));
	techCache = { list, byId };
	return techCache;
}

export function pickDailyTechIds(dayKey: string, eligibleIds: string[]): string[] {
	if (eligibleIds.length < 5) {
		throw new Error("Not enough technologies with icons to pick the daily 5");
	}
	const seed = hashStringToSeed(dayKey);
	const shuffled = seededShuffle(eligibleIds, seed);
	return shuffled.slice(0, 5);
}

export async function ensureDailyChallenge(
	locals: any,
	dateKey: string,
): Promise<{ date: string; techIds: string[] }> {
	const env = locals.runtime.env as any;
	const existing = await env.GTL_PLAYER_STATS.getDailyChallenge(dateKey);
	if (existing) return existing;

	const techIndex = await getTechnologyIndex();
	const eligibleIds = techIndex.list.map((t) => t.id);
	const techIds = pickDailyTechIds(dateKey, eligibleIds);
	return env.GTL_PLAYER_STATS.ensureDailyChallenge(dateKey, techIds);
}

export async function getLogoUrlForIndex(
	techIds: string[],
	index: number,
): Promise<string | null> {
	if (index < 0 || index >= techIds.length) return null;
	const techId = techIds[index];
	const techIndex = await getTechnologyIndex();
	return techIndex.byId.get(techId)?.iconUrl ?? null;
}
