import { useState, useRef, useEffect, useCallback } from "react";

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
			"Paul Menage and Rohit Seth propose \"process containers\" for the Linux kernel, later renamed to avoid confusion with OS-level containers.",
		color: "red",
	},
	{
		year: 2007,
		label: "Renamed to cgroups",
		detail:
			"Renamed to \"control groups\" (cgroups) before merge into the mainline kernel.",
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
		label: "v2 in Linux 4.5",
		detail:
			"cgroups v2 merged as non-default/experimental in Linux kernel 4.5.",
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
		label: "v2 declared stable",
		detail:
			"cgroups v2 reaches \"complete\" status in Linux 5.8 with full controller support.",
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
		detail:
			"Google Kubernetes Engine defaults to cgroups v2 for new clusters.",
		color: "blue",
	},
	{
		year: 2025,
		label: "v2 everywhere",
		detail:
			"Most managed Kubernetes providers and major distributions now default to cgroups v2.",
		color: "green",
	},
];

const colorMap = {
	red: {
		dot: "#ef4444",
		bg: "rgba(239, 68, 68, 0.08)",
		bgActive: "rgba(239, 68, 68, 0.15)",
		border: "rgba(239, 68, 68, 0.35)",
		glow: "rgba(239, 68, 68, 0.25)",
		label: "cgroups v1",
	},
	green: {
		dot: "#10b981",
		bg: "rgba(16, 185, 129, 0.08)",
		bgActive: "rgba(16, 185, 129, 0.15)",
		border: "rgba(16, 185, 129, 0.35)",
		glow: "rgba(16, 185, 129, 0.25)",
		label: "cgroups v2",
	},
	blue: {
		dot: "#3b82f6",
		bg: "rgba(59, 130, 246, 0.08)",
		bgActive: "rgba(59, 130, 246, 0.15)",
		border: "rgba(59, 130, 246, 0.35)",
		glow: "rgba(59, 130, 246, 0.25)",
		label: "Kubernetes",
	},
	gray: {
		dot: "#6b7280",
		bg: "rgba(107, 114, 128, 0.08)",
		bgActive: "rgba(107, 114, 128, 0.15)",
		border: "rgba(107, 114, 128, 0.35)",
		glow: "rgba(107, 114, 128, 0.2)",
		label: "Distro adoption",
	},
} as const;

