# Lumary for Linux

A native GPUI feature explorer based on [Lumary's all-features page](https://lumary.app/all-features). It presents the published capture, production, editing, transcription, reliability, and automation catalog in a Linux desktop layout.

This is a reference UI prototype, not a screen recorder. Its feature descriptions and technical specifications describe Lumary's published macOS product; this project does not capture media, transcribe audio, or run the listed automation integrations.

## Run

This app uses the upstream GPUI and `gpui_platform` crates from a pinned Zed revision. It needs a recent stable Rust toolchain and the Linux graphics/windowing development packages required by GPUI, including Vulkan, X11, Wayland, xkbcommon, and fontconfig.

```sh
cargo run --manifest-path projects/lumary-linux/Cargo.toml
```

Both X11 and Wayland backends are enabled. The app is a feature browser prototype; it does not perform screen or audio capture.
