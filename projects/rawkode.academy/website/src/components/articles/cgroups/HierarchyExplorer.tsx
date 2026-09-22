import { useCallback, useId, useMemo, useState } from "react";
import { academyCgroups } from "@rawkodeacademy/design-system";

type Tab = "v1" | "v2";
interface TreeNode {
	name: string;
	isProcess?: boolean;
	detail?: string;
	controllers?: string[];
	children?: TreeNode[];
}

const s = academyCgroups();
const controllerTones = new Map<
	string,
	"rust" | "amber" | "spruce" | "violet" | "sky"
>([
	["cpu", "rust"],
	["memory", "amber"],
	["io", "spruce"],
	["pids", "violet"],
	["cpuset", "sky"],
]);

const v1Trees: {
	root: string;
	tone: "rust" | "amber" | "spruce";
	nodes: TreeNode[];
}[] = [
	{
		root: "/sys/fs/cgroup/cpu/",
		tone: "rust",
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
		tone: "amber",
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
		tone: "spruce",
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

export function ControllerBadge({ name }: { name: string }) {
	return (
		<span
			className={
				academyCgroups({ tone: controllerTones.get(name) ?? "neutral" }).badge
			}
		>
			{name}
		</span>
	);
}

interface TreeProps {
	expandedKeys: Set<string>;
	toggleExpand: (key: string) => void;
}
function TreeNodeRow({
	node,
	expandedKeys,
	toggleExpand,
	pathPrefix,
}: TreeProps & {
	node: TreeNode;
	pathPrefix: string;
}) {
	const childrenId = useId();
	const nodeKey = pathPrefix + "/" + node.name;
	const hasChildren = Boolean(node.children?.length);
	const isExpanded = expandedKeys.has(nodeKey);
	return (
		<li>
			<div className={s.treeRow}>
				{hasChildren ? (
					<button
						type="button"
						className={s.nodeButton}
						onClick={() => toggleExpand(nodeKey)}
						aria-expanded={isExpanded}
						aria-controls={childrenId}
						aria-label={node.name + " in " + pathPrefix.replace(/\/+/g, "/")}
					>
						<svg
							className={s.chevron}
							data-expanded={isExpanded}
							viewBox="0 0 10 10"
							fill="none"
							aria-hidden="true"
						>
							<path
								d="M3 1.5L7 5L3 8.5"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
						{node.name}
					</button>
				) : (
					<span className={node.isProcess ? s.process : s.nodeName}>
						{node.name}
					</span>
				)}
				{node.detail && <span className={s.detail}>[{node.detail}]</span>}
				{node.controllers && (
					<span className={s.badges}>
						{node.controllers.map((name) => (
							<ControllerBadge key={name} name={name} />
						))}
					</span>
				)}
			</div>
			{hasChildren && (
				<ul
					id={childrenId}
					className={s.treeChildren}
					role="list"
					hidden={!isExpanded}
				>
					{node.children?.map((child) => (
						<TreeNodeRow
							key={child.name}
							node={child}
							expandedKeys={expandedKeys}
							toggleExpand={toggleExpand}
							pathPrefix={nodeKey}
						/>
					))}
				</ul>
			)}
		</li>
	);
}

function V1Tree({
	tree,
	...props
}: TreeProps & { tree: (typeof v1Trees)[number] }) {
	const styles = academyCgroups({ tone: tree.tone });
	return (
		<div className={styles.panel}>
			<p className={styles.panelTitle}>{tree.root}</p>
			<ul className={s.treeList} role="list">
				{tree.nodes.map((node) => (
					<TreeNodeRow
						key={node.name}
						node={node}
						pathPrefix={tree.root}
						{...props}
					/>
				))}
			</ul>
		</div>
	);
}

function StatBox({
	label,
	value,
	tone,
}: {
	label: string;
	value: string;
	tone: "rust" | "spruce";
}) {
	const styles = academyCgroups({ tone });
	return (
		<div className={s.stat}>
			<dt className={s.statLabel}>{label}</dt>
			<dd className={styles.statValue}>{value}</dd>
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
	const panelId = useId();
	const allExpandedKeys = useMemo(
		() =>
			new Set([
				...v1Trees.flatMap((tree) => buildAllKeys(tree.nodes, tree.root)),
				...buildAllKeys(v2Tree, "/sys/fs/cgroup/"),
			]),
		[],
	);
	const [expandedKeys, setExpandedKeys] = useState(
		() => new Set(allExpandedKeys),
	);
	const toggleExpand = useCallback((key: string) => {
		setExpandedKeys((previous) => {
			const next = new Set(previous);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}, []);

	return (
		<section className={s.root} aria-label="cgroup hierarchy explorer">
			<div className={s.toolbar} role="group" aria-label="cgroup version">
				{(["v1", "v2"] as const).map((tab) => (
					<button
						key={tab}
						type="button"
						className={s.button}
						aria-pressed={activeTab === tab}
						aria-controls={panelId}
						onClick={() => setActiveTab(tab)}
					>
						cgroups{tab}
					</button>
				))}
			</div>
			<p className={s.hidden} role="status">
				Showing cgroups{activeTab}
			</p>
			<div id={panelId} className={s.content}>
				{activeTab === "v1" ? (
					<V1Content expandedKeys={expandedKeys} toggleExpand={toggleExpand} />
				) : (
					<V2Content expandedKeys={expandedKeys} toggleExpand={toggleExpand} />
				)}
			</div>
		</section>
	);
}

function V1Content(props: TreeProps) {
	return (
		<>
			<p className={academyCgroups({ tone: "rust" }).accent}>
				The Fragmented Hierarchy
			</p>
			<div className={s.treeGrid}>
				{v1Trees.map((tree) => (
					<V1Tree key={tree.root} tree={tree} {...props} />
				))}
			</div>
			<div className={s.notice}>
				<strong className={academyCgroups({ tone: "rust" }).accent}>
					The Problem
				</strong>
				<p className={s.copy}>
					<span className={s.process}>nginx</span> and{" "}
					<span className={s.process}>redis</span> appear in 3 separate trees.
					No unified view. No atomic moves. No combined resource accounting.
				</p>
			</div>
			<dl className={s.statGrid}>
				<StatBox label="Controllers" value="12+" tone="rust" />
				<StatBox label="Mount Points" value="12+" tone="rust" />
				<StatBox label="Hierarchy Sync" value="Manual" tone="rust" />
			</dl>
		</>
	);
}

function V2Content(props: TreeProps) {
	const styles = academyCgroups({ tone: "spruce" });
	const root = "/sys/fs/cgroup/";
	return (
		<>
			<p className={styles.accent}>The Unified Hierarchy</p>
			<div className={s.panel}>
				<p className={styles.panelTitle}>{root}</p>
				<ul className={s.treeList} role="list">
					{v2Tree.map((node) => (
						<TreeNodeRow
							key={node.name}
							node={node}
							pathPrefix={root}
							{...props}
						/>
					))}
				</ul>
			</div>
			<div className={s.notice}>
				<strong className={styles.accent}>The Solution</strong>
				<p className={s.copy}>
					One tree. All controllers. Unified resource accounting per process.
				</p>
			</div>
			<dl className={s.statGrid}>
				<StatBox label="Hierarchy" value="1" tone="spruce" />
				<StatBox label="Mount Point" value="1" tone="spruce" />
				<StatBox label="Sync" value="Automatic" tone="spruce" />
			</dl>
		</>
	);
}
