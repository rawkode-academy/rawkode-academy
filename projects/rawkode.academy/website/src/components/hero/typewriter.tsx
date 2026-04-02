import { css } from "../../../styled-system/css";
import { glassPanel } from "../../../styled-system/recipes";
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

const Typewriter = (props: Props) => {
	return (
		<section className={css(
			glassPanel.raw(),
			{
				position: "relative",
				mb: "6",
				rounded: "3xl",
				overflow: "hidden",
			}
		)}>
			<div className={css({
				position: "absolute",
				inset: "0",
				background: "linear-gradient(to bottom right, rgba(255,255,255,0.6), rgba(var(--brand-primary),0.1), transparent)",
				opacity: 0.7,
				pointerEvents: "none",
				_dark: {
					background: "linear-gradient(to bottom right, rgba(17,24,39,0.6), rgba(var(--brand-primary),0.2), transparent)",
				},
			})} />
			<div className={css({
				position: "relative",
				display: "grid",
				maxW: "6xl",
				px: { base: "4", sm: "6" },
				pt: { base: "0" },
				pb: "10",
				mx: "auto",
				gap: { base: "8", lg: "6" },
				lg: { pt: "6", pb: "16", gridTemplateColumns: "repeat(12, minmax(0, 1fr))" },
			})}>
				<div className={css({
					placeSelf: "center",
					display: "flex",
					flexDirection: "column",
					gap: "4",
					lg: { gridColumn: "span 6 / span 6" },
					minW: "0",
					w: "full",
				})}>
					<h1 className={css({
						textWrap: "balance",
						fontSize: { base: "3xl", sm: "4xl", md: "5xl", xl: "6xl" },
						fontWeight: "bold",
						letterSpacing: "tight",
						lineHeight: "tight",
						color: { base: "black", _dark: "white" },
					})}>
						<span className={css({
							display: "block",
							fontSize: { base: "2xl", sm: "3xl", md: "4xl", xl: "5xl" },
						})}>
							<TypeAnimation
								className={css({
									backgroundImage: "linear-gradient(to bottom right, rgb(var(--brand-primary)), rgb(var(--brand-secondary)))",
									backgroundClip: "text",
									color: "transparent",
									pb: "2",
								})}
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
						<span className={css({
							display: "block",
							textWrap: "pretty",
							mt: { base: "2", sm: "3" },
							fontSize: { base: "1.4rem", sm: "1.7rem", md: "2.1rem", xl: "2.7rem" },
						})}>
							{props.suffix.split(props.highlight).map((part, index, array) => {
								if (index === array.length - 1) {
									return <span key={index}>{part}</span>;
								}
								return (
									<span key={index}>
										{part}
										<span className={css({ position: "relative" })}>
											{props.highlight}
											<span className={css({
												position: "absolute",
												bottom: "0",
												left: "0",
												w: "full",
												h: "1",
												background: "linear-gradient(to right, rgba(var(--brand-primary),0.3), rgba(var(--brand-secondary),0.3))",
											})} />
										</span>
									</span>
								);
							})}
						</span>
					</h1>
					<p className={css({
						color: { base: "gray.600", _dark: "gray.400" },
						fontSize: { md: "lg", lg: "xl" },
						maxW: "3xl",
					})}>
						Navigating the Cloud Native landscape can be tough and just keeping
						your head above water is a challenge.
						<br />
						<br />
						<span className={css({
							fontWeight: "medium",
							color: { base: "black", _dark: "white" },
						})}>
							We're here to help.
						</span>
					</p>
					<div className={css({
						display: "flex",
						flexDirection: { base: "column", sm: "row" },
						gap: "3",
						sm: { alignItems: "center" },
					})}>
						<a
							href={props.primaryButton.link}
							target={props.primaryButton.newWindow ? "_blank" : "_self"}
							className={css({
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								px: "6",
								py: "3",
								fontSize: "base",
								fontWeight: "semibold",
								textAlign: "center",
								rounded: "xl",
								color: "white",
								background: "linear-gradient(to bottom right, rgba(var(--brand-primary),0.9), rgba(var(--brand-secondary),0.9))",
								backdropFilter: "blur(12px)",
								shadow: "md",
								border: "1px solid rgba(var(--brand-primary),0.3)",
								transition: "all",
								transitionDuration: "200ms",
								_hover: {
									background: "linear-gradient(to bottom right, rgb(var(--brand-primary)), rgb(var(--brand-secondary)))",
									shadow: "lg",
									transform: "scale(1.05)",
								},
							})}
						>
							{props.primaryButton.text}
							<svg
								className={css({ w: "5", h: "5", ml: "2", mr: "-1" })}
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
							className={css({
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								px: "6",
								py: "3",
								fontSize: "base",
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
								_hover: {
									bg: { base: "rgba(255,255,255,0.8)", _dark: "rgba(55,65,81,0.8)" },
									shadow: "lg",
									transform: "scale(1.05)",
								},
								_focusVisible: {
									outline: "2px solid",
									outlineColor: "rgba(var(--brand-primary),0.4)",
								},
							})}
						>
							{props.secondaryButton.text}
						</a>
					</div>

					{props.socialProof && props.socialProof.length > 0 && (
						<div className={css({
							display: "flex",
							flexWrap: "wrap",
							alignItems: "center",
							gap: { base: "2", sm: "4" },
							pt: "4",
						})}>
							{props.socialProof.map((stat, index) => (
								<div key={index} className={css({
									display: "flex",
									alignItems: "center",
									gap: { base: "1", sm: "2" },
								})}>
									<span className={css({ fontSize: "lg" })}>{stat.icon}</span>
									<span className={css({
										fontWeight: "bold",
										color: { base: "gray.900", _dark: "white" },
									})}>{stat.value}</span>
									<span className={css({
										color: { base: "gray.500", _dark: "gray.400" },
										fontSize: { base: "xs", sm: "sm" },
									})}>{stat.label}</span>
								</div>
							))}
						</div>
					)}
				</div>
				<div className={css({
					display: { base: "none", lg: "flex" },
					lg: { gridColumn: "span 6 / span 6", alignItems: "center", justifyContent: "center" },
				})}>
					{/*
						Duotone logo grid with CRT scanline effect.
						Uses theme colors via CSS variables for consistency across themes.
					*/}
					<div className={css({
						display: "grid",
						gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
						gap: "4",
						w: "full",
						maxW: "400px",
					})}>
						{props.logos.slice(0, 4).map((logo) => (
							<div
								key={logo.name}
								data-group
								className={css({
									position: "relative",
									aspectRatio: "square",
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
								})}
							>
								{/* Duotone scanline mask (fades out on hover) */}
								<div className={css({
									position: "relative",
									w: "2/3",
									h: "2/3",
									transition: "all",
									transitionDuration: "300ms",
									_groupHover: { transform: "scale(1.1)", opacity: 0 },
								})}>
									{/*
										Scanline Mask Container
										This div applies the scrolling scanline mask to all layers inside.
									*/}
									<div
										className={css({
											position: "absolute",
											inset: "0",
											animation: "scanline-scroll 1s linear infinite",
										})}
										style={{
											maskImage: `repeating-linear-gradient(
												to bottom,
												black 0px,
												black 2px,
												transparent 2px,
												transparent 4px
											)`,
											WebkitMaskImage: `repeating-linear-gradient(
												to bottom,
												black 0px,
												black 2px,
												transparent 2px,
												transparent 4px
											)`,
											maskSize: "100% 4px",
											WebkitMaskSize: "100% 4px",
										}}
									>
										{/*
											Layer 1: Secondary Color (Background/Shadows)
										*/}
										<div
											className={css({ position: "absolute", inset: "0" })}
											style={
												{
													backgroundColor: "rgb(var(--brand-secondary))",
													opacity: 0.3,
													maskImage: `url(${logo.iconUrl})`,
													WebkitMaskImage: `url(${logo.iconUrl})`,
													maskMode: "alpha",
													WebkitMaskMode: "alpha",
													maskRepeat: "no-repeat",
													maskPosition: "center",
													maskSize: "contain",
													WebkitMaskRepeat: "no-repeat",
													WebkitMaskPosition: "center",
													WebkitMaskSize: "contain",
												} as React.CSSProperties
											}
										/>

										{/*
											Layer 2: Primary Color (Foreground/Whites)
										*/}
										<div
											className={css({ position: "absolute", inset: "0" })}
											style={
												{
													backgroundColor: "rgb(var(--brand-primary))",
													maskImage: `url(${logo.iconUrl})`,
													WebkitMaskImage: `url(${logo.iconUrl})`,
													maskMode: "luminance",
													WebkitMaskMode: "luminance",
													maskRepeat: "no-repeat",
													maskPosition: "center",
													maskSize: "contain",
													WebkitMaskRepeat: "no-repeat",
													WebkitMaskPosition: "center",
													WebkitMaskSize: "contain",
												} as React.CSSProperties
											}
										/>
									</div>
								</div>

								{/* Original logo (appears on hover) */}
								<img
									src={logo.iconUrl}
									alt={logo.name}
									className={css({
										position: "absolute",
										w: "2/3",
										h: "2/3",
										objectFit: "contain",
										opacity: 0,
										transition: "all",
										transitionDuration: "300ms",
										_groupHover: { opacity: 1, transform: "scale(1.1)" },
									})}
								/>

								<div className={css({
									position: "absolute",
									insetX: "0",
									bottom: "4",
									display: "flex",
									justifyContent: "center",
									opacity: 0,
									transition: "opacity",
									transitionDuration: "300ms",
									_groupHover: { opacity: 1 },
									pointerEvents: "none",
								})}>
									<span className={css({
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
									})}>
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
