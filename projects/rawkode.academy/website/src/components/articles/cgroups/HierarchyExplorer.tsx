import { useCallback, useMemo, useState } from "react";

type Tab = "v1" | "v2";

interface TreeNode {
	name: string;
	isProcess?: boolean;
	detail?: string;
	controllers?: string[];
	children?: TreeNode[];
}

const controllerColors: Record<string, { bg: string; text: string }> = {
	cpu: { bg: "bg-red-500/20", text: "text-red-400" },
	memory: { bg: "bg-amber-500/20", text: "text-amber-400" },
	io: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
	pids: { bg: "bg-purple-500/20", text: "text-purple-400" },
	cpuset: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
};

const v1Trees: { root: string; color: string; borderColor: string; glowColor: string; nodes: TreeNode[] }[] = [
	{
		root: "/sys/fs/cgroup/cpu/",
		color: "text-red-400",
		borderColor: "border-red-500/30",
		glowColor: "shadow-red-500/10",
		nodes: [
			{
				name: "docker/",
				children: [
					{ name: "nginx", isProcess: true, detail: "shares: 512" },
					{ name: "redis", isProcess: true, detail: "shares: 1024" },
				],
			},
			{
				name: "system.slice/",
				children: [{ name: "sshd.service" }],
			},
		],
	},
	{
		root: "/sys/fs/cgroup/memory/",
		color: "text-amber-400",
		borderColor: "border-amber-500/30",
		glowColor: "shadow-amber-500/10",
		nodes: [
			{
				name: "docker/",
				children: [
					{ name: "nginx", isProcess: true, detail: "limit: 256M" },
					{ name: "redis", isProcess: true, detail: "limit: 512M" },
				],
			},
			{
				name: "system.slice/",
				children: [{ name: "sshd.service" }],
			},
		],
	},
	{
		root: "/sys/fs/cgroup/blkio/",
		color: "text-emerald-400",
		borderColor: "border-emerald-500/30",
		glowColor: "shadow-emerald-500/10",
		nodes: [
			{
				name: "docker/",
				children: [
					{ name: "nginx", isProcess: true, detail: "weight: 100" },
					{ name: "redis", isProcess: true, detail: "weight: 500" },
				],
			},
			{
				name: "system.slice/",
				children: [{ name: "sshd.service" }],
			},
		],
	},
];

const v2Tree: TreeNode[] = [
	{
		name: "system.slice/",
		controllers: ["cpu", "memory", "io", "pids"],
		children: [{ name: "sshd.service" }],
	},
	{
		name: "kubepods.slice/",
		controllers: ["cpu", "memory", "io", "pids", "cpuset"],
		children: [
			{ name: "nginx", isProcess: true, controllers: ["cpu", "memory", "io"] },
			{ name: "redis", isProcess: true, controllers: ["cpu", "memory", "io"] },
		],
	},
	{
		name: "user.slice/",
		controllers: ["cpu", "memory", "io", "pids"],
		children: [{ name: "session-2.scope" }],
	},
];

