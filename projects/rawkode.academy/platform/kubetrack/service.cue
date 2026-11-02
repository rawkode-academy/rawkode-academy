package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// KubeTrack: Kubernetes releases, their enhancements (flip-book cards) and a
// quiz per release. Read-only; releases are loaded by scripts/load-release.ts.
_service: gen.#PlatformService & {
	serviceName: "kubetrack"
	// Rich-text bodies are TipTap documents; the read model uses its types.
	additionalDependencies: {
		"@rawkodeacademy/rich-text": "workspace:*"
	}
	additionalDevDependencies: {
		miniflare: "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-kubetrack"
			// TODO: replace with the id from `wrangler d1 create platform-kubetrack`
			// before the first deploy.
			databaseId: "00000000-0000-0000-0000-000000000000"
		}]
	}
}

codegen: _service.codegen
