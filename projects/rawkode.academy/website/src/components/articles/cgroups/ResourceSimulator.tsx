import { type ReactNode, useCallback, useMemo, useState } from "react";

type CgroupVersion = "v1" | "v2";

interface SliderConfig {
	label: string;
	v1Label: string;
	v2Label: string;
	min: number;
	max: number;
	step: number;
	color: string;
	colorClass: string;
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
		color: "#ef4444",
		colorClass: "text-red-400",
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
		color: "#f59e0b",
		colorClass: "text-amber-400",
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
		color: "#10b981",
		colorClass: "text-emerald-400",
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
	const percentage = ((value - config.min) / (config.max - config.min)) * 100;
	const fileLabel = version === "v2" ? config.v2Label : config.v1Label;

	return (
		<div className="mb-5 last:mb-0">
			<div className="flex items-center justify-between mb-1.5">
				<span
					className="text-xs font-mono font-semibold tracking-wide"
					style={{ color: config.color }}
				>
					{fileLabel}
				</span>
				<span className="text-xs text-slate-400 font-mono">
					{config.formatRaw(value, version)}
				</span>
			</div>

			<div className="relative">
				<input
					type="range"
					min={config.min}
					max={config.max}
					step={config.step}
					value={value}
					onChange={(e) => onChange(Number(e.target.value))}
					className="cgroup-sim-slider w-full h-2 appearance-none rounded-full cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:outline-slate-400/60 focus-visible:outline-offset-4"
					style={{
						background: `linear-gradient(to right, ${config.color} 0%, ${config.color} ${percentage}%, #334155 ${percentage}%, #334155 100%)`,
					}}
				/>
			</div>

			<div className="flex items-center justify-between mt-1.5">
				<span className="text-sm text-slate-300">
					{config.formatValue(value)}
				</span>
				<span className="text-xs text-slate-500">
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
	outputColor,
}: {
	command?: string;
	output?: string;
	outputColor?: string;
}) {
	if (command) {
		return (
			<div className="leading-relaxed">
				<span className="text-slate-500 select-none">$ </span>
				<span className="text-emerald-400">{command}</span>
			</div>
		);
	}

	return (
		<div className="leading-relaxed" style={{ color: outputColor }}>
			{output}
		</div>
	);
}

function TerminalBlock({ children }: { children: ReactNode }) {
	return <div className="mb-3 last:mb-0">{children}</div>;
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
						<TerminalLine output={`${cpuQuota} 100000`} outputColor="#ef4444" />
					</TerminalBlock>

					<TerminalBlock>
						<TerminalLine command="cat memory.max" />
						<TerminalLine output={`${memoryBytes}`} outputColor="#f59e0b" />
					</TerminalBlock>

					<TerminalBlock>
						<TerminalLine command="cat memory.current" />
						<TerminalLine
							output={`${memoryCurrentBytes}`}
							outputColor="#f59e0b"
						/>
					</TerminalBlock>

					<TerminalBlock>
						<TerminalLine command="cat io.max" />
						<TerminalLine
							output={`8:0 riops=${io} wiops=max rbps=max wbps=max`}
							outputColor="#10b981"
						/>
					</TerminalBlock>
				</>
			);
		}

		return (
			<>
				<TerminalBlock>
					<TerminalLine command="cat cpu.cfs_quota_us" />
					<TerminalLine output={`${cpuQuota}`} outputColor="#ef4444" />
				</TerminalBlock>

				<TerminalBlock>
					<TerminalLine command="cat cpu.cfs_period_us" />
					<TerminalLine output="100000" outputColor="#ef4444" />
				</TerminalBlock>

				<TerminalBlock>
					<TerminalLine command="cat memory.limit_in_bytes" />
					<TerminalLine output={`${memoryBytes}`} outputColor="#f59e0b" />
				</TerminalBlock>

				<TerminalBlock>
					<TerminalLine command="cat memory.usage_in_bytes" />
					<TerminalLine
						output={`${memoryCurrentBytes}`}
						outputColor="#f59e0b"
					/>
				</TerminalBlock>

				<TerminalBlock>
					<TerminalLine command="cat blkio.throttle.read_iops_device" />
					<TerminalLine output={`8:0 ${io}`} outputColor="#10b981" />
				</TerminalBlock>
			</>
		);
	}, [version, cpu, memory, io]);

	return (
		<div className="my-8 rounded-xl overflow-hidden border border-slate-700/60 bg-slate-900 shadow-xl">
			{/* Version Toggle */}
			<div className="flex items-center gap-2 px-5 py-3 bg-slate-800/80 border-b border-slate-700/60">
				<span className="text-xs text-slate-400 font-medium mr-2 uppercase tracking-wider">
					cgroup
				</span>
				<button
					type="button"
					onClick={() => setVersion("v1")}
					className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-all duration-150 ${
						version === "v1"
							? "bg-slate-600 text-white shadow-sm"
							: "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
					}`}
				>
					v1
				</button>
				<button
					type="button"
					onClick={() => setVersion("v2")}
					className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-all duration-150 ${
						version === "v2"
							? "bg-slate-600 text-white shadow-sm"
							: "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
					}`}
				>
					v2
				</button>
			</div>

			{/* Two-panel layout */}
			<div className="grid grid-cols-1 md:grid-cols-2">
				{/* Left Panel: Controls */}
				<div className="p-5 border-b md:border-b-0 md:border-r border-slate-700/60">
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
				<div className="bg-slate-950 p-5">
					<div className="font-mono text-sm leading-relaxed">
						{terminalOutput}
					</div>
				</div>
			</div>

			<style>{`
				.cgroup-sim-slider::-webkit-slider-thumb {
					-webkit-appearance: none;
					appearance: none;
					width: 16px;
					height: 16px;
					border-radius: 50%;
					background: white;
					border: 2px solid #475569;
					cursor: pointer;
					box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
					transition: border-color 0.15s, transform 0.15s;
				}
				.cgroup-sim-slider::-webkit-slider-thumb:hover {
					transform: scale(1.15);
					border-color: #94a3b8;
				}
				.cgroup-sim-slider::-moz-range-thumb {
					width: 16px;
					height: 16px;
					border-radius: 50%;
					background: white;
					border: 2px solid #475569;
					cursor: pointer;
					box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
					transition: border-color 0.15s, transform 0.15s;
				}
				.cgroup-sim-slider::-moz-range-thumb:hover {
					transform: scale(1.15);
					border-color: #94a3b8;
				}
			`}</style>
		</div>
	);
}
