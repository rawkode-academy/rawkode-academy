import { FakeProvider } from "./fake.ts";
import { KindProvider, type KindProviderConfig } from "./kind.ts";
import type { ClusterProvider } from "./types.ts";

export type ProviderConfig =
	| ({ type: "kind" } & KindProviderConfig)
	| { type: "fake" };

export function createProvider(config: ProviderConfig): ClusterProvider {
	switch (config.type) {
		case "kind": {
			const { type: _type, ...rest } = config;
			return new KindProvider(rest);
		}
		case "fake":
			return new FakeProvider();
		default:
			throw new Error(
				`Unknown provider type: ${(config as { type: string }).type}`,
			);
	}
}

export type { ClusterInfo, ClusterProvider, NodeExecResult } from "./types.ts";
