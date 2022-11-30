group "default" {
    targets = ["server"]
}

target "server" {
    context = "."
    platforms = ["linux/amd64"]
    tags = ["ghcr.io/rawkodeacademy/cms-server"]
}
