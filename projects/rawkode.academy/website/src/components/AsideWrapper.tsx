import {
	ExclamationTriangleIcon,
	FireIcon,
	InformationCircleIcon,
	LightBulbIcon,
} from "@heroicons/react/24/outline";
import type React from "react";

interface AsideProps {
	variant: "tip" | "caution" | "danger" | "info";
	children: React.ReactNode;
}

const IconForVariant = {
	tip: LightBulbIcon,
	caution: ExclamationTriangleIcon,
	danger: FireIcon,
	info: InformationCircleIcon,
};

const AsideWrapper: React.FC<AsideProps> = ({ variant, children }) => {
	const IconComponent = IconForVariant[variant];

	return (
		<div className={`ed-aside ed-aside--${variant}`}>
			<div className="ed-aside__rail" aria-hidden="true" />
			<div className="ed-aside__icon" aria-hidden="true">
				<IconComponent className="h-4 w-4" />
			</div>
			<div className="ed-aside__body">
				<span className="ed-aside__label">§ {variant}</span>
				{children}
			</div>
		</div>
	);
};

export default AsideWrapper;
