package build

import (
	"dagger.io/dagger"
	"dagger.io/dagger/core"
	"github.com/RawkodeAcademy/RawkodeAcademy/projects/cms"
	"github.com/RawkodeAcademy/RawkodeAcademy/projects/domains-and-dns:domains_dns"
	"github.com/RawkodeAcademy/RawkodeAcademy/projects/web-links:weblinks"
	"github.com/RawkodeAcademy/RawkodeAcademy/projects/website"
)

globalConfig: {
	cloudflare:
		accountId: "0aeb879de8e3cdde5fb3d413025222ce"
	mongodb: atlas: {
		username:  "rawkodeacademy"
		publicKey: "bvjadywy"
	}
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
			"cms": cms.#Build & {
				config: github: token: secrets.output.github.token.contents
			}

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
			}).build

			"webLinks": weblinks.#Build & {
				config: {
					cloudflare: {
						accountId: globalConfig.cloudflare.accountId
						apiToken:  secrets.output.cloudflare.apiToken.contents
					}
					rudderStack: {
						basicAuth: secrets.output.rudderStack.basicAuth.contents
					}
				}
			}

			"website": website.#Build & {
				config: {
					cloudflare: {
						accountId: globalConfig.cloudflare.accountId
						apiToken:  secrets.output.cloudflare.apiToken.contents
					}
				}
			}
		}
	}
}
