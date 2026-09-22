import { type ReactNode, useCallback, useMemo, useState, useId } from "react";

import { academyForms } from "@rawkodeacademy/design-system";

const s = academyForms();
type ResourceTone = "cpu" | "memory" | "io";

type CgroupVersion = "v1" | "v2";

interface SliderConfig {
	label: string;
	v1Label: string;
	v2Label: string;
	min: number;
	max: number;
	step: number;
	tone: ResourceTone;
	unit: string;
	formatValue: (value: number) => string;
	formatRaw: (value: number, version: CgroupVersion) => string;
}

const SLIDER_CONFIGS = {
	cpu: {
		label: "CPU",
		v1Label: "cpu.cfs_quota_us",
		v2Label: "cpu.max",
		min: 5,
		max: 100,
		step: 5,
		tone: "cpu",
		unit: "%",
		formatValue: (v) => `${v}% of one CPU core`,
		formatRaw: (v, ver) => {
			const quota = Math.round((v / 100) * 100000);
			return ver === "v2" ? `${quota} 100000` : `${quota}`;
		},
	},
	memory: {
		label: "Memory",
		v1Label: "memory.limit_in_bytes",
		v2Label: "memory.max",
		min: 0,
		max: 1024,
		step: 32,
		tone: "memory",
		unit: "MiB",
		formatValue: (v) => `${v} MiB`,
		formatRaw: (v) => {
			const bytes = v * 1024 * 1024;
			return `${bytes}`;
		},
	},
	io: {
		label: "IO",
		v1Label: "blkio.throttle.read_iops_device",
		v2Label: "io.max",
		min: 0,
		max: 10000,
		step: 100,
		tone: "io",
		unit: "IOPS",
		formatValue: (v) => `${v.toLocaleString()} read IOPS`,
		formatRaw: (v) => `${v}`,
	},
} satisfies Record<string, SliderConfig>;

function Slider({
	config,
	value,
	version,
	onChange,
}: {
	config: SliderConfig;
	value: number;
	version: CgroupVersion;
	onChange: (value: number) => void;
}) {
	const id = useId();
	const styles = academyForms({ resourceTone: config.tone });
	const fileLabel = version === "v2" ? config.v2Label : config.v1Label;

	return (
		<div className={s.sliderGroup}>
			<div className={s.sliderMeta}>
				<label htmlFor={id} className={styles.mono}>
					{config.label}: {fileLabel}
				</label>
				<span className={s.muted}>{config.formatRaw(value, version)}</span>
			</div>
			<input
				id={id}
				type="range"
				min={config.min}
				max={config.max}
				step={config.step}
				value={value}
				aria-valuetext={config.formatValue(value)}
				onChange={(e) => onChange(Number(e.target.value))}
				className={styles.range}
			/>
			<div className={s.sliderMeta}>
				<output htmlFor={id} className={s.copy} aria-live="off">
					{config.formatValue(value)}
				</output>
				<span className={s.muted}>
					{config.min}
					{config.unit} — {config.max.toLocaleString()}
					{config.unit}
				</span>
			</div>
		</div>
	);
}

function TerminalLine({
	command,
	output,
	outputTone,
}: {
	command?: string;
	output?: string;
	outputTone?: ResourceTone;
}) {
	if (command) {
		return (
			<div className={s.terminalLine}>
				<span className={s.muted} aria-hidden="true">
					${" "}
				</span>
				<span className={s.command}>{command}</span>
			</div>
		);
	}

	return (
		<div
			className={
				academyForms({ resourceTone: outputTone ?? "default" }).terminalLine
			}
		>
			{output}
		</div>
	);
}

function TerminalBlock({ children }: { children: ReactNode }) {
	return <div className={s.terminalBlock}>{children}</div>;
}

