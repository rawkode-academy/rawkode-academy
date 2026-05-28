package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project & {
	name: "code-rawkode-academy"

	let _t = tasks

	tasks: {
		gitops: schema.#TaskGroup & {
			type: "group"

			render: schema.#Task & {
				command: "kubectl"
				args: ["kustomize", "./gitops"]
				inputs: ["gitops/**"]
			}

			publish: schema.#Task & {
				command: "bash"
				args: ["-c", "flux push artifact oci://ghcr.io/rawkode-academy/code-rawkode-academy/gitops:${GITHUB_SHA:-local} --path=./gitops --source=${GITHUB_SERVER_URL:-https://github.com}/rawkode-academy/rawkode-academy --revision=${GITHUB_REF_NAME:-local}@sha1:${GITHUB_SHA:-local} && flux tag artifact oci://ghcr.io/rawkode-academy/code-rawkode-academy/gitops:${GITHUB_SHA:-local} --tag=latest"]
				inputs: ["gitops/**"]
				dependsOn: [_t.gitops.render]
			}
		}
	}
}
