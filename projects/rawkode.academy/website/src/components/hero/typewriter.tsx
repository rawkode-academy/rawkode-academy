import type { CSSProperties } from "react";
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

const BRAND = "#5f5ed7";
const CYAN = "#00ceff";

const shuffle = (array: string[]): string[] =>
	[...array].sort(() => Math.random() - 0.5);

const sectionStyle: CSSProperties = {
	position: "relative",
	overflow: "hidden",
	borderRadius: "2rem",
	border: "1px solid var(--colors-border-muted)",
	background: "var(--colors-bg-raised)",
	marginTop: "2rem",
	marginInline: "0.5rem",
};

const auroraStyle: CSSProperties = {
	position: "absolute",
	inset: 0,
	pointerEvents: "none",
	backgroundImage: `radial-gradient(circle at 12% 18%, rgba(95, 94, 215, 0.18), transparent 45%), radial-gradient(circle at 88% 25%, rgba(0, 206, 255, 0.16), transparent 45%)`,
};

const innerStyle: CSSProperties = {
	position: "relative",
	display: "grid",
	gap: "2rem",
	gridTemplateColumns: "minmax(0, 1.22fr) minmax(14rem, 0.68fr)",
	alignItems: "center",
	maxWidth: "72rem",
	margin: "0 auto",
	paddingInline: "1.25rem",
	paddingTop: "1.5rem",
	paddingBottom: "2rem",
};

const eyebrowStyle: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	gap: "0.5rem",
	paddingInline: "0.75rem",
	paddingBlock: "0.375rem",
	borderRadius: "9999px",
	background: "color-mix(in srgb, #5f5ed7 12%, transparent)",
	color: "var(--colors-fg-brand)",
	fontSize: "0.68rem",
	fontWeight: 600,
	letterSpacing: "0.22em",
	textTransform: "uppercase",
};

const eyebrowDot: CSSProperties = {
	width: "0.5rem",
	height: "0.5rem",
	borderRadius: "9999px",
	background: BRAND,
};

const headingBlock: CSSProperties = {
	color: "var(--colors-fg-primary)",
	marginTop: "1.25rem",
};

const rotatingStyle: CSSProperties = {
	display: "block",
	minHeight: "1.28em",
	paddingBottom: "0.08em",
	fontFamily: "var(--fonts-display)",
	fontSize: "clamp(1.95rem, 4.4vw, 3.55rem)",
	fontWeight: 700,
	lineHeight: 1.02,
	letterSpacing: "-0.04em",
	color: "var(--colors-fg-brand)",
};

const suffixStyle: CSSProperties = {
	marginTop: "0.5rem",
	display: "block",
	maxWidth: "18ch",
	fontFamily: "var(--fonts-display)",
	fontSize: "clamp(1.9rem, 4vw, 3.15rem)",
	fontWeight: 700,
	lineHeight: 0.95,
	letterSpacing: "-0.03em",
	textWrap: "balance",
	color: "var(--colors-fg-primary)",
};

const subStyle: CSSProperties = {
	marginTop: "1.25rem",
	maxWidth: "42rem",
	fontSize: "1.05rem",
	lineHeight: 1.6,
	color: "var(--colors-fg-secondary)",
};

const buttonsRow: CSSProperties = {
	marginTop: "2rem",
	display: "flex",
	flexWrap: "wrap",
	gap: "0.75rem",
	alignItems: "center",
};

const primaryBtn: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	gap: "0.5rem",
	minHeight: "3rem",
	paddingInline: "1.5rem",
	paddingBlock: "0.75rem",
	borderRadius: "1rem",
	border: "none",
	backgroundImage: `linear-gradient(135deg, ${BRAND}, ${CYAN})`,
	color: "#fff",
	fontSize: "1rem",
	fontWeight: 600,
	textDecoration: "none",
	boxShadow: "0 12px 32px -16px rgba(95, 94, 215, 0.6)",
	transition: "transform 200ms ease, box-shadow 200ms ease",
	cursor: "pointer",
};

const secondaryBtn: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	gap: "0.5rem",
	minHeight: "3rem",
	paddingInline: "1.5rem",
	paddingBlock: "0.75rem",
	borderRadius: "1rem",
	background: "var(--colors-bg-surface)",
	color: "var(--colors-fg-primary)",
	border: "1px solid var(--colors-border-default)",
	fontSize: "1rem",
	fontWeight: 500,
	textDecoration: "none",
	transition: "background 150ms ease",
};