function ControllerBadge({ name }: { name: string }) {
	const colors = controllerColors[name] ?? { bg: "bg-slate-500/20", text: "text-slate-400" };
	return (
		<span
			className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${colors.bg} ${colors.text}`}
		>
			{name}
		</span>
	);
}

function TreeNodeRow({
	node,
	depth,
	isLast,
	parentLines,
	expandedKeys,
	toggleExpand,
	pathPrefix,
	accentColor,
}: {
	node: TreeNode;
	depth: number;
	isLast: boolean;
	parentLines: boolean[];
	expandedKeys: Set<string>;
	toggleExpand: (key: string) => void;
	pathPrefix: string;
	accentColor?: string;
}) {
	const nodeKey = `${pathPrefix}/${node.name}`;
	const hasChildren = node.children && node.children.length > 0;
	const isExpanded = expandedKeys.has(nodeKey);
	const isDir = node.name.endsWith("/") || hasChildren;

	return (
		<>
			<div className="flex items-center group h-7">
				{/* Tree connector lines */}
				{parentLines.map((showLine, idx) => (
					<span
						key={`line-${depth}-${idx}`}
						className="inline-block w-5 h-7 flex-shrink-0"
						style={{
							borderLeft: showLine ? "1px solid rgba(148, 163, 184, 0.2)" : "none",
						}}
					/>
				))}
				{depth > 0 && (
					<span
						className="inline-flex items-center w-5 h-7 flex-shrink-0"
						style={{
							borderLeft: "1px solid rgba(148, 163, 184, 0.2)",
							borderBottom: "1px solid rgba(148, 163, 184, 0.2)",
							borderBottomLeftRadius: isLast ? "4px" : "0",
							height: isLast ? "14px" : "28px",
							alignSelf: isLast ? "flex-start" : "stretch",
							marginTop: isLast ? "0" : "0",
						}}
					/>
				)}

				{/* Expand/collapse toggle or leaf indicator */}
				{hasChildren ? (
					<button
						type="button"
						onClick={() => toggleExpand(nodeKey)}
						className="flex items-center justify-center w-4 h-4 flex-shrink-0 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors duration-150 mr-1"
						aria-label={isExpanded ? "Collapse" : "Expand"}
					>
						<svg
							width="10"
							height="10"
							viewBox="0 0 10 10"
							fill="none"
							className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
						>
							<path d="M3 1.5L7 5L3 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
					</button>
				) : (
					<span className="w-4 h-4 flex-shrink-0 mr-1 flex items-center justify-center">
						<span className="w-1 h-1 rounded-full bg-slate-600" />
					</span>
				)}

				{/* Node name */}
				{isDir ? (
					<button
						type="button"
						onClick={() => hasChildren && toggleExpand(nodeKey)}
						className={`font-mono text-sm ${accentColor ?? "text-slate-300"} hover:text-white transition-colors duration-150 cursor-pointer`}
					>
						{node.name}
					</button>
				) : (
					<span
						className={`font-mono text-sm ${
							node.isProcess ? "text-orange-400 font-semibold" : "text-slate-400"
						}`}
					>
						{node.name}
					</span>
				)}

				{/* Detail badge (v1 style) */}
				{node.detail && (
					<span className="ml-2 text-[11px] font-mono text-slate-500">
						[{node.detail}]
					</span>
				)}

				{/* Controller badges (v2 style) */}
				{node.controllers && node.controllers.length > 0 && (
					<span className="ml-2 flex gap-1 flex-wrap">
						{node.controllers.map((c) => (
							<ControllerBadge key={c} name={c} />
						))}
					</span>
				)}
			</div>

			{/* Children */}
			{hasChildren && isExpanded && (
				<div>
					{node.children!.map((child, i) => (
						<TreeNodeRow
							key={child.name}
							node={child}
							depth={depth + 1}
							isLast={i === node.children!.length - 1}
							parentLines={[...parentLines, !isLast]}
							expandedKeys={expandedKeys}
							toggleExpand={toggleExpand}
							pathPrefix={nodeKey}
							accentColor={accentColor}
						/>
					))}
				</div>
			)}
		</>
	);
}

function V1Tree({
	tree,
	expandedKeys,
	toggleExpand,
}: {
	tree: (typeof v1Trees)[number];
	expandedKeys: Set<string>;
	toggleExpand: (key: string) => void;
}) {
	return (
		<div
			className={`rounded-lg border ${tree.borderColor} bg-slate-900/80 p-3 shadow-lg ${tree.glowColor}`}
		>
			<div className={`font-mono text-xs font-bold ${tree.color} mb-2 pb-1.5 border-b border-slate-700/50`}>
				{tree.root}
			</div>
			<div>
				{tree.nodes.map((node, i) => (
					<TreeNodeRow
						key={node.name}
						node={node}
						depth={0}
						isLast={i === tree.nodes.length - 1}
						parentLines={[]}
						expandedKeys={expandedKeys}
						toggleExpand={toggleExpand}
						pathPrefix={tree.root}
						accentColor={tree.color}
					/>
				))}
			</div>
		</div>
	);
}

function StatBox({ label, value, variant }: { label: string; value: string; variant: "red" | "green" }) {
	const colors =
		variant === "red"
			? "border-red-500/20 bg-red-500/5 text-red-400"
			: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400";
	return (
		<div className={`rounded-lg border ${colors} px-4 py-2.5 text-center`}>
			<div className="text-lg font-bold font-mono">{value}</div>
			<div className="text-[11px] text-slate-400 mt-0.5">{label}</div>
		</div>
	);
}

function buildAllKeys(nodes: TreeNode[], prefix: string): string[] {
	const keys: string[] = [];
	for (const node of nodes) {
		const key = `${prefix}/${node.name}`;
		if (node.children && node.children.length > 0) {
			keys.push(key);
			keys.push(...buildAllKeys(node.children, key));
		}
	}
	return keys;
}

export default function HierarchyExplorer() {
	const [activeTab, setActiveTab] = useState<Tab>("v1");
	const [transitioning, setTransitioning] = useState(false);
	const [displayTab, setDisplayTab] = useState<Tab>("v1");

	const allExpandedKeys = useMemo(() => {
		const keys = new Set<string>();
		for (const tree of v1Trees) {
			for (const k of buildAllKeys(tree.nodes, tree.root)) {
				keys.add(k);
			}
		}
		const v2Root = "/sys/fs/cgroup/";
		for (const k of buildAllKeys(v2Tree, v2Root)) {
			keys.add(k);
		}
		return keys;
	}, []);

	const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set(allExpandedKeys));

	const toggleExpand = useCallback((key: string) => {
		setExpandedKeys((prev) => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	}, []);

	const switchTab = useCallback(
		(tab: Tab) => {
			if (tab === activeTab) return;
			setTransitioning(true);
			setTimeout(() => {
				setDisplayTab(tab);
				setActiveTab(tab);
				setTimeout(() => {
					setTransitioning(false);
				}, 30);
			}, 200);
		},
		[activeTab],
	);

	return (
		<div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shadow-xl my-8">
			{/* Tab bar */}
			<div className="flex border-b border-slate-800 bg-slate-900/50">
				<button
					type="button"
					onClick={() => switchTab("v1")}
					className={`relative flex-1 px-6 py-3 text-sm font-semibold transition-colors duration-200 ${
						activeTab === "v1"
							? "text-red-400"
							: "text-slate-500 hover:text-slate-300"
					}`}
				>
					cgroupsv1
					{activeTab === "v1" && (
						<span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500 rounded-t" />
					)}
				</button>
				<button
					type="button"
					onClick={() => switchTab("v2")}
					className={`relative flex-1 px-6 py-3 text-sm font-semibold transition-colors duration-200 ${
						activeTab === "v2"
							? "text-emerald-400"
							: "text-slate-500 hover:text-slate-300"
					}`}
				>
					cgroupsv2
					{activeTab === "v2" && (
						<span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t" />
					)}
				</button>
			</div>

			{/* Content area with fade transition */}
			<div className="p-4 md:p-6">
				<div
					className={`transition-opacity duration-200 ${
						transitioning ? "opacity-0" : "opacity-100"
					}`}
				>
					{displayTab === "v1" ? (
						<V1Content expandedKeys={expandedKeys} toggleExpand={toggleExpand} />
					) : (
						<V2Content expandedKeys={expandedKeys} toggleExpand={toggleExpand} />
					)}
				</div>
			</div>
		</div>
	);
}

function V1Content({
	expandedKeys,
	toggleExpand,
}: {
	expandedKeys: Set<string>;
	toggleExpand: (key: string) => void;
}) {
	return (
		<>
			{/* Section label */}
			<div className="flex items-center gap-2 mb-4">
				<span className="text-xs font-bold tracking-widest text-red-400/70 uppercase">
					The Fragmented Hierarchy
				</span>
				<span className="flex-1 h-px bg-slate-800" />
			</div>

			{/* Three trees side by side */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
				{v1Trees.map((tree) => (
					<V1Tree
						key={tree.root}
						tree={tree}
						expandedKeys={expandedKeys}
						toggleExpand={toggleExpand}
					/>
				))}
			</div>

			{/* Problem callout */}
			<div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
				<div className="flex gap-2 items-start">
					<svg
						width="18"
						height="18"
						viewBox="0 0 20 20"
						fill="none"
						className="text-red-400 flex-shrink-0 mt-0.5"
					>
						<path
							d="M10 2L18 17H2L10 2Z"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinejoin="round"
						/>
						<path d="M10 8V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
						<circle cx="10" cy="14" r="0.75" fill="currentColor" />
					</svg>
					<div>
						<div className="text-sm font-semibold text-red-400 mb-1">The Problem</div>
						<div className="text-xs text-slate-400 leading-relaxed">
							<span className="text-orange-400 font-semibold">nginx</span> and{" "}
							<span className="text-orange-400 font-semibold">redis</span> appear in 3
							separate trees. No unified view. No atomic moves. No combined resource
							accounting.
						</div>
					</div>
				</div>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-3 gap-3 mt-4">
				<StatBox label="Controllers" value="12+" variant="red" />
				<StatBox label="Mount Points" value="12+" variant="red" />
				<StatBox label="Hierarchy Sync" value="Manual" variant="red" />
			</div>
		</>
	);
}

function V2Content({
	expandedKeys,
	toggleExpand,
}: {
	expandedKeys: Set<string>;
	toggleExpand: (key: string) => void;
}) {
	const v2Root = "/sys/fs/cgroup/";

	return (
		<>
			{/* Section label */}
			<div className="flex items-center gap-2 mb-4">
				<span className="text-xs font-bold tracking-widest text-emerald-400/70 uppercase">
					The Unified Hierarchy
				</span>
				<span className="flex-1 h-px bg-slate-800" />
			</div>

			{/* Single unified tree */}
			<div className="rounded-lg border border-emerald-500/30 bg-slate-900/80 p-3 shadow-lg shadow-emerald-500/10">
				<div className="font-mono text-xs font-bold text-emerald-400 mb-2 pb-1.5 border-b border-slate-700/50">
					{v2Root}
				</div>
				<div>
					{v2Tree.map((node, i) => (
						<TreeNodeRow
							key={node.name}
							node={node}
							depth={0}
							isLast={i === v2Tree.length - 1}
							parentLines={[]}
							expandedKeys={expandedKeys}
							toggleExpand={toggleExpand}
							pathPrefix={v2Root}
							accentColor="text-emerald-400"
						/>
					))}
				</div>
			</div>

			{/* Solution callout */}
			<div className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
				<div className="flex gap-2 items-start">
					<svg
						width="18"
						height="18"
						viewBox="0 0 20 20"
						fill="none"
						className="text-emerald-400 flex-shrink-0 mt-0.5"
					>
						<circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
						<path d="M6.5 10L9 12.5L13.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
					<div>
						<div className="text-sm font-semibold text-emerald-400 mb-1">The Solution</div>
						<div className="text-xs text-slate-400 leading-relaxed">
							One tree. All controllers. Unified resource accounting per process.
						</div>
					</div>
				</div>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-3 gap-3 mt-4">
				<StatBox label="Hierarchy" value="1" variant="green" />
				<StatBox label="Mount Point" value="1" variant="green" />
				<StatBox label="Sync" value="Automatic" variant="green" />
			</div>
		</>
	);
}
