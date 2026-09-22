import { useState, useId } from "react";
import { academyCgroups } from "@rawkodeacademy/design-system";

type QoSClass = "guaranteed" | "burstable" | "besteffort";

interface QoSConfig {
	label: string;
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
			{
				text: "# memory.min (only when MemoryQoS alpha gate is on)",
				type: "comment",
			},
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
			{
				text: "# memory.low (only when MemoryQoS alpha gate is on, K8s 1.36+)",
				type: "comment",
			},
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

const s = academyCgroups();
const qosTones = {
	guaranteed: "spruce",
	burstable: "amber",
	besteffort: "rust",
} as const;

function YamlPanel({ lines }: { lines: YamlLine[] }) {
	return (
		<pre className={s.code} tabIndex={0} aria-label="Pod specification YAML">
			<code className={s.codeText}>
				{lines.map((line, index) => (
					<span key={index}>
						{line.blank ? (
							"\n"
						) : (
							<>
								{"  ".repeat(line.indent)}
								{line.comment ? (
									<span className={s.codeComment}>{line.comment}</span>
								) : (
									<>
										<span className={s.codeKey}>{line.key}</span>:
										{line.value !== undefined && line.value !== "" && (
											<>
												{" "}
												<span className={s.codeValue}>{line.value}</span>
											</>
										)}
									</>
								)}
								{"\n"}
							</>
						)}
					</span>
				))}
			</code>
		</pre>
	);
}

function TerminalPanel({ lines }: { lines: TerminalLine[] }) {
	return (
		<pre className={s.code} tabIndex={0} aria-label="cgroups v2 mapping">
			<code className={s.codeText}>
				{lines.map((line, index) => {
					const commentIndex = line.text.indexOf("#");
					return (
						<span key={index}>
							{line.type === "blank" ? null : line.type === "comment" ? (
								<span className={s.codeComment}>{line.text}</span>
							) : line.type === "path-highlight" ? (
								<span className={s.codeHighlight}>{line.text}</span>
							) : line.type === "value" && commentIndex > 0 ? (
								<>
									{line.text.slice(0, commentIndex)}
									<span className={s.codeComment}>
										{line.text.slice(commentIndex)}
									</span>
								</>
							) : (
								line.text
							)}
							{"\n"}
						</span>
					);
				})}
			</code>
		</pre>
	);
}

function ArrowSeparator() {
	return (
		<div className={s.arrow} aria-hidden="true">
			<svg
				width="32"
				height="32"
				viewBox="0 0 32 32"
				fill="none"
				className={s.horizontalArrow}
			>
				<path
					d="M6 16h16m0 0l-5-5m5 5l-5 5"
					stroke="currentColor"
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
				className={s.verticalArrow}
			>
				<path
					d="M16 6v16m0 0l-5-5m5 5l5-5"
					stroke="currentColor"
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
	const config = qosConfigs[activeClass];
	const styles = academyCgroups({ tone: qosTones[activeClass] });
	const panelId = useId();
	return (
		<section className={s.root} aria-label="Pod QoS to cgroup mapping">
			<div
				className={s.toolbar}
				role="group"
				aria-label="Pod quality of service"
			>
				{(["guaranteed", "burstable", "besteffort"] as const).map((qos) => (
					<button
						key={qos}
						type="button"
						className={s.button}
						onClick={() => setActiveClass(qos)}
						aria-pressed={qos === activeClass}
						aria-controls={panelId}
					>
						{qosConfigs[qos].label}
					</button>
				))}
			</div>
			<p className={s.hidden} role="status">
				Showing {config.label} pod mapping
			</p>
			<div id={panelId} className={s.mapper}>
				<section className={s.pane} aria-label="Pod specification">
					<div className={s.paneHeader}>
						<h3 className={s.heading}>Pod Spec</h3>
						<span className={styles.badge}>YAML</span>
					</div>
					<YamlPanel lines={config.yaml} />
				</section>
				<ArrowSeparator />
				<section className={s.pane} aria-label="Cgroup mapping">
					<div className={s.paneHeader}>
						<h3 className={s.heading}>Cgroup Mapping</h3>
						<span className={s.badge}>cgroups v2</span>
					</div>
					<TerminalPanel lines={config.terminal} />
				</section>
			</div>
			<p className={s.annotation}>
				<strong className={styles.accent}>{config.label}: </strong>
				{config.annotation}
			</p>
		</section>
	);
}
