import { css, cx } from "styled-system/css";
import { TypeAnimation } from "react-type-animation";

interface ButtonProps {
	text: string;
	link: string;
	newWindow?: boolean;
}

interface TechLogo {
	name: string;
	iconUrl: string;
}

interface SocialProofStat {
	icon: string;
	value: string;
	label: string;
}

interface Props {
	rotatedPrefixes: string[];
	suffix: string;
	highlight: string;
	logos: TechLogo[];
	primaryButton: ButtonProps;
	secondaryButton: ButtonProps;
	socialProof?: SocialProofStat[];
}

const shuffle = (array: string[]): string[] => {
	return array.sort(() => Math.random() - 0.5);
};

const sectionStyle = cx("glass-panel", css({
	position: "relative",
	mb: "6",
	rounded: "3xl",
	overflow: "hidden",
}));

const overlayStyle = css({
	position: "absolute",
	inset: "0",
	backgroundImage:
		"linear-gradient(to bottom right, rgb(255 255 255 / 0.6), rgb(var(--brand-primary) / 0.1), transparent)",
	opacity: "0.7",
	pointerEvents: "none",
	_dark: {
		backgroundImage:
			"linear-gradient(to bottom right, rgb(17 24 39 / 0.6), rgb(var(--brand-primary) / 0.2), transparent)",
	},
});

const gridStyle = css({
	position: "relative",
	display: "grid",
	maxW: "6xl",
	px: "4",
	pt: "0",
	pb: "10",
	mx: "auto",
	gap: "8",
	sm: { px: "6" },
	lg: { gap: "6", pt: "6", pb: "16", gridTemplateColumns: "repeat(12, 1fr)" },
});

const contentStyle = css({
	placeSelf: "center",
	display: "flex",
	flexDirection: "column",
	gap: "4",
	minW: "0",
	w: "full",
	lg: { gridColumn: "span 6" },
});

const h1Style = css({
	textWrap: "balance",
	fontSize: "3xl",
	fontWeight: "bold",
	letterSpacing: "tight",
	lineHeight: "tight",
	color: { base: "black", _dark: "white" },
	sm: { fontSize: "4xl" },
	md: { fontSize: "5xl" },
	xl: { fontSize: "6xl" },
});

const typeSpanStyle = css({
	display: "block",
	fontSize: "2xl",
	sm: { fontSize: "3xl" },
	md: { fontSize: "4xl" },
	xl: { fontSize: "5xl" },
});

const typeAnimationStyle = css({
	backgroundImage: "linear-gradient(to bottom right, rgb(var(--brand-primary)), rgb(var(--brand-secondary)))",
	backgroundClip: "text",
	color: "transparent",
	pb: "2",
});

const suffixSpanStyle = css({
	display: "block",
	textWrap: "pretty",
	mt: "2",
	fontSize: "1.4rem",
	sm: { mt: "3", fontSize: "1.7rem" },
	md: { fontSize: "2.1rem" },
	xl: { fontSize: "2.7rem" },
});

const underlineStyle = css({
	position: "absolute",
	bottom: "0",
	left: "0",
	w: "full",
	h: "1",
	backgroundImage:
		"linear-gradient(to right, rgb(var(--brand-primary) / 0.3), rgb(var(--brand-secondary) / 0.3))",
});

const descStyle = css({
	color: { base: "gray.600", _dark: "gray.400" },
	maxW: "3xl",
	md: { fontSize: "lg" },
	lg: { fontSize: "xl" },
});

const btnRowStyle = css({
	display: "flex",
	flexDirection: "column",
	gap: "3",
	sm: { flexDirection: "row", alignItems: "center" },
});

const primaryBtnStyle = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	px: "6",
	py: "3",
	fontSize: "md",
	fontWeight: "semibold",
	textAlign: "center",
	rounded: "xl",
	color: "white",
	backgroundImage:
		"linear-gradient(to bottom right, rgb(var(--brand-primary) / 0.95), rgb(var(--brand-secondary) / 0.95))",
	backdropFilter: "blur(12px)",
	shadow: "md",
	border: "1px solid",
	borderColor: "rgb(var(--brand-primary) / 0.3)",
	transition: "all",
	transitionDuration: "200ms",
	_hover: { shadow: "lg", transform: "scale(1.05)" },
});

