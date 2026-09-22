import {
	type KeyboardEvent,
	useState,
	useRef,
	useCallback,
	useId,
} from "react";
import { academyCgroups } from "@rawkodeacademy/design-system";

interface Milestone {
	year: number;
	month?: string;
	label: string;
	detail: string;
	color: "red" | "green" | "blue" | "gray";
}

const milestones: Milestone[] = [
	{
		year: 2006,
		label: "Process containers proposed",
		detail:
			'Paul Menage and Rohit Seth propose "process containers" for the Linux kernel, later renamed to avoid confusion with OS-level containers.',
		color: "red",
	},
	{
		year: 2007,
		label: "Renamed to cgroups",
		detail:
			'Renamed to "control groups" (cgroups) before merge into the mainline kernel.',
		color: "red",
	},
	{
		year: 2008,
		label: "Merged in 2.6.24",
		detail: "cgroups merged into Linux kernel 2.6.24.",
		color: "red",
	},
	{
		year: 2010,
		label: "LXC uses cgroups",
		detail:
			"LXC (Linux Containers) project builds on cgroups and namespaces for OS-level virtualization.",
		color: "red",
	},
	{
		year: 2013,
		label: "Docker launches",
		detail:
			"Docker uses cgroups v1 for container resource isolation, bringing containers to the mainstream.",
		color: "red",
	},
	{
		year: 2014,
		label: "Unified hierarchy patchset",
		detail:
			"Tejun Heo posts patchset proposing a single unified hierarchy to fix v1's fragmented multi-hierarchy design.",
		color: "green",
	},
	{
		year: 2016,
		month: "Mar",
		label: "v2 declared stable",
		detail:
			"cgroups v2 is declared stable in Linux 4.5, dropping the experimental __DEVEL__sane_behavior mount flag it had carried since its initial appearance in 3.16 (Aug 2014).",
		color: "green",
	},
	{
		year: 2016,
		month: "May",
		label: "cgroup namespaces",
		detail:
			"cgroup namespace support lands in Linux 4.6, enabling per-container cgroup views.",
		color: "green",
	},
	{
		year: 2019,
		label: "Fedora 31 defaults to v2",
		detail:
			"Fedora 31 becomes the first major distribution to default to cgroups v2.",
		color: "gray",
	},
	{
		year: 2020,
		label: "Docker supports v2",
		detail:
			"Docker 20.10 ships with cgroups v2 support, closing the last major runtime gap for v2 adoption across the container ecosystem.",
		color: "green",
	},
	{
		year: 2021,
		label: "K8s 1.22 beta",
		detail:
			"Kubernetes cgroups v2 support reaches beta, enabling native v2 resource management.",
		color: "blue",
	},
	{
		year: 2022,
		label: "K8s 1.25 GA",
		detail: "Kubernetes cgroups v2 support goes GA (generally available).",
		color: "blue",
	},
	{
		year: 2022,
		label: "Ubuntu 22.04 defaults to v2",
		detail:
			"Ubuntu 22.04 LTS defaults to cgroups v2, bringing v2 to the most widely deployed server distro.",
		color: "gray",
	},
	{
		year: 2023,
		label: "RHEL 9 defaults to v2",
		detail:
			"Red Hat Enterprise Linux 9 defaults to cgroups v2 across its ecosystem.",
		color: "gray",
	},
	{
		year: 2024,
		label: "GKE defaults to v2",
		detail: "Google Kubernetes Engine defaults to cgroups v2 for new clusters.",
		color: "blue",
	},
	{
		year: 2025,
		label: "v2 is the default",
		detail:
			"cgroups v2 is the default on new installs of every major distribution and managed Kubernetes provider. v1 still ships on older LTS hosts and specialised environments, but new deployments land on v2 unless explicitly opted out.",
		color: "green",
	},
];

const categories = {
	red: { tone: "rust", label: "cgroups v1" },
	green: { tone: "spruce", label: "cgroups v2" },
	blue: { tone: "sky", label: "Kubernetes" },
	gray: { tone: "neutral", label: "Distro adoption" },
} as const;
const s = academyCgroups();

export default function CgroupTimeline() {
	const [activeIndex, setActiveIndex] = useState<number | null>(null);
	const milestoneRefs = useRef<(HTMLButtonElement | null)[]>([]);
	const id = useId();
	const handleMilestoneClick = useCallback((index: number) => {
		setActiveIndex((previous) => (previous === index ? null : index));
	}, []);
	const handleKeyDown = useCallback((event: KeyboardEvent, index: number) => {
		if (event.key === "Escape") {
			setActiveIndex(null);
			return;
		}
		const next =
			event.key === "ArrowRight"
				? Math.min(index + 1, milestones.length - 1)
				: event.key === "ArrowLeft"
					? Math.max(index - 1, 0)
					: event.key === "Home"
						? 0
						: event.key === "End"
							? milestones.length - 1
							: undefined;
		if (next !== undefined) {
			event.preventDefault();
			milestoneRefs.current[next]?.focus();
		}
	}, []);

	return (
		<section className={s.root} aria-labelledby={id + "-title"}>
			<div className={s.content}>
				<h3 id={id + "-title"} className={s.heading}>
					cgroups Timeline
				</h3>
				<p className={s.copy}>
					From process containers to universal v2 adoption
				</p>
				<div className={s.legend} aria-label="Milestone categories">
					{Object.entries(categories).map(([key, category]) => (
						<span key={key} className={s.row}>
							<span
								className={academyCgroups({ tone: category.tone }).dot}
								aria-hidden="true"
							/>
							<span className={s.muted}>{category.label}</span>
						</span>
					))}
				</div>
				<p id={id + "-help"} className={s.muted}>
					Scroll to explore. Use Left and Right arrows between milestones, Enter
					or Space for details, and Escape to close.
				</p>
			</div>
			<div
				className={s.scroll}
				role="region"
				aria-label="Timeline milestones"
				aria-describedby={id + "-help"}
				tabIndex={0}
			>
				<ol className={s.timeline} role="list">
					{milestones.map((milestone, index) => {
						const category = categories[milestone.color];
						const styles = academyCgroups({ tone: category.tone });
						const isActive = activeIndex === index;
						const yearLabel = milestone.month
							? milestone.year + " " + milestone.month
							: String(milestone.year);
						const buttonId = id + "-milestone-" + index;
						const detailId = id + "-detail-" + index;
						return (
							<li key={buttonId} className={s.milestoneItem}>
								<button
									ref={(element) => {
										milestoneRefs.current[index] = element;
									}}
									id={buttonId}
									type="button"
									onClick={() => handleMilestoneClick(index)}
									onKeyDown={(event) => handleKeyDown(event, index)}
									className={styles.milestone}
									aria-expanded={isActive}
									aria-controls={detailId}
								>
									<span className={styles.year}>{yearLabel}</span>
									<span className={s.milestoneTitle}>{milestone.label}</span>
								</button>
								<div
									id={detailId}
									role="region"
									aria-labelledby={buttonId}
									hidden={!isActive}
									className={s.milestoneDetail}
								>
									<p className={styles.accent}>{category.label}</p>
									<p>{milestone.detail}</p>
								</div>
							</li>
						);
					})}
				</ol>
			</div>
		</section>
	);
}
