package build

import (
	"dagger.io/dagger"
	"github.com/RawkodeAcademy/RawkodeAcademy/platform"
	"github.com/RawkodeAcademy/RawkodeAcademy/projects/cms"
	"github.com/RawkodeAcademy/RawkodeAcademy/projects/domains-and-dns:domains"
	"github.com/RawkodeAcademy/RawkodeAcademy/projects/web-links:weblinks"
)

dagger.#Plan & {
	client: env: DOPPLER_TOKEN: dagger.#Secret

	actions: build: {
		"platform": platform.#Build & {
			config: doppler: token: client.env.DOPPLER_TOKEN
		}

		projects: {
			"cms": cms.#Build & {
				config: doppler: token: client.env.DOPPLER_TOKEN
			}

			domainsDns: domains.#Build & {
				config: doppler: token: client.env.DOPPLER_TOKEN
			}

			webLinks: weblinks.#Build & {
				config: doppler: token: client.env.DOPPLER_TOKEN
			}
		}
	}
}