export default function ResourceSimulator() {
	const [version, setVersion] = useState<CgroupVersion>("v2");
	const [cpu, setCpu] = useState(50);
	const [memory, setMemory] = useState(256);
	const [io, setIo] = useState(1000);

	const handleCpuChange = useCallback((v: number) => setCpu(v), []);
	const handleMemoryChange = useCallback((v: number) => setMemory(v), []);
	const handleIoChange = useCallback((v: number) => setIo(v), []);

	const terminalOutput = useMemo(() => {
		const cpuQuota = Math.round((cpu / 100) * 100000);
		const memoryBytes = memory * 1024 * 1024;
		const memoryCurrentBytes = Math.round(memoryBytes * 0.47);

		if (version === "v2") {
			return (
				<>
					<TerminalBlock>
						<TerminalLine command="cat cpu.max" />
						<TerminalLine output={`${cpuQuota} 100000`} outputTone="cpu" />
					</TerminalBlock>

					<TerminalBlock>
						<TerminalLine command="cat memory.max" />
						<TerminalLine output={`${memoryBytes}`} outputTone="memory" />
					</TerminalBlock>

					<TerminalBlock>
						<TerminalLine command="cat memory.current" />
						<TerminalLine
							output={`${memoryCurrentBytes}`}
							outputTone="memory"
						/>
					</TerminalBlock>

					<TerminalBlock>
						<TerminalLine command="cat io.max" />
						<TerminalLine
							output={`8:0 riops=${io} wiops=max rbps=max wbps=max`}
							outputTone="io"
						/>
					</TerminalBlock>
				</>
			);
		}

		return (
			<>
				<TerminalBlock>
					<TerminalLine command="cat cpu.cfs_quota_us" />
					<TerminalLine output={`${cpuQuota}`} outputTone="cpu" />
				</TerminalBlock>

				<TerminalBlock>
					<TerminalLine command="cat cpu.cfs_period_us" />
					<TerminalLine output="100000" outputTone="cpu" />
				</TerminalBlock>

				<TerminalBlock>
					<TerminalLine command="cat memory.limit_in_bytes" />
					<TerminalLine output={`${memoryBytes}`} outputTone="memory" />
				</TerminalBlock>

				<TerminalBlock>
					<TerminalLine command="cat memory.usage_in_bytes" />
					<TerminalLine output={`${memoryCurrentBytes}`} outputTone="memory" />
				</TerminalBlock>

				<TerminalBlock>
					<TerminalLine command="cat blkio.throttle.read_iops_device" />
					<TerminalLine output={`8:0 ${io}`} outputTone="io" />
				</TerminalBlock>
			</>
		);
	}, [version, cpu, memory, io]);

	return (
		<div className={[s.root, s.simulator].join(" ")}>
			{/* Version Toggle */}
			<div className={s.toolbar} role="group" aria-label="Cgroup version">
				<span className={s.kicker}>cgroup</span>
				<button
					type="button"
					onClick={() => setVersion("v1")}
					aria-pressed={version === "v1"}
					className={s.toggle}
				>
					v1
				</button>
				<button
					type="button"
					onClick={() => setVersion("v2")}
					aria-pressed={version === "v2"}
					className={s.toggle}
				>
					v2
				</button>
			</div>

			{/* Two-panel layout */}
			<div className={s.simulatorGrid}>
				{/* Left Panel: Controls */}
				<div className={s.controls}>
					<Slider
						config={SLIDER_CONFIGS.cpu}
						value={cpu}
						version={version}
						onChange={handleCpuChange}
					/>
					<Slider
						config={SLIDER_CONFIGS.memory}
						value={memory}
						version={version}
						onChange={handleMemoryChange}
					/>
					<Slider
						config={SLIDER_CONFIGS.io}
						value={io}
						version={version}
						onChange={handleIoChange}
					/>
				</div>

				{/* Right Panel: Terminal Output */}
				<div
					className={s.terminal}
					role="region"
					aria-label="Simulated cgroup files"
				>
					<div className={s.terminalLine}>{terminalOutput}</div>
				</div>
			</div>
		</div>
	);
}
