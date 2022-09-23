melange-server:
	docker container run \
		--rm \
		--privileged \
		-v "${PWD}":/work \
		cgr.dev/chainguard/melange \
		build melange.server.yaml \
		--arch x86_64

	docker container run \
		--rm \
		-v ${PWD}:/work \
		cgr.dev/chainguard/apko \
		build \
		/work/apko.yaml ghcr.io/rawkodeacademy/payloadcms-server:latest /work/payloadcms-server.tar
