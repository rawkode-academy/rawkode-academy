import { academySkeleton } from "@rawkodeacademy/design-system";

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

	const skeleton = academySkeleton();

	// Layout only; the surfaces and pulse come from academySkeleton.
	return (
		<div className={className} role="status" aria-label="Loading list...">
			<span className="sr-only">Loading list...</span>
			{Array.from({ length: items }).map((_, index) => (
				<div
					key={index}
					className={skeleton.row}
					style={{
						alignItems: "center",
						padding: "0.75rem",
						...(index === items - 1 ? { borderBottom: 0 } : {}),
					}}
				>
					{showIcon && (
						<div
							className={iconRounded ? skeleton.avatar : skeleton.line}
							style={{ flexShrink: 0, width: iconSize, height: iconSize }}
						/>
					)}

					<div
						className={skeleton.content}
						style={{ display: "grid", gap: "0.25rem" }}
					>
						<div
							className={skeleton.lineMedium}
							style={{ width: getTitleWidth(index) }}
						/>
						{showSubtitle && (
							<div className={skeleton.lineSmall} style={{ width: "50%" }} />
						)}
					</div>

					{showAction && (
						<div
							className={skeleton.line}
							style={{ flexShrink: 0, width: "1.5rem", height: "1.5rem" }}
						/>
					)}
				</div>
			))}
		</div>
	);
}
