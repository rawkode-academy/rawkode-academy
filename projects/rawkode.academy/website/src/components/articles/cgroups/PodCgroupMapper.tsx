import { useState, useCallback, useEffect, useMemo, useRef } from "react";

type QoSClass = "guaranteed" | "burstable" | "besteffort";

interface QoSConfig {
	label: string;
	color: string;
	colorDim: string;
	borderColor: string;
	bgActive: string;
	bgHover: string;
	yaml: YamlLine[];
	terminal: TerminalLine[];
	annotation: string;
}

interface YamlLine {
	indent: number;
	key?: string;
	value?: string;
	comment?: string;
	blank?: boolean;
}

interface TerminalLine {
	text: string;
	type: "comment" | "path" | "path-highlight" | "value" | "blank";
}

const qosConfigs: Record<QoSClass, QoSConfig> = {
	guaranteed: {
		label: "Guaranteed",
		color: "#10b981",
		colorDim: "rgba(16, 185, 129, 0.15)",
		borderColor: "rgba(16, 185, 129, 0.3)",
		bgActive: "rgba(16, 185, 129, 0.9)",
		bgHover: "rgba(16, 185, 129, 0.08)",
		yaml: [
			{ indent: 0, key: "resources", value: "" },
			{ indent: 1, key: "requests", value: "" },
			{ indent: 2, key: "cpu", value: '"500m"' },
			{ indent: 2, key: "memory", value: '"256Mi"' },
			{ indent: 1, key: "limits", value: "" },
			{ indent: 2, key: "cpu", value: '"500m"' },
			{ indent: 2, key: "memory", value: '"256Mi"' },
		],
		terminal: [
			{ text: "# cgroup path (systemd driver):", type: "comment" },
			{ text: "/kubepods.slice/", type: "path" },
			{ text: "  kubepods-pod<uid>.slice/", type: "path" },
			{ text: "    cri-containerd-<id>.scope", type: "path" },
			{ text: "", type: "blank" },
			{ text: "# cpu.max", type: "comment" },
			{ text: "50000 100000          # 500m = 50% of 1 core", type: "value" },
			{ text: "", type: "blank" },
			{ text: "# memory.max", type: "comment" },
			{ text: "268435456             # 256Mi", type: "value" },
			{ text: "", type: "blank" },
			{ text: "# memory.min (only when MemoryQoS alpha gate is on)", type: "comment" },
			{
				text: "268435456             # 256Mi (protected, requests == limits)",
				type: "value",
			},
			{ text: "", type: "blank" },
			{ text: "# OOM score adjustment: -997", type: "comment" },
			{ text: "# QoS: Guaranteed (requests == limits)", type: "comment" },
		],
		annotation:
			"OOM score adjustment of -997 makes Guaranteed pods the last targets for the kernel OOM killer. memory.min is only written per-pod when the alpha MemoryQoS feature gate is enabled; with the default kubelet, requests influence scheduling and eviction but do not set memory.min on individual pod cgroups.",
	},
	burstable: {
		label: "Burstable",
		color: "#f59e0b",
		colorDim: "rgba(245, 158, 11, 0.15)",
		borderColor: "rgba(245, 158, 11, 0.3)",
		bgActive: "rgba(245, 158, 11, 0.9)",
		bgHover: "rgba(245, 158, 11, 0.08)",
		yaml: [
			{ indent: 0, key: "resources", value: "" },
			{ indent: 1, key: "requests", value: "" },
			{ indent: 2, key: "cpu", value: '"250m"' },
			{ indent: 2, key: "memory", value: '"128Mi"' },
			{ indent: 1, key: "limits", value: "" },
			{ indent: 2, key: "cpu", value: '"1000m"' },
			{ indent: 2, key: "memory", value: '"512Mi"' },
		],
		terminal: [
			{ text: "# cgroup path (systemd driver):", type: "comment" },
			{ text: "/kubepods.slice/", type: "path" },
			{ text: "  kubepods-burstable.slice/", type: "path-highlight" },
			{
				text: "    kubepods-burstable-pod<uid>.slice/",
				type: "path-highlight",
			},
			{ text: "      cri-containerd-<id>.scope", type: "path" },
			{ text: "", type: "blank" },
			{ text: "# cpu.max", type: "comment" },
			{
				text: "100000 100000         # 1000m = 100% of 1 core",
				type: "value",
			},
			{ text: "", type: "blank" },
			{ text: "# memory.max", type: "comment" },
			{ text: "536870912             # 512Mi", type: "value" },
			{ text: "", type: "blank" },
			{ text: "# memory.low (only when MemoryQoS alpha gate is on, K8s 1.36+)", type: "comment" },
			{
				text: "134217728             # 128Mi (best-effort protection)",
				type: "value",
			},
			{ text: "", type: "blank" },
			{
				text: "# OOM score adj: ~999 (scaled by memory request ratio)",
				type: "comment",
			},
			{ text: "# QoS: Burstable (requests < limits)", type: "comment" },
		],
		annotation:
			"OOM score is scaled by the memory request ratio. Under the alpha MemoryQoS gate with tiered reservation (K8s 1.36+), Burstable requests map to memory.low; without the gate, the per-pod cgroup gets no memory.low set.",
	},
	besteffort: {
		label: "BestEffort",
		color: "#ef4444",
		colorDim: "rgba(239, 68, 68, 0.15)",
		borderColor: "rgba(239, 68, 68, 0.3)",
		bgActive: "rgba(239, 68, 68, 0.9)",
		bgHover: "rgba(239, 68, 68, 0.08)",
		yaml: [
			{ indent: 0, comment: "# No resources section" },
			{ indent: 0, key: "containers", value: "" },
			{ indent: 1, key: "- name", value: "worker" },
			{ indent: 2, key: "image", value: "myapp:latest" },
		],
		terminal: [
			{ text: "# cgroup path (systemd driver):", type: "comment" },
			{ text: "/kubepods.slice/", type: "path" },
			{ text: "  kubepods-besteffort.slice/", type: "path-highlight" },
			{
				text: "    kubepods-besteffort-pod<uid>.slice/",
				type: "path-highlight",
			},
			{ text: "      cri-containerd-<id>.scope", type: "path" },
			{ text: "", type: "blank" },
			{ text: "# cpu.max", type: "comment" },
			{ text: "max 100000            # No CPU limit", type: "value" },
			{ text: "", type: "blank" },
			{ text: "# memory.max", type: "comment" },
			{ text: "max                   # No memory limit", type: "value" },
			{ text: "", type: "blank" },
			{ text: "# memory.min / memory.low", type: "comment" },
			{ text: "0                     # No memory protection", type: "value" },
			{ text: "", type: "blank" },
			{ text: "# OOM score adjustment: 1000", type: "comment" },
			{
				text: "# QoS: BestEffort (no requests or limits)",
				type: "comment",
			},
			{
				text: "# First to be evicted under memory pressure",
				type: "comment",
			},
		],
		annotation:
			"OOM score adjustment of 1000 is the maximum possible value. BestEffort pods have no resource guarantees and are always the first to be killed when the node runs out of memory.",
	},
};

