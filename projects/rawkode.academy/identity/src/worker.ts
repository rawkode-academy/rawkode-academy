// Worker entrypoint (wrangler.jsonc "main"): Astro's request handler, plus an
// RPC entrypoint for other Workers. The RPC is reachable only through a
// service binding; it has no public route.

import { WorkerEntrypoint } from "cloudflare:workers";
import astro from "@astrojs/cloudflare/entrypoints/server";

export default astro;

export class AccountStats extends WorkerEntrypoint<Env> {
	/** Number of accounts. An aggregate only: no identifiers leave identity. */
	async countAccounts(): Promise<number> {
		const row = await this.env.DB.prepare(
			"SELECT count(*) AS accounts FROM user",
		).first<{ accounts: number }>();
		return Number(row?.accounts ?? 0);
	}
}
