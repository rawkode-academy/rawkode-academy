use gpui::{
    App, Bounds, Context, FontWeight, Render, ScrollHandle, Window, WindowBounds, WindowOptions, div,
    point, prelude::*, px, rgb, size,
};
use gpui_platform::application;

const BG: u32 = 0x0d0f14;
const PANEL: u32 = 0x12151c;
const PANEL_RAISED: u32 = 0x171b24;
const BORDER: u32 = 0x272d38;
const TEXT: u32 = 0xf2f3f6;
const MUTED: u32 = 0x8d95a4;
const ACCENT: u32 = 0x9c83ff;
const GREEN: u32 = 0x63d7a3;

struct Feature {
    title: &'static str,
    description: &'static str,
}

struct Category {
    title: &'static str,
    subtitle: &'static str,
    initials: &'static str,
    accent: u32,
    features: &'static [Feature],
}

const CATEGORIES: &[Category] = &[
    Category {
        title: "Multi-Source Capture",
        subtitle: "Keep screens, cameras, and audio as separate live inputs",
        initials: "MC",
        accent: 0x9c83ff,
        features: &[
            Feature { title: "Screen Recording", description: "Target a whole monitor, one window, or a chosen app; split multi-monitor sessions into individual files." },
            Feature { title: "App Exclusion", description: "Mask selected applications from the captured image while leaving the rest of the workspace visible." },
            Feature { title: "Camera Capture", description: "Use several cameras, preview them live, switch to a fallback device, and apply .cube color LUTs." },
            Feature { title: "Microphone Recording", description: "Select inputs per channel and route the resulting mix as mono or stereo." },
            Feature { title: "System Audio", description: "Record application output and operating-system sounds without installing another driver." },
            Feature { title: "Per-Source Files", description: "Keep each source in its own editor-ready file, avoiding a track extraction or re-encode step." },
            Feature { title: "Camera Diagnostics", description: "Inspect camera formats, USB throughput, and likely cable bottlenecks before choosing a setup." },
            Feature { title: "Audio Diagnostics", description: "Review microphone layout, transport, native formats, latency quality, and accepted sample rates." },
        ],
    },
    Category {
        title: "Professional Codecs",
        subtitle: "Choose delivery-friendly encoders or post-production masters",
        initials: "PC",
        accent: 0x61b6f0,
        features: &[
            Feature { title: "H.264", description: "Use a widely playable high-profile encode for everyday clips, sharing, and streams." },
            Feature { title: "HEVC (H.265)", description: "Cut file size by about 40% versus H.264, useful when 4K footage needs to fit smaller storage." },
            Feature { title: "ProRes 422", description: "Pick a post-production codec with quality levels ranging from Proxy through HQ." },
            Feature { title: "ProRes 4444", description: "Use alpha-capable mastering for compositing and visual effects, including the higher-quality XQ flavor." },
            Feature { title: "Professional Audio", description: "Choose compressed AAC from 64–320 kbps or lossless 16/24/32-bit PCM in WAV or CAF." },
        ],
    },
    Category {
        title: "Production Tools",
        subtitle: "Small tools that keep production sessions organized",
        initials: "PT",
        accent: 0xe5a65c,
        features: &[
            Feature { title: "Slate System", description: "Track scene, shot, and take numbers, increment them automatically, and attach slate data to each session." },
            Feature { title: "Markers", description: "Add a note at any moment to flag a keeper, a problem take, or an edit point." },
            Feature { title: "Projects", description: "Recall a complete setup with inputs, encoding preferences, and slate defaults." },
            Feature { title: "Composition Guides", description: "Place safe margins, thirds, a center mark, or aspect-ratio frames over the preview." },
            Feature { title: "Audio Metering", description: "Watch each input's level and peaks, with clear clipping cues." },
        ],
    },
    Category {
        title: "Composite Recording & Scenes",
        subtitle: "Compose screen and camera output, then change scenes live",
        initials: "SC",
        accent: 0xd889d5,
        features: &[
            Feature { title: "Picture-in-Picture", description: "Combine desktop and camera with mixed sound, then choose six included scenes or build your own. Each stock scene has a Ctrl+1–6 shortcut." },
            Feature { title: "Source Presets", description: "Save a source's layout and look under a name; refresh or rename it from its context menu. Keep source controls in one horizontal strip." },
            Feature { title: "OBS-Style Panels", description: "Arrange source and scene lists, change visibility and stacking, lock items, and create, copy, rename, or remove entries." },
            Feature { title: "Overlay Style Presets", description: "Store shape, outline, shadow, and corner radius independently from an element's placement." },
            Feature { title: "Crop Controls", description: "Hold Cmd and drag an edge to trim the view. Select a feed in the preview or clear the selection from empty space." },
            Feature { title: "Live Switching", description: "Apply animated scene changes while a session is active, useful for tutorials and demos." },
            Feature { title: "Metal-Accelerated", description: "Use a separate GPU write path, paced render work, and cached shadows to support smooth output at 30–60 fps." },
        ],
    },
    Category {
        title: "Export Pipeline",
        subtitle: "Move a session from source media to a finished deliverable",
        initials: "EX",
        accent: 0x62c9c6,
        features: &[
            Feature { title: "Session Packages", description: "Store each session's source media, recovery points, rendered files, and manifest in a predictable folder structure." },
            Feature { title: "Segmented Capture", description: "Write fixed time slices and roll between them without blocking; recover sessions if an encoder stops mid-slice." },
            Feature { title: "Smart Codec Selection", description: "Protect encoder headroom with ProRes Proxy for screen sources during camera recording; save audio as lossless PCM CAF." },
            Feature { title: "Composite Export", description: "Render a screen/camera layout as one delivery file or convert sources independently; queue jobs and cancel them." },
            Feature { title: "Batch Export", description: "Set codec, container, dimensions, and frame rate across many sessions; choose a combined render when the layout calls for it." },
            Feature { title: "Post-Export Cleanup", description: "After an export succeeds, optionally remove source media. Remove deliverables separately from their context menu." },
        ],
    },
    Category {
        title: "Screen Annotation",
        subtitle: "Draw, label, and guide attention without leaving a capture",
        initials: "AN",
        accent: 0xf07e78,
        features: &[
            Feature { title: "Drawing Tools", description: "Switch among selection, pen, marker, arrow, line, shapes, text, eraser, laser, and image tools with V/P/H/A/L/R-D-C/T/E/O/I keys." },
            Feature { title: "17 Shape Types", description: "Create geometry, flowchart symbols, callouts, stars, hearts, and checks. Rectangles and diamonds support rounded or square corners." },
            Feature { title: "Smart Arrows", description: "Attach arrows to shapes so they move together; route elbow connectors around obstacles and adjust their segments." },
            Feature { title: "Post-Draw Editing", description: "Edit color, weight, dash pattern, arrow tips, fill, rotation, or the endpoints of a mark after drawing." },
            Feature { title: "Group & Resize", description: "Group multiple marks, scale them together, or import a custom shape collection from Excalidraw." },
            Feature { title: "Shape Fill & Colors", description: "Set stroke and fill independently, with empty, translucent, or solid fills and an 11-swatch palette." },
            Feature { title: "Whiteboard Mode", description: "Press W for a blank canvas, dots, grid, or lines; adjust pattern spacing and backdrop color." },
            Feature { title: "Recording Integration", description: "Include marks in the finished video, hide the on-screen toolbar when desired, and work across multiple displays." },
        ],
    },
    Category {
        title: "Cursor Highlight & Spotlight",
        subtitle: "Help viewers follow the pointer and keyboard on screen",
        initials: "FX",
        accent: 0xffcb68,
        features: &[
            Feature { title: "Cursor Highlight", description: "Choose a ring, disk, squircle, or diamond that follows the pointer. Tune size, hue, transparency, outline, and left/right click animations." },
            Feature { title: "Spotlight", description: "Darken the display around a bright cursor window; tune its 80–600 pt aperture, dim level, edge softness, and tracking speed." },
            Feature { title: "Keystroke Display", description: "Show modifier symbols and special keys as floating labels; adjust position, type scale, duration, width, and modifiers-only mode." },
            Feature { title: "Persistent Settings", description: "Presentation preferences survive restarts and can also be stored within an encoding preset." },
            Feature { title: "Total Control", description: "Toggle these helpers from controls, shortcuts, a Stream Deck, or URL actions such as toggle-spotlight." },
        ],
    },
    Category {
        title: "Virtual Teleprompter",
        subtitle: "Keep your script in view while you present",
        initials: "TP",
        accent: 0xb596fc,
        features: &[
            Feature { title: "Multi-Script Editor", description: "Keep scripts organized, switch between them, and follow a reading marker as you go." },
            Feature { title: "Auto-Scroll", description: "Set pace from 1 to 50, adjust it from a shortcut or Stream Deck, or jump the script to the upper center." },
            Feature { title: "Global Hotkeys", description: "Play, pause, reset, or adjust pace with keys while another window remains in front." },
            Feature { title: "Stream Deck Control", description: "Choose among six teleprompter actions for playback, pace, overlay, editor, and active script." },
            Feature { title: "URL Scheme", description: "Automate playback, speed, overlays, editor, and script management through 18 URL actions." },
            Feature { title: "Invisible in Recordings", description: "The audience view excludes the script overlay; it stays visible only to the presenter." },
        ],
    },
    Category {
        title: "On-Device Transcription",
        subtitle: "Transcribe speech without sending recordings to a cloud service",
        initials: "AI",
        accent: 0x7fcf97,
        features: &[
            Feature { title: "Whisper on-device speech recognition", description: "Run speech recognition locally without sending recorded audio to a remote service." },
            Feature { title: "4 Model Sizes", description: "Download Tiny, Base, Small, or Large v3 when needed; model files range from about 75 MB to 3 GB." },
            Feature { title: "26 Languages", description: "Select from 26 supported languages or let the recognizer identify speech automatically." },
            Feature { title: "Auto-Transcribe", description: "Start transcription after a session or process selected recordings manually or in batches." },
            Feature { title: "Caption Export", description: "Create SRT, VTT, or JSON captions with timestamps aligned to the source audio." },
        ],
    },
    Category {
        title: "Reliability",
        subtitle: "Protect long sessions from interrupted sources and storage issues",
        initials: "RL",
        accent: 0xe5a65c,
        features: &[
            Feature { title: "Crash Recovery", description: "Fragmented MP4 helps preserve interrupted captures and makes repair of unfinished sessions possible." },
            Feature { title: "Session Checkpoints", description: "Snapshot session state every 30 seconds; optionally keep marker changes backed up continuously." },
            Feature { title: "Preflight Checks", description: "Check access, devices, available storage, and encoder combinations before recording." },
            Feature { title: "Storage Monitoring", description: "Track remaining disk space live, warn when it gets low, and estimate output size for each codec." },
            Feature { title: "Error Handling", description: "Track failures by source and continue with partial output when other sources remain usable." },
            Feature { title: "Screen Source Recovery", description: "Retry interrupted screen feeds with increasing waits, then show device, stream, and write alerts." },
            Feature { title: "Backpressure Protection", description: "Use a nonblocking composite path that drops excess frames and warns when loss reaches 15%." },
        ],
    },
    Category {
        title: "Automation",
        subtitle: "Use shortcuts and connected devices to run frequent actions",
        initials: "AU",
        accent: 0x61b6f0,
        features: &[
            Feature { title: "Menu Bar Status Item", description: "See idle, active, paused, or countdown state with elapsed time; open controls for annotation and presentation too." },
            Feature { title: "25+ Global Hotkeys", description: "Customize more than 25 shortcuts spanning recording, scripts, drawing, and presentation tools." },
            Feature { title: "URL Scheme (50+ Commands)", description: "Issue more than 50 URL actions for capture, slate, audio, markers, guides, scenes, scripts, annotation, and utilities." },
            Feature { title: "Stream Deck Plugin (19 Actions)", description: "Map 19 actions to recording time, markers, scenes, annotation, teleprompter, presentation helpers, and related controls." },
            Feature { title: "Shortcuts & AppleScript", description: "Compose workflows with macOS Shortcuts, AppleScript, or any client able to open a URL." },
        ],
    },
    Category {
        title: "Course Mode",
        subtitle: "Arrange lessons and keep multiple attempts in order",
        initials: "CM",
        accent: 0xd889d5,
        features: &[
            Feature { title: "Course Outlines", description: "Plan a curriculum as modules and lessons before starting the recording session." },
            Feature { title: "Per-Lesson Takes", description: "Store several attempts for each lesson, preserving earlier versions while you try another take." },
            Feature { title: "Hero Take Selection", description: "Mark one recording as the preferred take for each lesson." },
            Feature { title: "Module Organization", description: "Collect related lessons into modules and move through the curriculum hierarchy." },
            Feature { title: "Lesson Picker", description: "Jump to a lesson from a compact selector while continuing the session." },
        ],
    },
    Category {
        title: "Privacy First",
        subtitle: "Keep footage, speech, and session data under your control",
        initials: "PR",
        accent: 0x7fcf97,
        features: &[
            Feature { title: "No Cloud", description: "Keep work on the device without accounts, uploads, or outside services." },
            Feature { title: "No Analytics", description: "Recording activity and behavior are not measured; telemetry is disabled." },
            Feature { title: "Local Storage", description: "Save files in a folder you choose and keep control of their location." },
            Feature { title: "On-Device AI", description: "Generate transcripts locally so recorded speech stays on the computer." },
            Feature { title: "App Sandbox", description: "Run with a constrained permission set that asks only for access the workflow needs." },
        ],
    },
    Category {
        title: "Technical Specifications",
        subtitle: "A quick reference for platform, media, and performance details",
        initials: "TS",
        accent: 0x61b6f0,
        features: &[
            Feature { title: "System Requirements", description: "The published build calls for macOS 15+, an Intel or Apple Silicon Mac, 8 GB of RAM minimum, and 16 GB recommended." },
            Feature { title: "Video Formats", description: "Available video encoders include H.264, HEVC, ProRes 422, and ProRes 4444/XQ." },
            Feature { title: "Audio Formats", description: "Output AAC or 16/24/32-bit lossless PCM in WAV or CAF, at 44.1 or 48 kHz." },
            Feature { title: "Performance", description: "The reference lists start under 200 ms, stop under 100 ms, 60 fps Metal compositing, and zero-copy GPU preview." },
        ],
    },
];

