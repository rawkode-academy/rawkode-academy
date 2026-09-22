import { useId } from "react";
import { academyCgroups } from "@rawkodeacademy/design-system";

type NodeType = "root" | "slice" | "leaf";
const styles = academyCgroups();

const typeTone = { root: "neutral", slice: "sky", leaf: "amber" } as const;

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
	const nodeStyles = academyCgroups({ tone: typeTone[type] });
	return (
		<g className={nodeStyles.diagramNode} transform={`translate(${x}, ${y})`}>
			<rect
				x={0}
				y={0}
				width={170}
				height={44}
				rx={8}
				className={styles.diagramBox}
				strokeOpacity={0.75}
				strokeWidth={1.5}
			/>
			<text x={85} y={28} textAnchor="middle" className={styles.diagramLabel}>
				{label}
			</text>
		</g>
	);
}

interface LegendItemProps {
	type: NodeType;
	label: string;
}

function LegendItem({ type, label }: LegendItemProps) {
	return (
		<div className={styles.diagramLegendItem}>
			<span
				className={academyCgroups({ tone: typeTone[type] }).diagramSwatch}
				aria-hidden="true"
			/>
			<span>{label}</span>
		</div>
	);
}

function CgroupTreeDiagram() {
	const titleId = useId();
	return (
		<div className={`${styles.root} ${styles.diagram}`}>
			{/* Header */}
			<div className={styles.diagramHeader}>
				<div>
					<h3>A typical cgroup tree</h3>
					<p>
						How systemd lays out cgroups on a modern Linux host. Limits set on
						any node cascade to every descendant.
					</p>
				</div>

				{/* Legend */}
				<div className={styles.diagramLegend}>
					{(Object.keys(typeTone) as NodeType[]).map((t) => (
						<LegendItem key={t} type={t} label={typeLabels[t]} />
					))}
				</div>
			</div>

			{/* SVG */}
			<div className={styles.diagramFrame}>
				<svg
					viewBox="0 0 780 420"
					className={styles.diagramSvg}
					role="img"
					aria-labelledby={titleId}
				>
					<title id={titleId}>
						cgroup hierarchy: /sys/fs/cgroup/ branches into system.slice and
						user.slice. system.slice contains nginx.service and
						postgres.service. user.slice contains user-1000.slice which contains
						session-2.scope.
					</title>

					{/* Connectors (drawn first so they sit behind the nodes) */}
					<g className={styles.diagramConnectors} fill="none" strokeWidth={1.5}>
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
