import { css } from "../../../styled-system/css";

export interface SkeletonListProps {
	items?: number;
	showIcon?: boolean;
	iconSize?: string;
	iconRounded?: boolean;
	showSubtitle?: boolean;
	showAction?: boolean;
	className?: string;
}

const rowStyle = css({
	display: "flex",
	alignItems: "center",
	gap: "3",
	p: "3",
	borderBottomWidth: "1px",
	borderColor: {
		base: "gray.100",
		_dark: "gray.800",
	},
	_last: {
		borderBottomWidth: "0",
	},
});

const pulseBase = {
	animation: "pulse",
	bg: {
		base: "gray.200",
		_dark: "gray.700",
	},
} as const;

const iconPulseRounded = css({ ...pulseBase, flexShrink: 0, rounded: "full" });
const iconPulseSquare = css({ ...pulseBase, flexShrink: 0, rounded: "sm" });

const contentStyle = css({
	flex: "1",
});

const titleBarStyle = css({
	...pulseBase,
	rounded: "sm",
	h: "4",
	mb: "1",
});

const subtitleBarStyle = css({
	...pulseBase,
	rounded: "sm",
	h: "3",
});

const actionStyle = css({
	...pulseBase,
	rounded: "sm",
	flexShrink: 0,
});

const srOnlyStyle = css({
	srOnly: true,
});

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

	const iconStyle = iconRounded ? iconPulseRounded : iconPulseSquare;

	return (
		<div className={className || undefined} role="status" aria-label="Loading list...">
			<span className={srOnlyStyle}>Loading list...</span>
			{Array.from({ length: items }).map((_, index) => (
				<div
					key={index}
					className={rowStyle}
				>
					{showIcon && (
						<div
							className={iconStyle}
							style={{
								width: iconSize,
								height: iconSize,
							}}
						/>
					)}

					<div className={contentStyle}>
						<div
							className={titleBarStyle}
							style={{ width: getTitleWidth(index) }}
						/>
						{showSubtitle && (
							<div
								className={subtitleBarStyle}
								style={{ width: "50%" }}
							/>
						)}
					</div>

					{showAction && (
						<div
							className={actionStyle}
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
