group "default" {
    targets = ["server"]
}

target "server" {
    context = "payloadcms"
    platforms = ["linux/amd64", "linux/arm64"]
    tags = ["ghcr.io/rawkodeacademy/payloadcms-server"]
}
