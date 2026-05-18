type NodeType = "root" | "slice" | "leaf";

const typeAccent: Record<NodeType, string> = {
	root: "#94a3b8",
	slice: "#38bdf8",
	leaf: "#fbbf24",
};

const typeLabels: Record<NodeType, string> = {
	root: "root mount",
	slice: ".slice (organisational)",
	leaf: ".service / .scope (processes live here)",
};

interface TreeNodeProps {
	x: number;
	y: number;
	label: string;
	type: NodeType;
}

function TreeNode({ x, y, label, type }: TreeNodeProps) {
	const accent = typeAccent[type];
	return (
		<g transform={`translate(${x}, ${y})`}>
			<rect
				x={0}
				y={0}
				width={170}
				height={44}
				rx={8}
				fill="#1e293b"
				stroke={accent}
				strokeOpacity={0.75}
				strokeWidth={1.5}
			/>
			<text
				x={85}
				y={28}
				textAnchor="middle"
				fill="#e2e8f0"
				fontFamily='ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace'
				fontSize={13}
			>
				{label}
			</text>
		</g>
	);
}

interface LegendItemProps {
	color: string;
	label: string;
}

function LegendItem({ color, label }: LegendItemProps) {
	return (
		<div className="flex items-center gap-1.5">
			<span
				className="inline-block h-2.5 w-3 rounded-sm border"
				style={{ borderColor: color, opacity: 0.85 }}
			/>
			<span className="text-xs font-medium" style={{ color: "#94a3b8" }}>
				{label}
			</span>
		</div>
	);
}

function CgroupTreeDiagram() {
	return (
		<div
			className="not-prose my-8 overflow-hidden rounded-2xl"
			style={{ background: "#0f172a" }}
		>
			{/* Header */}
			<div className="flex flex-col gap-3 px-5 pt-5 pb-2 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:pt-6">
				<div>
					<h3
						className="m-0 text-lg font-semibold tracking-tight sm:text-xl"
						style={{ color: "#f1f5f9" }}
					>
						A typical cgroup tree
					</h3>
					<p
						className="m-0 mt-1 text-sm"
						style={{ color: "#94a3b8" }}
					>
						How systemd lays out cgroups on a modern Linux host. Limits set on
						any node cascade to every descendant.
					</p>
				</div>

				{/* Legend */}
				<div className="flex flex-col gap-1.5">
					{(Object.keys(typeAccent) as NodeType[]).map((t) => (
						<LegendItem
							key={t}
							color={typeAccent[t]}
							label={typeLabels[t]}
						/>
					))}
				</div>
			</div>

			{/* SVG */}
			<div className="px-5 pb-5 sm:px-6 sm:pb-6">
				<svg
					viewBox="0 0 780 420"
					className="block h-auto w-full"
					role="img"
					aria-labelledby="cgroup-tree-title"
				>
					<title id="cgroup-tree-title">
						cgroup hierarchy: /sys/fs/cgroup/ branches into system.slice and
						user.slice. system.slice contains nginx.service and
						postgres.service. user.slice contains user-1000.slice which
						contains session-2.scope.
					</title>

					{/* Connectors (drawn first so they sit behind the nodes) */}
					<g fill="none" stroke="#334155" strokeWidth={1.5}>
						{/* root -> system.slice */}
						<path d="M 390 64 V 90 H 205 V 116" />
						{/* root -> user.slice */}
						<path d="M 390 64 V 90 H 575 V 116" />
						{/* system.slice -> nginx.service */}
						<path d="M 205 160 V 190 H 105 V 220" />
						{/* system.slice -> postgres.service */}
						<path d="M 205 160 V 190 H 305 V 220" />
						{/* user.slice -> user-1000.slice */}
						<path d="M 575 160 V 220" />
						{/* user-1000.slice -> session-2.scope */}
						<path d="M 575 264 V 344" />
					</g>

					{/* Nodes */}
					<TreeNode x={305} y={20} label="/sys/fs/cgroup/" type="root" />
					<TreeNode x={120} y={116} label="system.slice/" type="slice" />
					<TreeNode x={490} y={116} label="user.slice/" type="slice" />
					<TreeNode x={20} y={220} label="nginx.service/" type="leaf" />
					<TreeNode x={220} y={220} label="postgres.service/" type="leaf" />
					<TreeNode x={490} y={220} label="user-1000.slice/" type="slice" />
					<TreeNode x={490} y={344} label="session-2.scope/" type="leaf" />
				</svg>
			</div>
		</div>
	);
}

export default CgroupTreeDiagram;