function CgroupTimeline() {
	const [activeIndex, setActiveIndex] = useState<number | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const milestoneRefs = useRef<(HTMLButtonElement | null)[]>([]);

	const scrollToYear = useCallback((targetYear: number) => {
		const container = scrollRef.current;
		if (!container) return;

		const targetIndex = milestones.findIndex((m) => m.year >= targetYear);
		const targetEl =
			milestoneRefs.current[targetIndex >= 0 ? targetIndex : 0];
		if (!targetEl) return;

		const containerRect = container.getBoundingClientRect();
		const targetRect = targetEl.getBoundingClientRect();
		const offset =
			targetRect.left -
			containerRect.left -
			containerRect.width / 2 +
			targetRect.width / 2;

		container.scrollBy({ left: offset, behavior: "smooth" });
	}, []);

	useEffect(() => {
		const timer = setTimeout(() => scrollToYear(2016), 300);
		return () => clearTimeout(timer);
	}, [scrollToYear]);

	const handleMilestoneClick = useCallback((index: number) => {
		setActiveIndex((prev) => (prev === index ? null : index));
	}, []);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent, index: number) => {
			if (e.key === "Escape") {
				setActiveIndex(null);
				return;
			}
			if (e.key === "ArrowRight" && index < milestones.length - 1) {
				e.preventDefault();
				milestoneRefs.current[index + 1]?.focus();
			}
			if (e.key === "ArrowLeft" && index > 0) {
				e.preventDefault();
				milestoneRefs.current[index - 1]?.focus();
			}
		},
		[],
	);

	const legendColors = ["red", "green", "blue", "gray"] as const;

	return (
		<div
			className="not-prose my-8 overflow-hidden rounded-2xl"
			style={{ background: "#0f172a" }}
		>
			{/* Header */}
			<div className="flex flex-col gap-3 px-5 pt-5 pb-2 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pt-6">
				<div>
					<h3
						className="m-0 text-lg font-semibold tracking-tight sm:text-xl"
						style={{ color: "#f1f5f9" }}
					>
						cgroups Timeline
					</h3>
					<p className="m-0 mt-1 text-sm" style={{ color: "#94a3b8" }}>
						From process containers to universal v2 adoption
					</p>
				</div>

				{/* Legend */}
				<div className="flex flex-wrap gap-x-4 gap-y-1.5">
					{legendColors.map((color) => (
						<div key={color} className="flex items-center gap-1.5">
							<span
								className="inline-block h-2.5 w-2.5 rounded-full"
								style={{ backgroundColor: colorMap[color].dot }}
							/>
							<span
								className="text-xs font-medium"
								style={{ color: "#94a3b8" }}
							>
								{colorMap[color].label}
							</span>
						</div>
					))}
				</div>
			</div>

			{/* Scroll hint */}
			<div
				className="flex items-center gap-1.5 px-5 pb-3 sm:px-6"
				style={{ color: "#475569" }}
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<path d="M5 12h14" />
					<path d="m12 5 7 7-7 7" />
				</svg>
				<span className="text-xs">Scroll to explore</span>
			</div>

			{/* Timeline scroll area */}
			<div
				ref={scrollRef}
				className="overflow-x-auto"
				style={{
					scrollbarWidth: "thin",
					scrollbarColor: "#334155 #1e293b",
				}}
			>
				<div
					className="relative"
					style={{
						minWidth: "max-content",
						paddingTop: "11rem",
						paddingBottom: "11rem",
						paddingLeft: "2.5rem",
						paddingRight: "2.5rem",
					}}
				>
					{/* Timeline rail */}
					<div
						className="absolute"
						style={{
							left: "1.5rem",
							right: "1.5rem",
							top: "calc(11rem + 5px)",
							height: "2px",
							background:
								"linear-gradient(90deg, transparent, #334155 3%, #334155 97%, transparent)",
						}}
					/>

					{/* Milestone nodes */}
					<div className="relative flex" style={{ gap: "2rem" }}>
						{milestones.map((milestone, index) => {
							const colors = colorMap[milestone.color];
							const isActive = activeIndex === index;
							const isAbove = index % 2 === 0;
							const yearLabel = milestone.month
								? `${milestone.year} ${milestone.month}`
								: `${milestone.year}`;

							return (
								<div
									key={`${milestone.year}-${milestone.label}`}
									className="relative flex flex-col items-center"
									style={{ width: "8rem" }}
								>
									{/* Card (positioned above or below the rail) */}
									<div
										className="absolute left-1/2"
										style={{
											width: "9rem",
											transform: "translateX(-50%)",
											...(isAbove
												? { bottom: "100%", marginBottom: "1rem" }
												: { top: "100%", marginTop: "1rem" }),
										}}
									>
										<button
											ref={(el) => {
												milestoneRefs.current[index] = el;
											}}
											type="button"
											onClick={() => handleMilestoneClick(index)}
											onKeyDown={(e) => handleKeyDown(e, index)}
											className="w-full cursor-pointer border-0 bg-transparent p-0 text-left focus-visible:outline-none"
											aria-expanded={isActive}
											aria-label={`${yearLabel}: ${milestone.label}. Click for details.`}
										>
											<div
												className="rounded-lg px-3 py-2.5"
												style={{
													background: isActive
														? colors.bgActive
														: colors.bg,
													border: `1px solid ${isActive ? colors.border : "transparent"}`,
													boxShadow: isActive
														? `0 0 16px ${colors.glow}`
														: "none",
													transition:
														"background 200ms ease, border-color 200ms ease, box-shadow 200ms ease",
												}}
											>
												<span
													className="block text-xs font-bold tabular-nums"
													style={{ color: colors.dot }}
												>
													{yearLabel}
												</span>
												<span
													className="mt-0.5 block text-xs font-medium leading-snug"
													style={{ color: "#e2e8f0" }}
												>
													{milestone.label}
												</span>

												{/* Expanded detail */}
												{isActive && (
													<span
														className="mt-2 block border-t pt-2 text-xs leading-relaxed"
														style={{
															color: "#94a3b8",
															borderColor: colors.border,
														}}
													>
														<span
															className="mb-1 block text-[0.625rem] font-bold uppercase tracking-widest"
															style={{ color: colors.dot }}
														>
															{colors.label}
														</span>
														{milestone.detail}
													</span>
												)}
											</div>
										</button>

										{/* Connector stem from card to dot */}
										<div
											className="absolute left-1/2"
											style={{
												width: "1px",
												transform: "translateX(-50%)",
												background: `linear-gradient(${isAbove ? "to bottom" : "to top"}, ${colors.dot}22, ${colors.dot})`,
												...(isAbove
													? { top: "100%", height: "1rem" }
													: { bottom: "100%", height: "1rem" }),
											}}
										/>
									</div>

									{/* Dot on the rail */}
									<div className="relative">
										{isActive && (
											<span
												className="absolute left-1/2 top-1/2 rounded-full"
												style={{
													width: "1.5rem",
													height: "1.5rem",
													transform: "translate(-50%, -50%)",
													background: colors.dot,
													opacity: 0.2,
													animation:
														"cgroup-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
												}}
											/>
										)}
										<span
											className="relative z-10 block rounded-full"
											style={{
												width: isActive ? "0.875rem" : "0.625rem",
												height: isActive ? "0.875rem" : "0.625rem",
												backgroundColor: colors.dot,
												border: `2px solid #0f172a`,
												boxShadow: isActive
													? `0 0 10px ${colors.glow}, 0 0 4px ${colors.glow}`
													: `0 0 6px ${colors.glow}`,
												transition:
													"width 200ms ease, height 200ms ease, box-shadow 200ms ease",
											}}
										/>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>

			{/* Keyframe for pulse animation */}
			<style>{`
				@keyframes cgroup-ping {
					0% {
						transform: translate(-50%, -50%) scale(1);
						opacity: 0.2;
					}
					75%, 100% {
						transform: translate(-50%, -50%) scale(2.5);
						opacity: 0;
					}
				}
			`}</style>
		</div>
	);
}

export default CgroupTimeline;