const secondaryBtnStyle = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	px: "6",
	py: "3",
	fontSize: "md",
	fontWeight: "medium",
	textAlign: "center",
	color: { base: "gray.900", _dark: "white" },
	bg: { base: "rgba(255,255,255,0.6)", _dark: "rgba(31,41,55,0.6)" },
	backdropFilter: "blur(16px)",
	border: "1px solid",
	borderColor: { base: "rgba(255,255,255,0.6)", _dark: "rgba(75,85,99,0.6)" },
	rounded: "xl",
	shadow: "md",
	transition: "all",
	transitionDuration: "200ms",
	_hover: { bg: { base: "rgba(255,255,255,0.8)", _dark: "rgba(55,65,81,0.8)" }, shadow: "lg", transform: "scale(1.05)" },
});

const iconSmStyle = css({ w: "5", h: "5", ml: "2", mr: "-1" });

const socialProofStyle = css({
	display: "flex",
	flexWrap: "wrap",
	alignItems: "center",
	gap: "2",
	pt: "4",
	sm: { gap: "4" },
});

const statStyle = css({ display: "flex", alignItems: "center", gap: "1", sm: { gap: "2" } });

const logoGridContainerStyle = css({
	display: "none",
	lg: { gridColumn: "span 6", display: "flex", alignItems: "center", justifyContent: "center" },
});

const logoGridStyle = css({
	display: "grid",
	gridTemplateColumns: "repeat(2, 1fr)",
	gap: "4",
	w: "full",
	maxW: "400px",
});

const logoCardStyle = css({
	position: "relative",
	aspectRatio: "1/1",
	overflow: "hidden",
	rounded: "2xl",
	shadow: "md",
	bg: { base: "rgba(255,255,255,0.4)", _dark: "rgba(31,41,55,0.6)" },
	backdropFilter: "blur(40px)",
	border: "1px solid",
	borderColor: { base: "rgba(255,255,255,0.4)", _dark: "rgba(75,85,99,0.5)" },
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	"&:hover img": { opacity: "1", transform: "scale(1.1)" },
	"&:hover .scanline-logo": { transform: "scale(1.1)", opacity: "0" },
	"&:hover .logo-label": { opacity: "1" },
});

const scanlineLogoStyle = css({
	position: "relative",
	w: "2/3",
	h: "2/3",
	transition: "all",
	transitionDuration: "300ms",
});

const scanlineMaskStyle = css({
	position: "absolute",
	inset: "0",
	animation: "scanline-scroll 1s linear infinite",
});

const absInsetStyle = css({ position: "absolute", inset: "0" });

const logoImgStyle = css({
	position: "absolute",
	w: "2/3",
	h: "2/3",
	objectFit: "contain",
	opacity: "0",
	transition: "all",
	transitionDuration: "300ms",
});

const labelContainerStyle = css({
	position: "absolute",
	insetInline: "0",
	bottom: "4",
	display: "flex",
	justifyContent: "center",
	opacity: "0",
	transition: "opacity",
	transitionDuration: "300ms",
	pointerEvents: "none",
});

const labelStyle = css({
	bg: "rgba(0,0,0,0.7)",
	color: "white",
	fontSize: "10px",
	fontWeight: "bold",
	textTransform: "uppercase",
	letterSpacing: "wider",
	px: "2",
	py: "1",
	rounded: "lg",
	backdropFilter: "blur(12px)",
	border: "1px solid rgba(255,255,255,0.1)",
});

