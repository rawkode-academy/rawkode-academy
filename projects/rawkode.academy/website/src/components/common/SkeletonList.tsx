export interface SkeletonListProps {
	items?: number;
	showIcon?: boolean;
	iconSize?: string;
	iconRounded?: boolean;
	showSubtitle?: boolean;
	showAction?: boolean;
	className?: string;
}

export function SkeletonList({
	items = 5,
	showIcon = true,
	iconSize = "2rem",
	iconRounded = false,
	showSubtitle = true,
	showAction = false,
	className = "",
}: SkeletonListProps) {
	const getTitleWidth = (index: number): string => {
		const widths = ["70%", "85%", "60%", "75%", "65%"];
		return widths[index % widths.length] || "70%";
	};

	return (
		<div className={className} role="status" aria-label="Loading list...">
			<span className="sr-only">Loading list...</span>
			{Array.from({ length: items }).map((_, index) => (
				<div
					key={index}
					className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
				>
					{showIcon && (
						<div
							className={`animate-pulse bg-gray-200 dark:bg-gray-700 shrink-0 ${
								iconRounded ? "rounded-full" : "rounded"
							}`}
							style={{
								width: iconSize,
								height: iconSize,
							}}
						/>
					)}

					<div className="flex-1">
						<div
							className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-4 mb-1"
							style={{ width: getTitleWidth(index) }}
						/>
						{showSubtitle && (
							<div
								className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-3"
								style={{ width: "50%" }}
							/>
						)}
					</div>

					{showAction && (
						<div
							className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded shrink-0"
							style={{
								width: "1.5rem",
								height: "1.5rem",
							}}
						/>
					)}
				</div>
			))}
		</div>
	);
}