struct FeatureExplorer {
    active_category: Option<usize>,
    selected_feature: usize,
    is_saved: bool,
    demo_active: bool,
    content_scroll: ScrollHandle,
}

impl FeatureExplorer {
    fn new() -> Self {
        Self {
            active_category: None,
            selected_feature: 0,
            is_saved: false,
            demo_active: false,
            content_scroll: ScrollHandle::new(),
        }
    }

    fn selected_feature(&self) -> (&'static Category, &'static Feature) {
        let mut index = 0;
        for category in CATEGORIES {
            for feature in category.features {
                if index == self.selected_feature {
                    return (category, feature);
                }
                index += 1;
            }
        }
        (&CATEGORIES[0], &CATEGORIES[0].features[0])
    }

    fn first_feature_index(category_index: usize) -> usize {
        CATEGORIES
            .iter()
            .take(category_index)
            .map(|category| category.features.len())
            .sum()
    }

    fn total_features() -> usize {
        CATEGORIES.iter().map(|category| category.features.len()).sum()
    }

    fn header(&self) -> gpui::Div {
        div()
            .h(px(60.0))
            .w_full()
            .flex()
            .items_center()
            .justify_between()
            .px(px(22.0))
            .bg(rgb(0x11141a))
            .border_b_1()
            .border_color(rgb(BORDER))
            .child(
                div()
                    .flex()
                    .items_center()
                    .gap_3()
                    .child(
                        div()
                            .size(px(30.0))
                            .flex()
                            .items_center()
                            .justify_center()
                            .rounded_lg()
                            .bg(rgb(ACCENT))
                            .text_sm()
                            .font_weight(FontWeight::BOLD)
                            .text_color(rgb(0x11111a))
                            .child("L"),
                    )
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .gap(px(1.0))
                            .child(
                                div()
                                    .text_color(rgb(TEXT))
                                    .font_weight(FontWeight::SEMIBOLD)
                                    .child("lumary"),
                            )
                            .child(
                                div()
                                    .text_size(px(10.0))
                                    .text_color(rgb(MUTED))
                                    .child("LINUX FEATURE EXPLORER"),
                            ),
                    ),
            )
            .child(
                div()
                    .flex()
                    .items_center()
                    .gap_2()
                    .rounded_md()
                    .bg(rgb(PANEL_RAISED))
                    .px_3()
                    .py_2()
                    .child(div().text_size(px(12.0)).text_color(rgb(MUTED)).child("Product"))
                    .child(div().text_size(px(12.0)).text_color(rgb(MUTED)).child("/"))
                    .child(div().text_size(px(12.0)).text_color(rgb(TEXT)).child("All features")),
            )
            .child(
                div()
                    .flex()
                    .items_center()
                    .gap_3()
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap_2()
                            .rounded_full()
                            .border_1()
                            .border_color(rgb(BORDER))
                            .bg(rgb(PANEL))
                            .px_3()
                            .py_2()
                            .child(div().size(px(6.0)).rounded_full().bg(rgb(GREEN)))
                            .child(div().text_size(px(11.0)).text_color(rgb(0xb5bdc9)).child("Local by design")),
                    )
                    .child(
                        div()
                            .rounded_full()
                            .bg(rgb(0x252332))
                            .px_3()
                            .py_2()
                            .text_size(px(12.0))
                            .font_weight(FontWeight::SEMIBOLD)
                            .text_color(rgb(0xd2c8ff))
                            .child("LINUX · REFERENCE"),
                    ),
            )
    }

    fn sidebar(&self, cx: &mut Context<Self>) -> gpui::Div {
        let total = Self::total_features();
        div()
            .w(px(246.0))
            .flex_shrink_0()
            .h_full()
            .flex()
            .flex_col()
            .bg(rgb(0x101319))
            .border_r_1()
            .border_color(rgb(BORDER))
            .px_3()
            .py_4()
            .child(
                div()
                    .flex()
                    .items_center()
                    .justify_between()
                    .px_2()
                    .mb_4()
                    .child(
                        div()
                            .text_size(px(10.0))
                            .font_weight(FontWeight::SEMIBOLD)
                            .text_color(rgb(MUTED))
                            .child("BROWSE LIBRARY"),
                    )
                    .child(
                        div()
                            .rounded_full()
                            .bg(rgb(0x232332))
                            .px_2()
                            .py_1()
                            .text_size(px(10.0))
                            .text_color(rgb(0xd1c8ff))
                            .child("14 SECTIONS"),
                    ),
            )
            .child(
                div()
                    .id("section-list")
                    .flex_1()
                    .overflow_y_scroll()
                    .child(self.navigation_item(
                        "All features",
                        "Explore every capability",
                        "ALL",
                        None,
                        self.active_category.is_none(),
                        format!("{total}"),
                        cx,
                    ))
                    .child(
                        div()
                            .mt_5()
                            .mb_2()
                            .px_2()
                            .text_size(px(10.0))
                            .font_weight(FontWeight::SEMIBOLD)
                            .text_color(rgb(0x717987))
                            .child("FEATURE GROUPS"),
                    )
                    .children(CATEGORIES.iter().enumerate().map(|(index, category)| {
                        self.navigation_item(
                            category.title,
                            category.subtitle,
                            category.initials,
                            Some(index),
                            self.active_category == Some(index),
                            format!("{}", category.features.len()),
                            cx,
                        )
                    })),
            )
            .child(
                div()
                    .mt_4()
                    .rounded_lg()
                    .border_1()
                    .border_color(rgb(BORDER))
                    .bg(rgb(PANEL))
                    .p_3()
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap_2()
                            .child(div().size(px(7.0)).rounded_full().bg(rgb(GREEN)))
                            .child(
                                div()
                                    .text_size(px(11.0))
                                    .font_weight(FontWeight::MEDIUM)
                                    .text_color(rgb(0xc7ccd6))
                                    .child("Offline-first workflow"),
                            ),
                    )
                    .child(
                        div()
                            .mt_2()
                            .text_size(px(10.0))
                            .text_color(rgb(MUTED))
                            .child("A local feature guide for focused production."),
                    ),
            )
    }

    fn navigation_item(
        &self,
        title: &'static str,
        subtitle: &'static str,
        initials: &'static str,
        category: Option<usize>,
        active: bool,
        count: String,
        cx: &mut Context<Self>,
    ) -> impl gpui::IntoElement {
        let category_index = category;
        let target = category_index.map(Self::first_feature_index).unwrap_or(0);
        let accent = category_index
            .map(|index| rgb(CATEGORIES[index].accent))
            .unwrap_or(rgb(ACCENT));
        let mut item = div()
            .id(format!("nav-{}", category_index.unwrap_or(999)))
            .w_full()
            .flex()
            .items_center()
            .gap_2()
            .rounded_md()
            .px_2()
            .py_2()
            .mb(px(2.0))
            .bg(if active { rgb(0x252332) } else { rgb(0x101319) })
            .hover(|style| style.bg(rgb(0x20232c)).cursor_pointer())
            .on_click(cx.listener(move |this, _, _, cx| {
                this.active_category = category_index;
                this.selected_feature = target;
                this.is_saved = false;
                this.content_scroll.set_offset(point(px(0.0), px(0.0)));
                cx.notify();
            }))
            .child(
                div()
                    .size(px(30.0))
                    .flex_shrink_0()
                    .flex()
                    .items_center()
                    .justify_center()
                    .rounded_md()
                    .bg(if active { rgb(0x38324e) } else { rgb(PANEL_RAISED) })
                    .text_size(px(9.0))
                    .font_weight(FontWeight::BOLD)
                    .text_color(accent)
                    .child(initials),
            )
            .child(
                div()
                    .flex_1()
                    .overflow_hidden()
                    .child(
                        div()
                            .text_size(px(11.0))
                            .font_weight(if active { FontWeight::SEMIBOLD } else { FontWeight::MEDIUM })
                            .text_color(if active { rgb(TEXT) } else { rgb(0xb5bdc8) })
                            .child(title),
                    )
                    .child(
                        div()
                            .text_size(px(9.0))
                            .text_color(rgb(MUTED))
                            .child(if category.is_none() { subtitle } else { "Feature collection" }),
                    ),
            )
            .child(
                div()
                    .text_size(px(10.0))
                    .text_color(rgb(if active { 0xd4ceff } else { 0x6f7784 }))
                    .child(count),
            );
        if active {
            item = item.border_1().border_color(rgb(0x494260));
        }
        item
    }

    fn recording_preview(&self, cx: &mut Context<Self>) -> gpui::Div {
        let status = if self.demo_active { "DEMO ACTIVE" } else { "READY" };
        let status_color = if self.demo_active { rgb(0xc7b9ff) } else { rgb(0x94a0b0) };
        div()
            .w(px(350.0))
            .flex_shrink_0()
            .rounded_xl()
            .border_1()
            .border_color(rgb(0x303646))
            .bg(rgb(0x171b24))
            .p_3()
            .shadow_lg()
            .child(
                div()
                    .flex()
                    .items_center()
                    .justify_between()
                    .mb_3()
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap_2()
                            .child(div().size(px(7.0)).rounded_full().bg(rgb(0xf47a72)))
                            .child(div().size(px(7.0)).rounded_full().bg(rgb(0xf1c46c)))
                            .child(div().size(px(7.0)).rounded_full().bg(rgb(0x71c88d)))
                            .child(
                                div()
                                    .ml_2()
                                    .text_size(px(10.0))
                                    .text_color(rgb(0x9ea7b6))
                                    .child("Sample layout · lesson-04"),
                            ),
                    )
                    .child(
                        div()
                            .text_size(px(9.0))
                            .font_weight(FontWeight::SEMIBOLD)
                            .text_color(status_color)
                            .child(status),
                    ),
            )
            .child(
                div()
                    .relative()
                    .h(px(190.0))
                    .w_full()
                    .overflow_hidden()
                    .rounded_lg()
                    .bg(rgb(0x101721))
                    .border_1()
                    .border_color(rgb(0x252d3a))
                    .child(
                        div()
                            .absolute()
                            .top(px(18.0))
                            .left(px(18.0))
                            .right(px(18.0))
                            .child(
                                div()
                                    .text_size(px(9.0))
                                    .font_weight(FontWeight::SEMIBOLD)
                                    .text_color(rgb(0x8b96a7))
                                    .child("FIELD NOTES / PRODUCT WALKTHROUGH"),
                            )
                            .child(
                                div()
                                    .mt_2()
                                    .text_size(px(20.0))
                                    .font_weight(FontWeight::BOLD)
                                    .text_color(rgb(0xf0f1f5))
                                    .child("A clear story,\nfrom every angle."),
                            )
                            .child(
                                div()
                                    .mt_2()
                                    .h(px(2.0))
                                    .w(px(70.0))
                                    .rounded_full()
                                    .bg(rgb(ACCENT)),
                            )
                            .child(
                                div()
                                    .mt_3()
                                    .text_size(px(9.0))
                                    .text_color(rgb(0x8791a1))
                                    .child("DISPLAY 1  ·  CAMERA  ·  MIC"),
                            ),
                    )
                    .child(
                        div()
                            .absolute()
                            .right(px(16.0))
                            .bottom(px(16.0))
                            .size(px(64.0))
                            .flex()
                            .items_center()
                            .justify_center()
                            .rounded_full()
                            .border_2()
                            .border_color(rgb(0xb4a1ff))
                            .bg(rgb(0x57498e))
                            .text_size(px(10.0))
                            .font_weight(FontWeight::SEMIBOLD)
                            .text_color(rgb(0xf4f0ff))
                            .child("CAM"),
                    )
                    .child(
                        div()
                            .absolute()
                            .left(px(18.0))
                            .bottom(px(16.0))
                            .flex()
                            .items_center()
                            .gap(px(5.0))
                            .child(div().size(px(5.0)).rounded_full().bg(rgb(0xf47a72)))
                            .child(div().text_size(px(9.0)).text_color(rgb(0xc7cfda)).child("SCREEN + CAMERA")),
                    ),
            )
            .child(
                div()
                    .flex()
                    .items_center()
                    .justify_between()
                    .mt_3()
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap_2()
                            .child(div().text_size(px(9.0)).text_color(rgb(0x828c9b)).child("01  DISPLAY"))
                            .child(div().text_size(px(9.0)).text_color(rgb(0x59616e)).child("•"))
                            .child(div().text_size(px(9.0)).text_color(rgb(0x828c9b)).child("02  CAMERA"))
                            .child(div().text_size(px(9.0)).text_color(rgb(0x59616e)).child("•"))
                            .child(div().text_size(px(9.0)).text_color(rgb(0x828c9b)).child("03  AUDIO")),
                    )
                    .child(
                        div()
                            .id("record-toggle")
                            .rounded_md()
                            .bg(if self.demo_active { rgb(0x512e35) } else { rgb(0x342e49) })
                            .px_2()
                            .py_1()
                            .text_size(px(9.0))
                            .font_weight(FontWeight::SEMIBOLD)
                            .text_color(if self.demo_active { rgb(0xffa09a) } else { rgb(0xd2c8ff) })
                            .hover(|style| style.bg(rgb(0x453d5c)).cursor_pointer())
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.demo_active = !this.demo_active;
                                cx.notify();
                            }))
                            .child(if self.demo_active { "Stop demo" } else { "Start demo" }),
                    ),
            )
    }

    fn hero(&self, cx: &mut Context<Self>) -> gpui::Div {
        div()
            .flex()
            .items_center()
            .justify_between()
            .gap_6()
            .rounded_xl()
            .border_1()
            .border_color(rgb(0x2c3040))
            .bg(rgb(0x151821))
            .p_6()
            .child(
                div()
                    .flex_1()
                    .flex()
                    .flex_col()
                    .items_start()
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap_2()
                            .rounded_full()
                            .border_1()
                            .border_color(rgb(0x423a5d))
                            .bg(rgb(0x242137))
                            .px_3()
                            .py_1()
                            .child(div().size(px(6.0)).rounded_full().bg(rgb(ACCENT)))
                            .child(
                                div()
                                    .text_size(px(9.0))
                                    .font_weight(FontWeight::SEMIBOLD)
                                    .text_color(rgb(0xd5ccff))
                                    .child("THE COMPLETE FEATURE GUIDE"),
                            ),
                    )
                    .child(
                        div()
                            .mt_4()
                            .text_size(px(33.0))
                            .font_weight(FontWeight::BOLD)
                            .text_color(rgb(TEXT))
                            .child("Every tool for a polished capture workflow"),
                    )
                    .child(
                        div()
                            .mt_3()
                            .text_size(px(13.0))
                            .text_color(rgb(0xa5adba))
                            .child("Explore a production toolkit for screens and cameras, post-production codecs, on-device captions, live annotation, and workflow control in a native Linux desktop guide."),
                    )
                    .child(
                        div()
                            .mt_5()
                            .flex()
                            .items_center()
                            .gap_3()
                            .child(
                                div()
                                    .id("browse-capture")
                                    .flex()
                                    .items_center()
                                    .gap_2()
                                    .rounded_md()
                                    .bg(rgb(ACCENT))
                                    .px_4()
                                    .py_2()
                                    .text_size(px(11.0))
                                    .font_weight(FontWeight::SEMIBOLD)
                                    .text_color(rgb(0x12121a))
                                    .hover(|style| style.bg(rgb(0xb39fff)).cursor_pointer())
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.active_category = Some(0);
                                        this.selected_feature = 0;
                                        this.is_saved = false;
                                        this.content_scroll.set_offset(point(px(0.0), px(0.0)));
                                        cx.notify();
                                    }))
                                    .child("Explore capture")
                                    .child(div().text_size(px(14.0)).child("→")),
                            )
                            .child(
                                div()
                                    .text_size(px(10.0))
                                    .text_color(rgb(MUTED))
                                    .child(format!("{} features across {} sections", Self::total_features(), CATEGORIES.len())),
                            ),
                    )
                    .child(
                        div()
                            .mt_5()
                            .flex()
                            .items_center()
                            .gap_2()
                            .child(div().size(px(6.0)).rounded_full().bg(rgb(GREEN)))
                            .child(
                                div()
                                    .text_size(px(10.0))
                                    .text_color(rgb(0x9ca5b3))
                                    .child("Private by design. No cloud required."),
                            ),
                    ),
            )
            .child(self.recording_preview(cx))
    }

    fn feature_card(
        &self,
        feature: &'static Feature,
        category: &'static Category,
        global_index: usize,
        cx: &mut Context<Self>,
    ) -> impl gpui::IntoElement {
        let selected = global_index == self.selected_feature;
        div()
            .id(format!("feature-{global_index}"))
            .flex()
            .flex_col()
            .items_start()
            .rounded_lg()
            .border_1()
            .border_color(rgb(if selected { 0x55487a } else { BORDER }))
            .bg(if selected { rgb(0x191925) } else { rgb(PANEL) })
            .p_4()
            .hover(|style| style.bg(rgb(0x1b1e28)).cursor_pointer())
            .on_click(cx.listener(move |this, _, _, cx| {
                this.selected_feature = global_index;
                this.is_saved = false;
                cx.notify();
            }))
            .child(
                div()
                    .flex()
                    .w_full()
                    .items_center()
                    .justify_between()
                    .child(
                        div()
                            .size(px(28.0))
                            .flex()
                            .items_center()
                            .justify_center()
                            .rounded_md()
                            .bg(rgb(category.accent))
                            .text_size(px(9.0))
                            .font_weight(FontWeight::BOLD)
                            .text_color(rgb(0x11131a))
                            .child(category.initials),
                    )
                    .child(
                        div()
                            .text_size(px(9.0))
                            .font_weight(FontWeight::SEMIBOLD)
                            .text_color(rgb(if selected { category.accent } else { 0x727b89 }))
                            .child(if selected { "SELECTED" } else { "OPEN DETAILS  ↗" }),
                    ),
            )
            .child(
                div()
                    .mt_3()
                    .text_size(px(14.0))
                    .font_weight(FontWeight::SEMIBOLD)
                    .text_color(rgb(TEXT))
                    .child(feature.title),
            )
            .child(
                div()
                    .mt_2()
                    .text_size(px(11.0))
                    .text_color(rgb(0x9ba4b2))
                    .child(feature.description),
            )
    }

    fn feature_sections(&self, cx: &mut Context<Self>) -> gpui::Div {
        let selected_category = self.active_category;
        let mut feature_index = 0usize;
        div()
            .flex()
            .flex_col()
            .gap_6()
            .children(CATEGORIES.iter().enumerate().filter_map(|(category_index, category)| {
                let first_index = feature_index;
                feature_index += category.features.len();
                if selected_category.is_some_and(|selected| selected != category_index) {
                    return None;
                }

                let cards = category.features.iter().enumerate().map(|(local_index, feature)| {
                    self.feature_card(feature, category, first_index + local_index, cx)
                });

                Some(
                    div()
                        .flex()
                        .flex_col()
                        .gap_3()
                        .child(
                            div()
                                .flex()
                                .items_end()
                                .justify_between()
                                .gap_3()
                                .child(
                                    div()
                                        .flex()
                                        .flex_col()
                                        .gap_1()
                                        .child(
                                            div()
                                                .text_size(px(17.0))
                                                .font_weight(FontWeight::SEMIBOLD)
                                                .text_color(rgb(TEXT))
                                                .child(category.title),
                                        )
                                        .child(
                                            div()
                                                .text_size(px(11.0))
                                                .text_color(rgb(MUTED))
                                                .child(category.subtitle),
                                        ),
                                )
                                .child(
                                    div()
                                        .rounded_full()
                                        .border_1()
                                        .border_color(rgb(BORDER))
                                        .bg(rgb(PANEL))
                                        .px_2()
                                        .py_1()
                                        .text_size(px(9.0))
                                        .text_color(rgb(0xaeb6c2))
                                        .child(format!("{} CAPABILITIES", category.features.len())),
                                ),
                        )
                        .child(
                            div()
                                .grid()
                                .grid_cols(2)
                                .gap_3()
                                .children(cards),
                        ),
                )
            }))
    }

    fn detail_panel(&self, cx: &mut Context<Self>) -> gpui::Div {
        let (category, feature) = self.selected_feature();
        let count = category.features.len();
        div()
            .w(px(268.0))
            .flex_shrink_0()
            .h_full()
            .flex()
            .flex_col()
            .gap_4()
            .bg(rgb(0x101319))
            .border_l_1()
            .border_color(rgb(BORDER))
            .p_4()
            .child(
                div()
                    .flex()
                    .items_center()
                    .justify_between()
                    .child(
                        div()
                            .text_size(px(10.0))
                            .font_weight(FontWeight::SEMIBOLD)
                            .text_color(rgb(MUTED))
                            .child("FEATURE FOCUS"),
                    )
                    .child(
                        div()
                            .rounded_full()
                            .bg(rgb(0x252332))
                            .px_2()
                            .py_1()
                            .text_size(px(9.0))
                            .text_color(rgb(0xd0c7ff))
                            .child("DETAILS"),
                    ),
            )
            .child(
                div()
                    .flex()
                    .flex_col()
                    .items_start()
                    .rounded_xl()
                    .border_1()
                    .border_color(rgb(0x333142))
                    .bg(rgb(0x171721))
                    .p_4()
                    .child(
                        div()
                            .size(px(38.0))
                            .flex()
                            .items_center()
                            .justify_center()
                            .rounded_lg()
                            .bg(rgb(category.accent))
                            .text_size(px(10.0))
                            .font_weight(FontWeight::BOLD)
                            .text_color(rgb(0x11131a))
                            .child(category.initials),
                    )
                    .child(
                        div()
                            .mt_4()
                            .text_size(px(17.0))
                            .font_weight(FontWeight::SEMIBOLD)
                            .text_color(rgb(TEXT))
                            .child(feature.title),
                    )
                    .child(
                        div()
                            .mt_2()
                            .text_size(px(11.0))
                            .text_color(rgb(0xa2aab8))
                            .child(feature.description),
                    )
                    .child(
                        div()
                            .mt_4()
                            .rounded_full()
                            .bg(rgb(0x252332))
                            .px_2()
                            .py_1()
                            .text_size(px(9.0))
                            .text_color(rgb(0xd1c8ff))
                            .child(category.title),
                    )
                    .child(
                        div()
                            .id("save-feature")
                            .w_full()
                            .mt_4()
                            .flex()
                            .items_center()
                            .justify_center()
                            .rounded_md()
                            .border_1()
                            .border_color(rgb(if self.is_saved { 0x4b715f } else { 0x3a3c49 }))
                            .bg(if self.is_saved { rgb(0x1c342b) } else { rgb(0x222530) })
                            .px_3()
                            .py_2()
                            .text_size(px(10.0))
                            .font_weight(FontWeight::SEMIBOLD)
                            .text_color(if self.is_saved { rgb(0x9de2ba) } else { rgb(0xcbd0da) })
                            .hover(|style| style.bg(rgb(0x303241)).cursor_pointer())
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.is_saved = !this.is_saved;
                                cx.notify();
                            }))
                            .child(if self.is_saved { "✓  Saved for this session" } else { "☆  Save this feature" }),
                    ),
            )
            .child(
                div()
                    .rounded_xl()
                    .border_1()
                    .border_color(rgb(BORDER))
                    .bg(rgb(PANEL))
                    .p_4()
                    .child(
                        div()
                            .text_size(px(10.0))
                            .font_weight(FontWeight::SEMIBOLD)
                            .text_color(rgb(0xaeb6c2))
                            .child("IN THIS COLLECTION"),
                    )
                    .child(
                        div()
                            .mt_3()
                            .text_size(px(13.0))
                            .font_weight(FontWeight::SEMIBOLD)
                            .text_color(rgb(TEXT))
                            .child(category.title),
                    )
                    .child(
                        div()
                            .mt_1()
                            .text_size(px(10.0))
                            .text_color(rgb(MUTED))
                            .child(category.subtitle),
                    )
                    .child(
                        div()
                            .mt_3()
                            .flex()
                            .items_center()
                            .justify_between()
                            .child(div().text_size(px(10.0)).text_color(rgb(0x9aa3b0)).child("Capabilities"))
                            .child(div().text_size(px(10.0)).font_weight(FontWeight::SEMIBOLD).text_color(rgb(category.accent)).child(format!("{count}"))),
                    ),
            )
            .child(
                div()
                    .flex_1()
                    .rounded_xl()
                    .border_1()
                    .border_color(rgb(BORDER))
                    .bg(rgb(PANEL))
                    .p_4()
                    .child(
                        div()
                            .text_size(px(10.0))
                            .font_weight(FontWeight::SEMIBOLD)
                            .text_color(rgb(0xaeb6c2))
                            .child("AT A GLANCE"),
                    )
                    .child(metric("14", "feature groups", 0xd1c8ff))
                    .child(metric("4", "Whisper model sizes", 0x7fcf97))
                    .child(metric("26", "transcription languages", 0x61b6f0))
                    .child(metric("50+", "automation commands", 0xe5a65c))
                    .child(
                        div()
                            .mt_4()
                            .border_t_1()
                            .border_color(rgb(BORDER))
                            .pt_3()
                            .text_size(px(10.0))
                            .text_color(rgb(MUTED))
                            .child("One-time purchase · no subscription"),
                    ),
            )
    }
}