const Typewriter = (props: Props) => {
	return (
		<section className={sectionStyle}>
			<div className={overlayStyle} />
			<div className={gridStyle}>
				<div className={contentStyle}>
					<h1 className={h1Style}>
						<span className={typeSpanStyle}>
							<TypeAnimation
								className={typeAnimationStyle}
								sequence={shuffle(props.rotatedPrefixes).reduce<
									Array<string | number>
								>((acc, prefix: string) => [...acc, prefix, 1250], [])}
								wrapper="span"
								preRenderFirstString
								speed={16}
								deletionSpeed={32}
								cursor
								repeat={Number.POSITIVE_INFINITY}
							/>
						</span>
						<span className={suffixSpanStyle}>
							{props.suffix.split(props.highlight).map((part, index, array) => {
								if (index === array.length - 1) {
									return <span key={index}>{part}</span>;
								}
								return (
									<span key={index}>
										{part}
										<span className={css({ position: "relative" })}>
											{props.highlight}
											<span className={underlineStyle} />
										</span>
									</span>
								);
							})}
						</span>
					</h1>
					<p className={descStyle}>
						Navigating the Cloud Native landscape can be tough and just keeping
						your head above water is a challenge.
						<br />
						<br />
						<span className={css({ fontWeight: "medium", color: { base: "black", _dark: "white" } })}>
							We're here to help.
						</span>
					</p>
					<div className={btnRowStyle}>
						<a
							href={props.primaryButton.link}
							target={props.primaryButton.newWindow ? "_blank" : "_self"}
							className={primaryBtnStyle}
						>
							{props.primaryButton.text}
							<svg
								className={iconSmStyle}
								fill="currentColor"
								viewBox="0 0 20 20"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									fillRule="evenodd"
									d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
									clipRule="evenodd"
								/>
							</svg>
						</a>

						<a
							href={props.secondaryButton.link}
							target={props.secondaryButton.newWindow ? "_blank" : "_self"}
							className={secondaryBtnStyle}
						>
							{props.secondaryButton.text}
						</a>
					</div>

					{props.socialProof && props.socialProof.length > 0 && (
						<div className={socialProofStyle}>
							{props.socialProof.map((stat, index) => (
								<div key={index} className={statStyle}>
									<span className={css({ fontSize: "lg" })}>{stat.icon}</span>
									<span className={css({ fontWeight: "bold", color: { base: "gray.900", _dark: "white" } })}>{stat.value}</span>
									<span className={css({ color: { base: "gray.500", _dark: "gray.400" }, fontSize: { base: "xs", sm: "sm" } })}>{stat.label}</span>
								</div>
							))}
						</div>
					)}
				</div>
				<div className={logoGridContainerStyle}>
					<div className={logoGridStyle}>
						{props.logos.slice(0, 4).map((logo) => (
							<div key={logo.name} className={logoCardStyle}>
								<div className={`scanline-logo ${scanlineLogoStyle}`}>
									<div
										className={scanlineMaskStyle}
										style={{
											maskImage: `repeating-linear-gradient(to bottom, black 0px, black 2px, transparent 2px, transparent 4px)`,
											WebkitMaskImage: `repeating-linear-gradient(to bottom, black 0px, black 2px, transparent 2px, transparent 4px)`,
											maskSize: "100% 4px",
											WebkitMaskSize: "100% 4px",
										}}
									>
										<div
											className={absInsetStyle}
											style={{
												backgroundColor: "rgb(var(--brand-secondary))",
												opacity: 0.3,
												maskImage: `url(${logo.iconUrl})`,
												WebkitMaskImage: `url(${logo.iconUrl})`,
												maskMode: "alpha",
												maskRepeat: "no-repeat",
												maskPosition: "center",
												maskSize: "contain",
											} as React.CSSProperties}
										/>
										<div
											className={absInsetStyle}
											style={{
												backgroundColor: "rgb(var(--brand-primary))",
												maskImage: `url(${logo.iconUrl})`,
												WebkitMaskImage: `url(${logo.iconUrl})`,
												maskMode: "luminance",
												maskRepeat: "no-repeat",
												maskPosition: "center",
												maskSize: "contain",
											} as React.CSSProperties}
										/>
									</div>
								</div>

								<img
									src={logo.iconUrl}
									alt={logo.name}
									className={logoImgStyle}
								/>

								<div className={`logo-label ${labelContainerStyle}`}>
									<span className={labelStyle}>
										{logo.name}
									</span>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
};

export default Typewriter;
