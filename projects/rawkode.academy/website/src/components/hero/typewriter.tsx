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

const shuffle = (array: string[]): string[] => {
	return array.sort(() => Math.random() - 0.5);
};

const scanlineMaskStyle = {
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
} as CSSProperties;

const createLogoMaskStyle = (
	iconUrl: string,
	backgroundColor: string,
	mode: "alpha" | "luminance",
	opacity?: number,
) =>
	({
		backgroundColor,
		opacity,
		maskImage: `url(${iconUrl})`,
		WebkitMaskImage: `url(${iconUrl})`,
		maskMode: mode,
		WebkitMaskMode: mode,
		maskRepeat: "no-repeat",
		maskPosition: "center",
		maskSize: "contain",
		WebkitMaskRepeat: "no-repeat",
		WebkitMaskPosition: "center",
		WebkitMaskSize: "contain",
	}) as CSSProperties;

const Typewriter = (props: Props) => {
	return (
		<section className="section-shell relative mb-4 overflow-hidden rounded-[2rem]">
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(var(--brand-primary),0.16),_transparent_30%),radial-gradient(circle_at_85%_18%,_rgba(var(--brand-secondary),0.14),_transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.16),transparent_52%)] opacity-80 dark:bg-[radial-gradient(circle_at_top_left,_rgba(var(--brand-primary),0.2),_transparent_30%),radial-gradient(circle_at_85%_18%,_rgba(var(--brand-secondary),0.16),_transparent_26%),linear-gradient(180deg,rgba(15,23,42,0.18),transparent_52%)]" />
			<div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent dark:via-white/15" />
			<div className="relative mx-auto grid max-w-6xl gap-8 px-5 pb-8 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1.22fr)_minmax(14rem,0.68fr)] lg:items-center lg:gap-5 lg:px-10 lg:pb-10 lg:pt-7">
				<div className="min-w-0 space-y-5">
					<div className="glass-chip max-w-full gap-2 px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.22em] text-primary">
						<span className="h-2 w-2 rounded-full bg-primary" />
						Hands-on cloud native education
					</div>

					<div className="space-y-4">
						<h1 className="text-primary-content">
							<span className="sr-only">
								{`${props.rotatedPrefixes.join(", ")} ${props.suffix}`}
							</span>
							<span
								aria-hidden="true"
								className="block min-h-[1.28em] pb-[0.08em] text-[clamp(1.95rem,4.4vw,3.55rem)] font-semibold leading-[1.02] tracking-[-0.065em] text-primary md:whitespace-nowrap"
							>
								<TypeAnimation
									className="block text-primary"
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
							<span
								aria-hidden="true"
								className="mt-2 block max-w-[16ch] text-balance text-[clamp(1.9rem,4vw,3.15rem)] font-bold leading-[0.95] tracking-[-0.06em] sm:max-w-[18ch]"
							>
								{props.suffix
									.split(props.highlight)
									.map((part, index, array) => {
										if (index === array.length - 1) {
											return <span key={index}>{part}</span>;
										}
										return (
											<span key={index}>
												{part}
												<span className="relative text-primary-content">
													{props.highlight}
													<span className="absolute inset-x-0 bottom-1 h-2 rounded-full bg-linear-to-r from-primary/12 to-secondary/14" />
												</span>
											</span>
										);
									})}
							</span>
						</h1>

						<p className="max-w-2xl text-base leading-7 text-secondary-content sm:text-lg sm:leading-7">
							Hands-on lessons, candid trade-offs, and real build sessions for
							engineers who want signal instead of slideware.
						</p>
					</div>

					<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
						<a
							href={props.primaryButton.link}
							target={props.primaryButton.newWindow ? "_blank" : "_self"}
							className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-primary/15 bg-primary px-6 py-3 text-center text-base font-semibold text-white shadow-lg shadow-primary/20 motion-safe:transition-all motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:bg-primary/92 motion-safe:hover:shadow-xl motion-safe:hover:shadow-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
						>
							{props.primaryButton.text}
							<svg
								className="h-5 w-5"
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
							className="glass-chip min-h-12 rounded-2xl px-6 py-3 text-base font-medium text-primary-content motion-safe:transition-all motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
						>
							{props.secondaryButton.text}
						</a>
					</div>

					{props.socialProof && props.socialProof.length > 0 && (
						<div className="flex flex-wrap gap-3 pt-1">
							{props.socialProof.map((stat, index) => (
								<div
									key={index}
									className="glass-chip min-h-11 gap-3 px-4 py-2.5 text-primary-content"
								>
									<span className="text-base">{stat.icon}</span>
									<div className="min-w-0 leading-none">
										<p className="text-base font-semibold tracking-[-0.04em] text-primary-content">
											{stat.value}
										</p>
										<p className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted">
											{stat.label}
										</p>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
				<div className="hidden lg:block">
					<div className="grid w-full max-w-[19rem] grid-cols-2 gap-x-3 gap-y-8 py-6">
						{props.logos.slice(0, 4).map((logo, index) => (
							<div key={logo.name} className="group relative">
								<div className="section-shell-muted relative aspect-square rounded-[1.6rem] p-4 motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-0.5">
									<div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/35 to-transparent dark:from-white/5" />
									<div className="flex h-full items-center justify-center px-3">
										<div className="relative h-full w-full max-h-[8rem] max-w-[8rem] transition-all duration-300 group-hover:scale-[1.03] motion-reduce:transition-none">
											<div
												className="absolute inset-0 animate-[scanline-scroll_1s_linear_infinite] motion-reduce:animate-none"
												style={scanlineMaskStyle}
											>
												<div
													className="absolute inset-0"
													style={createLogoMaskStyle(
														logo.iconUrl,
														"rgb(var(--brand-secondary))",
														"alpha",
														0.28,
													)}
												/>
												<div
													className="absolute inset-0"
													style={createLogoMaskStyle(
														logo.iconUrl,
														"rgb(var(--brand-primary))",
														"luminance",
													)}
												/>
											</div>

											<img
												src={logo.iconUrl}
												alt={logo.name}
												className="absolute inset-0 h-full w-full object-contain opacity-0 transition-all duration-300 group-hover:opacity-100 motion-reduce:transition-none"
												loading="lazy"
											/>
										</div>
									</div>
								</div>
								<div
									className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 motion-safe:translate-y-1 ${
										index < 2 ? "bottom-full mb-3" : "top-full mt-3"
									}`}
								>
									<span className="glass-chip max-w-[10.5rem] truncate whitespace-nowrap px-3 py-1 text-[0.62rem] uppercase tracking-[0.18em] text-primary">
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