fn metric(value: &'static str, label: &'static str, accent: u32) -> gpui::Div {
    div()
        .mt_3()
        .flex()
        .items_center()
        .gap_3()
        .child(
            div()
                .w(px(42.0))
                .text_size(px(17.0))
                .font_weight(FontWeight::BOLD)
                .text_color(rgb(accent))
                .child(value),
        )
        .child(div().text_size(px(10.0)).text_color(rgb(0xadb5c0)).child(label))
}

impl Render for FeatureExplorer {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let selected_category_title = self
            .active_category
            .map(|index| CATEGORIES[index].title)
            .unwrap_or("All features");
        div()
            .size_full()
            .flex()
            .flex_col()
            .bg(rgb(BG))
            .text_color(rgb(TEXT))
            .child(self.header())
            .child(
                div()
                    .flex_1()
                    .flex()
                    .overflow_hidden()
                    .child(self.sidebar(cx))
                    .child(
                        div()
                            .flex_1()
                            .min_w(px(0.0))
                            .h_full()
                            .flex()
                            .flex_col()
                            .overflow_hidden()
                            .child(
                                div()
                                    .flex()
                                    .items_center()
                                    .justify_between()
                                    .h(px(45.0))
                                    .px_5()
                                    .border_b_1()
                                    .border_color(rgb(BORDER))
                                    .bg(rgb(0x0f1218))
                                    .child(
                                        div()
                                            .flex()
                                            .items_center()
                                            .gap_2()
                                            .child(div().text_size(px(10.0)).text_color(rgb(0x737b89)).child("LIBRARY"))
                                            .child(div().text_size(px(10.0)).text_color(rgb(0x4f5661)).child("/"))
                                            .child(div().text_size(px(11.0)).font_weight(FontWeight::MEDIUM).text_color(rgb(0xcbd0d9)).child(selected_category_title)),
                                    )
                                    .child(
                                        div()
                                            .flex()
                                            .items_center()
                                            .gap_2()
                                            .child(div().size(px(6.0)).rounded_full().bg(rgb(GREEN)))
                                            .child(div().text_size(px(10.0)).text_color(rgb(0x9098a5)).child("CONTENT AVAILABLE OFFLINE")),
                                    ),
                            )
                            .child(
                                div()
                                    .id("page-content")
                                    .flex_1()
                                    .overflow_y_scroll()
                                    .track_scroll(&self.content_scroll)
                                    .px_5()
                                    .py_5()
                                    .flex()
                                    .flex_col()
                                    .gap_6()
                                    .child(self.hero(cx))
                                    .child(
                                        div()
                                            .flex()
                                            .items_end()
                                            .justify_between()
                                            .gap_4()
                                            .child(
                                                div()
                                                    .flex()
                                                    .flex_col()
                                                    .gap_1()
                                                    .child(
                                                        div()
                                                            .text_size(px(20.0))
                                                            .font_weight(FontWeight::SEMIBOLD)
                                                            .text_color(rgb(TEXT))
                                                            .child(if self.active_category.is_some() { "Explore this feature group" } else { "Everything in one place" }),
                                                    )
                                                    .child(
                                                        div()
                                                            .text_size(px(11.0))
                                                            .text_color(rgb(MUTED))
                                                            .child("Choose a capability to open its details in the inspector."),
                                                    ),
                                            )
                                            .child(
                                                div()
                                                    .text_size(px(10.0))
                                                    .text_color(rgb(0x929baa))
                                                    .child(format!("{} groups · {} capabilities", CATEGORIES.len(), Self::total_features())),
                                            ),
                                    )
                                    .child(self.feature_sections(cx))
                                    .child(
                                        div()
                                            .flex()
                                            .items_center()
                                            .justify_between()
                                            .border_t_1()
                                            .border_color(rgb(BORDER))
                                            .pt_4()
                                            .child(div().text_size(px(10.0)).text_color(rgb(0x78818f)).child("Lumary · professional capture, on your terms"))
                                            .child(div().text_size(px(10.0)).text_color(rgb(0x78818f)).child("Feature guide for Linux desktop")),
                                    ),
                            ),
                    )
                    .child(self.detail_panel(cx)),
            )
    }
}

fn main() {
    application().run(|cx: &mut App| {
        let bounds = Bounds::centered(None, size(px(1280.0), px(800.0)), cx);
        cx.open_window(
            WindowOptions {
                window_bounds: Some(WindowBounds::Windowed(bounds)),
                ..Default::default()
            },
            |_, cx| cx.new(|_| FeatureExplorer::new()),
        )
        .expect("open Lumary feature explorer window");
        cx.activate(true);
    });
}