function YamlPanel({ lines }: { lines: YamlLine[] }) {
	return (
		<div
			style={{
				fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
				fontSize: "0.8125rem",
				lineHeight: "1.65",
			}}
		>
			{lines.map((line, i) => {
				const padding = line.indent * 16;

				if (line.blank) {
					return <div key={i} style={{ height: "1.65em" }} />;
				}

				if (line.comment) {
					return (
						<div key={i} style={{ paddingLeft: padding, color: "#6b7280" }}>
							{line.comment}
						</div>
					);
				}

				const hasValue = line.value !== undefined && line.value !== "";

				return (
					<div key={i} style={{ paddingLeft: padding }}>
						<span style={{ color: "#a78bfa" }}>{line.key}</span>
						<span style={{ color: "#9ca3af" }}>:</span>
						{hasValue && (
							<>
								<span> </span>
								<span style={{ color: "#34d399" }}>{line.value}</span>
							</>
						)}
					</div>
				);
			})}
		</div>
	);
}

function TerminalPanel({
	lines,
	themeColor,
}: { lines: TerminalLine[]; themeColor: string }) {
	return (
		<div
			style={{
				fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
				fontSize: "0.8125rem",
				lineHeight: "1.65",
			}}
		>
			{lines.map((line, i) => {
				if (line.type === "blank") {
					return <div key={i} style={{ height: "1.65em" }} />;
				}

				if (line.type === "comment") {
					return (
						<div key={i} style={{ color: "#6b7280" }}>
							{line.text}
						</div>
					);
				}

				if (line.type === "path-highlight") {
					return (
						<div key={i}>
							<span style={{ color: themeColor, fontWeight: 600 }}>
								{line.text}
							</span>
						</div>
					);
				}

				if (line.type === "path") {
					return (
						<div key={i} style={{ color: "#94a3b8" }}>
							{line.text}
						</div>
					);
				}

				// value type: split at inline comment
				const commentIdx = line.text.indexOf("#");
				if (commentIdx > 0) {
					const val = line.text.slice(0, commentIdx);
					const comment = line.text.slice(commentIdx);
					return (
						<div key={i}>
							<span style={{ color: "#e2e8f0" }}>{val}</span>
							<span style={{ color: "#6b7280" }}>{comment}</span>
						</div>
					);
				}

				return (
					<div key={i} style={{ color: "#e2e8f0" }}>
						{line.text}
					</div>
				);
			})}
		</div>
	);
}

