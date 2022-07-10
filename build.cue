package build

import (
	"dagger.io/dagger"
	"dagger.io/dagger/core"
	"github.com/RawkodeAcademy/RawkodeAcademy/projects/web-links:web_links"
	"github.com/RawkodeAcademy/RawkodeAcademy/projects/domains-and-dns:domains_dns"
)

globalConfig: {
	cloudflare:
		accountId: "0aeb879de8e3cdde5fb3d413025222ce"
}

dagger.#Plan & {
	client: env: SOPS_AGE_KEY: dagger.#Secret

	client: commands: sops: {
		name: "sops"
		env: SOPS_AGE_KEY: client.env.SOPS_AGE_KEY
		args: ["-d", "secrets.yaml"]
		stdout: dagger.#Secret
	}

	actions: {
		secrets: core.#DecodeSecret & {
			input:  client.commands.sops.stdout
			format: "yaml"
		}

		build: {
			domainsDns: (domains_dns & {
				config: {
					cloudflare: {
						accountId: globalConfig.cloudflare.accountId
						apiToken:  secrets.output.cloudflare.apiToken.contents
					}
					pulumi: {
						accessToken: secrets.output.pulumi.apiToken.contents
					}
				}
			}).actions

			webLinks: (web_links & {
				config: {
					cloudflare: {
						accountId: globalConfig.cloudflare.accountId
						apiToken:  secrets.output.cloudflare.apiToken.contents
					}
				}
			}).actions
		}
	}
}