const statsRow: CSSProperties = {
	marginTop: "2rem",
	display: "flex",
	flexWrap: "wrap",
	gap: "0.75rem",
};

const statChip: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	gap: "0.75rem",
	paddingInline: "1rem",
	paddingBlock: "0.625rem",
	borderRadius: "9999px",
	background: "var(--colors-bg-surface)",
	border: "1px solid var(--colors-border-muted)",
	color: "var(--colors-fg-primary)",
};

const statValueStyle: CSSProperties = {
	fontSize: "1rem",
	fontWeight: 700,
	letterSpacing: "-0.02em",
};

const statLabelStyle: CSSProperties = {
	fontSize: "0.68rem",
	fontWeight: 500,
	letterSpacing: "0.18em",
	textTransform: "uppercase",
	color: "var(--colors-fg-muted)",
};

const logoGrid: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "repeat(2, 1fr)",
	gap: "1rem 0.75rem",
	width: "100%",
	maxWidth: "19rem",
	marginInlineStart: "auto",
	paddingBlock: "1.5rem",
};

const logoCard: CSSProperties = {
	position: "relative",
	aspectRatio: "1 / 1",
	borderRadius: "1.5rem",
	background: "color-mix(in srgb, #5f5ed7 8%, var(--colors-bg-surface))",
	border: "1px solid var(--colors-border-muted)",
	padding: "1rem",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	transition: "transform 200ms ease",
};

const Typewriter = (props: Props) => {
	return (
		<section style={sectionStyle}>
			<div style={auroraStyle} aria-hidden="true" />
			<div style={innerStyle} className="hero-typewriter-inner">
				<div style={{ minWidth: 0 }}>
					<span style={eyebrowStyle}>
						<span style={eyebrowDot} />
						Hands-on cloud native education
					</span>

					<h1 style={headingBlock}>
						<span style={{ position: "absolute", left: "-9999px" }}>
							{`${props.rotatedPrefixes.join(", ")} ${props.suffix}`}
						</span>
						<span aria-hidden="true" style={rotatingStyle}>
							<TypeAnimation
								sequence={shuffle(props.rotatedPrefixes).reduce<
									Array<string | number>
								>((acc, prefix) => [...acc, prefix, 1250], [])}
								wrapper="span"
								preRenderFirstString
								speed={16}
								deletionSpeed={32}
								cursor
								repeat={Number.POSITIVE_INFINITY}
							/>
						</span>
						<span aria-hidden="true" style={suffixStyle}>
							{props.suffix
								.split(props.highlight)
								.map((part, index, array) => {
									if (index === array.length - 1) {
										return <span key={index}>{part}</span>;
									}
									return (
										<span key={index}>
											{part}
											<span
												style={{
													position: "relative",
													backgroundImage: `linear-gradient(135deg, ${BRAND}, ${CYAN})`,
													backgroundClip: "text",
													WebkitBackgroundClip: "text",
													color: "transparent",
												}}
											>
												{props.highlight}
											</span>
										</span>
									);
								})}
						</span>
					</h1>

					<p style={subStyle}>
						Hands-on lessons, candid trade-offs, and real build sessions for
						engineers who want signal instead of slideware.
					</p>

					<div style={buttonsRow}>
						<a
							href={props.primaryButton.link}
							target={props.primaryButton.newWindow ? "_blank" : "_self"}
							style={primaryBtn}
						>
							{props.primaryButton.text}
							<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
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
							style={secondaryBtn}
						>
							{props.secondaryButton.text}
						</a>
					</div>

					{props.socialProof && props.socialProof.length > 0 && (
						<div style={statsRow}>
							{props.socialProof.map((stat) => (
								<div key={stat.label} style={statChip}>
									<span style={{ fontSize: "1.1rem" }}>{stat.icon}</span>
									<div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
										<span style={statValueStyle}>{stat.value}</span>
										<span style={statLabelStyle}>{stat.label}</span>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				<div className="hero-typewriter-logos" style={logoGrid}>
					{props.logos.slice(0, 4).map((logo) => (
						<div key={logo.name} style={logoCard} title={logo.name}>
							<img
								src={logo.iconUrl}
								alt={logo.name}
								loading="lazy"
								style={{
									width: "100%",
									height: "100%",
									maxWidth: "5rem",
									maxHeight: "5rem",
									objectFit: "contain",
								}}
							/>
						</div>
					))}
				</div>
			</div>
		</section>
	);
};

export default Typewriter;
