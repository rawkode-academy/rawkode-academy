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
		container: css({ bgGradient: 'to-r', gradientFrom: { base: 'green.50', _dark: 'green.950/80' }, gradientTo: { base: 'green.100', _dark: 'green.900/80' }, color: { base: 'green.800', _dark: 'green.100' } }),
		icon: css({ color: { base: 'green.600', _dark: 'green.400' } }),
		gradient: css({ bgGradient: 'to-br', gradientFrom: 'green.500', gradientTo: 'green.400' }),
		border: css({ borderColor: 'green.500' }),
	},
	caution: {
		container: css({ bgGradient: 'to-r', gradientFrom: { base: 'orange.50', _dark: 'orange.950/80' }, gradientTo: { base: 'orange.100', _dark: 'orange.900/80' }, color: { base: 'orange.800', _dark: 'orange.100' } }),
		icon: css({ color: { base: 'orange.600', _dark: 'orange.400' } }),
		gradient: css({ bgGradient: 'to-br', gradientFrom: 'yellow.500', gradientTo: 'orange.400' }),
		border: css({ borderColor: 'yellow.500' }),
	},
	danger: {
		container: css({ bgGradient: 'to-r', gradientFrom: { base: 'red.50', _dark: 'red.950/80' }, gradientTo: { base: 'red.100', _dark: 'red.900/80' }, color: { base: 'red.800', _dark: 'red.100' } }),
		icon: css({ color: { base: 'red.600', _dark: 'red.400' } }),
		gradient: css({ bgGradient: 'to-br', gradientFrom: 'red.500', gradientTo: 'red.400' }),
		border: css({ borderColor: 'red.500' }),
	},
	info: {
		container: css({ bgGradient: 'to-r', gradientFrom: { base: 'colorPalette.default/5', _dark: 'colorPalette.default/80' }, gradientTo: { base: 'colorPalette.default/10', _dark: 'colorPalette.default/80' }, color: 'colorPalette.default' }),
		icon: css({ color: 'colorPalette.default' }),
		gradient: css({ bgGradient: 'to-br', gradientFrom: 'colorPalette.default/50', gradientTo: 'colorPalette.default' }),
		border: css({ borderColor: 'colorPalette.default' }),
	},
};

const wrapperStyle = css({ my: '2', borderRadius: 'lg', backdropFilter: 'blur(4px)', shadow: 'md', borderRightWidth: '1px', borderBottomWidth: '1px', position: 'relative', overflow: 'hidden', transition: 'all', transitionDuration: '200ms', _hover: { shadow: 'lg', translateY: '-0.5' } });
const accentLineStyle = css({ position: 'absolute', left: '0', top: '0', bottom: '0', w: '1.5' });
const innerStyle = css({ px: '4', position: 'relative', zIndex: '10' });
const headerStyle = css({ display: 'flex', alignItems: 'center', gap: '2' });
const iconBubbleStyle = css({ borderRadius: 'full', p: '1.5', display: 'flex', alignItems: 'center', justifyContent: 'center', shadow: 'sm', transform: 'scale(1)', transition: 'transform', transitionDuration: '200ms', _hover: { transform: 'scale(1.05)' } });
const iconStyle = css({ h: '4', w: '4', color: 'white' });
const labelStyle = css({ fontSize: 'xs', fontWeight: 'bold', letterSpacing: 'wider' });
const bodyStyle = css({ px: '0.5' });

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
			className={`aside ${wrapperStyle} ${styles.border} ${styles.container}`}
		>
			<div
				className={`${accentLineStyle} ${styles.gradient}`}
				style={{ boxShadow: '0 0 8px rgba(var(--accent-glow),0.6)' }}
			/>
			<div className={innerStyle}>
				<div className={headerStyle}>
					<div
						className={`${iconBubbleStyle} ${styles.gradient}`}
					>
						<IconComponent className={iconStyle} aria-hidden="true" />
					</div>
					<p className={labelStyle}>
						{variant.toUpperCase()}
					</p>
				</div>
				<div className={bodyStyle}>{children}</div>
			</div>
		</div>
	);
};

export default AsideWrapper;