function ArrowSeparator({ color }: { color: string }) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				flexShrink: 0,
			}}
		>
			{/* Vertical arrow on small screens, horizontal on larger */}
			<svg
				width="32"
				height="32"
				viewBox="0 0 32 32"
				fill="none"
				className="hidden md:block"
				aria-hidden="true"
			>
				<path
					d="M6 16h16m0 0l-5-5m5 5l-5 5"
					stroke={color}
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
			<svg
				width="32"
				height="32"
				viewBox="0 0 32 32"
				fill="none"
				className="block md:hidden"
				aria-hidden="true"
			>
				<path
					d="M16 6v16m0 0l-5-5m5 5l5-5"
					stroke={color}
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</div>
	);
}

export default function PodCgroupMapper() {
	const [activeClass, setActiveClass] = useState<QoSClass>("guaranteed");
	const [transitioning, setTransitioning] = useState(false);

	const config = useMemo(() => qosConfigs[activeClass], [activeClass]);

	const switchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => { if (switchTimeoutRef.current) clearTimeout(switchTimeoutRef.current); };
	}, []);

	const handleSwitch = useCallback(
		(qos: QoSClass) => {
			if (qos === activeClass) return;
			if (switchTimeoutRef.current) clearTimeout(switchTimeoutRef.current);
			setTransitioning(true);
			switchTimeoutRef.current = setTimeout(() => {
				setActiveClass(qos);
				setTransitioning(false);
			}, 150);
		},
		[activeClass],
	);

	const classes: QoSClass[] = ["guaranteed", "burstable", "besteffort"];

	return (
		<div
			style={{
				background: "#0f172a",
				borderRadius: "0.75rem",
				border: `1px solid ${config.borderColor}`,
				overflow: "hidden",
				transition: "border-color 300ms ease",
			}}
		>
			{/* QoS toggle buttons */}
			<div
				style={{
					display: "flex",
					gap: "0.5rem",
					padding: "1rem 1rem 0",
					flexWrap: "wrap",
				}}
			>
				{classes.map((qos) => {
					const c = qosConfigs[qos];
					const isActive = qos === activeClass;
					return (
						<button
							key={qos}
							type="button"
							onClick={() => handleSwitch(qos)}
							className="cgroup-qos-btn"
							style={{
								padding: "0.5rem 1rem",
								borderRadius: "0.5rem",
								border: `1px solid ${isActive ? c.color : "rgba(148, 163, 184, 0.2)"}`,
								background: isActive ? c.bgActive : "rgba(30, 41, 59, 0.6)",
								color: isActive ? "#fff" : "#94a3b8",
								fontWeight: isActive ? 600 : 400,
								fontSize: "0.8125rem",
								cursor: "pointer",
								transition: "all 200ms ease",
								fontFamily: "inherit",
							}}
							onMouseEnter={(e) => {
								if (!isActive) {
									e.currentTarget.style.background = c.bgHover;
									e.currentTarget.style.borderColor = `${c.color}80`;
									e.currentTarget.style.color = c.color;
								}
							}}
							onMouseLeave={(e) => {
								if (!isActive) {
									e.currentTarget.style.background = "rgba(30, 41, 59, 0.6)";
									e.currentTarget.style.borderColor =
										"rgba(148, 163, 184, 0.2)";
									e.currentTarget.style.color = "#94a3b8";
								}
							}}
						>
							{c.label}
						</button>
					);
				})}
			</div>

			{/* Two-panel layout */}
			<div
				style={{ padding: "1rem" }}
				className="flex flex-col md:flex-row"
			>
				{/* Left panel: Pod Spec */}
				<div
					className="flex-1 min-w-0"
					style={{
						opacity: transitioning ? 0 : 1,
						transform: transitioning
							? "translateY(4px)"
							: "translateY(0)",
						transition: "opacity 150ms ease, transform 150ms ease",
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							marginBottom: "0.75rem",
						}}
					>
						<span
							style={{
								fontSize: "0.6875rem",
								fontWeight: 600,
								textTransform: "uppercase",
								letterSpacing: "0.05em",
								color: "#64748b",
							}}
						>
							Pod Spec
						</span>
						<span
							style={{
								fontSize: "0.625rem",
								padding: "0.125rem 0.5rem",
								borderRadius: "9999px",
								background: config.colorDim,
								color: config.color,
								fontWeight: 500,
							}}
						>
							YAML
						</span>
					</div>
					<div
						style={{
							background: "#1e293b",
							borderRadius: "0.5rem",
							padding: "1rem",
							border: "1px solid rgba(148, 163, 184, 0.1)",
						}}
					>
						<YamlPanel lines={config.yaml} />
					</div>
				</div>

				{/* Arrow */}
				<div
					className="flex items-center justify-center py-2 px-0 md:py-0 md:px-2"
				>
					<ArrowSeparator color={config.color} />
				</div>

				{/* Right panel: Cgroup Mapping */}
				<div
					className="flex-1 min-w-0"
					style={{
						opacity: transitioning ? 0 : 1,
						transform: transitioning
							? "translateY(4px)"
							: "translateY(0)",
						transition: "opacity 150ms ease, transform 150ms ease",
						transitionDelay: "50ms",
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							marginBottom: "0.75rem",
						}}
					>
						<span
							style={{
								fontSize: "0.6875rem",
								fontWeight: 600,
								textTransform: "uppercase",
								letterSpacing: "0.05em",
								color: "#64748b",
							}}
						>
							Cgroup Mapping
						</span>
						<span
							style={{
								fontSize: "0.625rem",
								padding: "0.125rem 0.5rem",
								borderRadius: "9999px",
								background: "rgba(30, 41, 59, 0.8)",
								color: "#94a3b8",
								fontWeight: 500,
								border: "1px solid rgba(148, 163, 184, 0.15)",
							}}
						>
							cgroups v2
						</span>
					</div>
					<div
						style={{
							background: "#020617",
							borderRadius: "0.5rem",
							padding: "1rem",
							border: "1px solid rgba(148, 163, 184, 0.1)",
						}}
					>
						<TerminalPanel
							lines={config.terminal}
							themeColor={config.color}
						/>
					</div>
				</div>
			</div>

			{/* Annotation bar */}
			<div
				style={{
					padding: "0.75rem 1rem",
					borderTop: `1px solid ${config.borderColor}`,
					background: config.colorDim,
					opacity: transitioning ? 0 : 1,
					transition:
						"opacity 150ms ease, background 300ms ease, border-color 300ms ease",
				}}
			>
				<p
					style={{
						margin: 0,
						fontSize: "0.8125rem",
						lineHeight: 1.5,
						color: "#cbd5e1",
					}}
				>
					<span
						style={{
							fontWeight: 600,
							color: config.color,
							marginRight: "0.25rem",
						}}
					>
						{config.label}:
					</span>
					{config.annotation}
				</p>
			</div>

			<style>{`
				.cgroup-qos-btn:focus { outline: none; }
				.cgroup-qos-btn:focus-visible {
					outline: 2px solid rgba(148, 163, 184, 0.6);
					outline-offset: 2px;
				}
			`}</style>
		</div>
	);
}
