import {
	ExclamationTriangleIcon,
	FireIcon,
	InformationCircleIcon,
	LightBulbIcon,
} from "@heroicons/react/24/outline";
import type React from "react";
import { css } from "../../styled-system/css";

interface AsideProps {
	variant: "tip" | "caution" | "danger" | "info";
	children: React.ReactNode;
}

const variantStyles = {
	tip: {
		container: css({
			background: { base: "linear-gradient(to right, token(colors.green.50), token(colors.green.100))", _dark: "linear-gradient(to right, rgba(20,83,45,0.8), rgba(6,78,59,0.8))" },
			color: { base: "green.800", _dark: "green.100" },
		}),
		icon: css({ color: { base: "green.600", _dark: "green.400" } }),
		gradient: css({ background: "linear-gradient(to bottom right, token(colors.green.500), token(colors.green.400))" }),
		border: css({ borderColor: "green.500" }),
	},
	caution: {
		container: css({
			background: { base: "linear-gradient(to right, token(colors.orange.50), token(colors.orange.100))", _dark: "linear-gradient(to right, rgba(124,45,18,0.8), rgba(154,52,18,0.8))" },
			color: { base: "orange.800", _dark: "orange.100" },
		}),
		icon: css({ color: { base: "orange.600", _dark: "orange.400" } }),
		gradient: css({ background: "linear-gradient(to bottom right, token(colors.yellow.500), token(colors.orange.400))" }),
		border: css({ borderColor: "yellow.500" }),
	},
	danger: {
		container: css({
			background: { base: "linear-gradient(to right, token(colors.red.50), token(colors.red.100))", _dark: "linear-gradient(to right, rgba(127,29,29,0.8), rgba(136,19,55,0.8))" },
			color: { base: "red.800", _dark: "red.100" },
		}),
		icon: css({ color: { base: "red.600", _dark: "red.400" } }),
		gradient: css({ background: "linear-gradient(to bottom right, token(colors.red.500), token(colors.red.400))" }),
		border: css({ borderColor: "red.500" }),
	},
	info: {
		container: css({
			background: { base: "linear-gradient(to right, rgba(var(--brand-primary),0.05), rgba(var(--brand-primary),0.1))", _dark: "linear-gradient(to right, rgba(var(--brand-primary),0.8), rgba(var(--brand-primary),0.7))" },
			color: "rgb(var(--brand-primary))",
		}),
		icon: css({ color: "rgb(var(--brand-primary))" }),
		gradient: css({ background: "linear-gradient(to bottom right, rgba(var(--brand-primary),0.5), rgb(var(--brand-secondary)))" }),
		border: css({ borderColor: "rgb(var(--brand-primary))" }),
	},
};

const AsideWrapper: React.FC<AsideProps> = ({ variant, children }) => {
	const styles = variantStyles[variant];

	const IconComponent = {
		tip: LightBulbIcon,
		caution: ExclamationTriangleIcon,
		danger: FireIcon,
		info: InformationCircleIcon,
	}[variant];

	return (
		<div
			className={`aside ${css({ my: "2", borderRadius: "lg", backdropFilter: "blur(4px)", shadow: "md", borderRight: "1px solid", borderBottom: "1px solid", position: "relative", overflow: "hidden", transition: "all", transitionDuration: "200ms", _hover: { shadow: "lg", transform: "translateY(-2px)" } })} ${styles.border} ${styles.container}`}
		>
			<div
				className={`${css({ position: "absolute", left: "0", top: "0", bottom: "0", w: "1.5" })} ${styles.gradient}`}
			/>
			<div className={css({ px: "4", position: "relative", zIndex: "10" })}>
				<div className={css({ display: "flex", alignItems: "center", gap: "2" })}>
					<div
						className={`${css({ borderRadius: "full", p: "1.5", display: "flex", alignItems: "center", justifyContent: "center", shadow: "sm", transition: "transform", transitionDuration: "200ms", _hover: { transform: "scale(1.05)" } })} ${styles.gradient}`}
					>
						<IconComponent className={css({ h: "4", w: "4", color: "white" })} aria-hidden="true" />
					</div>
					<p className={css({ fontSize: "xs", fontWeight: "bold", letterSpacing: "wider" })}>
						{variant.toUpperCase()}
					</p>
				</div>
				<div className={css({ px: "0.5" })}>{children}</div>
			</div>
		</div>
	);
};

export default AsideWrapper;
